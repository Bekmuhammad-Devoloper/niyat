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

    // Wake word — foydalanuvchi "Niyat" deganda ovozli muloqotni ochish uchun.
    // Plugin shu broadcastni ushlab JS'ga uzatadi.
    public static final String ACTION_WAKE_WORD = "uz.yuksalish.niyat.WAKE_WORD";
    public static final String EXTRA_WAKE_TEXT = "text";
    private static final long WAKE_COOLDOWN_MS = 4_000L; // bir uyg'otish dan keyin 4 sek jim
    private long lastWakeAt = 0L;

    // Til fallback — ko'p Android telefonlar uz-UZ'ni qo'llamaydi. Birinchi 3
    // muvaffaqiyatli aniqlash (yoki 3 ta xato) keyin keyingi tilga o'tamiz.
    // ru-RU eng keng tarqalgan (deyarli barcha telefon), tr-TR fonetik yaqin,
    // en-US zaxira.
    private static final String[] LANGUAGE_FALLBACK = {"ru-RU", "uz-UZ", "tr-TR", "en-US"};
    private int currentLangIdx = 0;
    private int errorStreak = 0;
    private static final int MAX_ERROR_STREAK = 5;

    private SpeechRecognizer recognizer;
    private Handler mainHandler;
    private PowerManager.WakeLock wakeLock;
    private volatile boolean shouldRun = false;
    private ExecutorService networkExecutor;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        mainHandler = new Handler(Looper.getMainLooper());
        networkExecutor = Executors.newSingleThreadExecutor();
        acquireWakeLock();
        try {
            startForegroundCompat();
        } catch (Exception e) {
            // Android 14+ da RECORD_AUDIO ruxsati yo'q bo'lsa
            // foregroundServiceType="microphone" SecurityException tashlaydi.
            // Ilovani crash qildirmaymiz — faqat servis to'xtaydi.
            Log.w(TAG, "startForeground xato — servis to'xtaydi", e);
            stopSelf();
            return;
        }
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
            } catch (SecurityException se) {
                // RECORD_AUDIO yo'q — Android 14+ specifik xato. Caller'ga
                // tashlab beramiz, ilovani crash qildirmasdan to'xtab qolamiz.
                throw se;
            } catch (Exception e) {
                Log.w(TAG, "FOREGROUND_SERVICE_TYPE_MICROPHONE yoq", e);
            }
        }
        try {
            startForeground(NOTIFICATION_ID, notification);
        } catch (Exception e) {
            Log.w(TAG, "startForeground xato", e);
            throw e;
        }
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
        @Override public void onPartialResults(Bundle partialResults) {
            // Wake word'ni iloji boricha tez topish uchun partial natijalarni ham tekshiramiz
            ArrayList<String> matches = partialResults.getStringArrayList(
                    SpeechRecognizer.RESULTS_RECOGNITION
            );
            if (matches != null && !matches.isEmpty()) {
                checkWakeWord(matches.get(0));
            }
        }
        @Override public void onEvent(int eventType, Bundle params) {}

        @Override
        public void onError(int error) {
            // Til qo'llab-quvvatlanmasligi yoki uzoq jim qolish — keyingi tilga o'tish
            errorStreak++;
            if (errorStreak >= MAX_ERROR_STREAK
                    && currentLangIdx < LANGUAGE_FALLBACK.length - 1) {
                currentLangIdx++;
                errorStreak = 0;
                Log.i(TAG, "Tilga o'tildi: " + LANGUAGE_FALLBACK[currentLangIdx]);
            }
            restartLater();
        }

        @Override
        public void onResults(Bundle results) {
            errorStreak = 0;
            ArrayList<String> matches = results.getStringArrayList(
                    SpeechRecognizer.RESULTS_RECOGNITION
            );
            if (matches != null && !matches.isEmpty()) {
                String text = matches.get(0);
                saveTranscript(text);
                checkWakeWord(text);
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
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, LANGUAGE_FALLBACK[currentLangIdx]);
        // Wake word'ni real vaqtda topish uchun partial natijalar yoqilgan
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
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

    // Wake word ("niyat" yoki "Niyat") topilishini tekshirish va event broadcast.
    // 3 ta yo'l bilan ovozli muloqotni ishga tushuramiz:
    //   1) Broadcast — agar ilova background'da tirik bo'lsa (Plugin receiver ushlaydi)
    //   2) MainActivity'ni to'g'ridan-to'g'ri ochish — ilova killed bo'lsa
    //   3) Full-screen notification — Activity launch cheklangan telefonlarda zaxira
    private void checkWakeWord(String raw) {
        if (raw == null || raw.trim().isEmpty()) return;
        long now = SystemClock.elapsedRealtime();
        if (now - lastWakeAt < WAKE_COOLDOWN_MS) return; // throttle

        String lower = raw.toLowerCase().trim();
        if (matchesWakeWord(lower)) {
            lastWakeAt = now;
            Log.i(TAG, "Wake word topildi: " + raw);

            // 1) Broadcast — ilova tirik bo'lsa receiver ushlaydi
            try {
                Intent broadcast = new Intent(ACTION_WAKE_WORD);
                broadcast.putExtra(EXTRA_WAKE_TEXT, raw);
                broadcast.setPackage(getPackageName());
                sendBroadcast(broadcast);
            } catch (Exception e) {
                Log.w(TAG, "wake broadcast xato", e);
            }

            // 2) MainActivity'ni to'g'ridan-to'g'ri ochish.
            // Android 10+ "background activity launch"ni cheklaydi, lekin
            // ko'p qurilmalarda barmoq bilan tegirilmaganda baribir ochiladi
            // (xususan SYSTEM_ALERT_WINDOW yoki ekran yoqilgan paytda).
            Intent launch = new Intent(this, MainActivity.class);
            launch.putExtra("from_wake_word", true);
            launch.putExtra("wake_text", raw);
            launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            try {
                startActivity(launch);
            } catch (Exception e) {
                Log.w(TAG, "Activity launch xato (background restriction)", e);
            }

            // 3) Heads-up full-screen notification — Activity launch
            // bloklangan telefonlarda foydalanuvchi notification'ga bossa
            // ilova ochiladi va voice mode avtomatik chiqadi.
            showWakeWordNotification(raw);
        }
    }

    private static final String WAKE_CHANNEL_ID = "niyat_wake_word";
    private static final int WAKE_NOTIF_ID = 9913;

    private void showWakeWordNotification(String text) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && nm.getNotificationChannel(WAKE_CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        WAKE_CHANNEL_ID,
                        "Niyat — \"Niyat\" so'zi uyg'otish",
                        NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("\"Niyat\" so'zi eshitilganda ovozli muloqotni ochish");
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }

            Intent launch = new Intent(this, MainActivity.class);
            launch.putExtra("from_wake_word", true);
            launch.putExtra("wake_text", text);
            launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getActivity(this, 0, launch, piFlags);

            NotificationCompat.Builder b = new NotificationCompat.Builder(this, WAKE_CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                    .setContentTitle("🎙 Niyat sizni eshityapti")
                    .setContentText("Bosing — javob bera boshlayman")
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_CALL)
                    .setAutoCancel(true)
                    .setContentIntent(pi)
                    .setFullScreenIntent(pi, true)
                    .setTimeoutAfter(15_000);
            nm.notify(WAKE_NOTIF_ID, b.build());
        } catch (Exception e) {
            Log.w(TAG, "wake notification xato", e);
        }
    }

    private boolean matchesWakeWord(String text) {
        // So'z chegarasiga e'tibor: "niyat" alohida so'z yoki gap boshida
        // bo'lishi kerak — "muniyat", "qaniyat" kabi qismli mosliklarga
        // tushib qolmaslik uchun. Lekin chap chegara yumshatilgan — gap
        // boshida punctuatsiya bo'lmasligi mumkin, va STT ba'zan bo'sh
        // joy qo'ymaydi.
        String[] needles = {
                // Lotin yozuvi (uz-UZ, en-US, tr-TR)
                "niyat", "niyyat", "neyat", "neyyat", "nyat",
                "niyot", "niayat", "niat", "naat", "niat",
                "neat", "nyat", "nay at", "nee yat",
                // Rus tilida transkripsiya (ru-RU eng keng tarqalgan til)
                "ниат", "нийат", "ниять", "няат", "нят",
                "неат", "нияти", "нияту", "нияту", "нияты",
                // Boshqa variantlar
                "nijat", "nijot", "ниджат"
        };
        for (String n : needles) {
            int idx = text.indexOf(n);
            while (idx >= 0) {
                // Chap chegara: gap boshida yoki harf/raqam bo'lmasligi kerak
                boolean leftOk = idx == 0
                        || !isWordChar(text.charAt(idx - 1));
                // O'ng chegara: so'z oxiri yoki harf/raqam bo'lmasligi kerak
                // YOKI so'z kichik bo'lsa (3-5 harf) — biroz erkin
                int endIdx = idx + n.length();
                boolean rightOk = endIdx >= text.length()
                        || !isWordChar(text.charAt(endIdx))
                        || n.length() >= 4; // 4+ harf bo'lsa suffiks ham OK ("niyatim", "niyaty")
                if (leftOk && rightOk) return true;
                idx = text.indexOf(n, idx + 1);
            }
        }
        return false;
    }

    private boolean isWordChar(char c) {
        return Character.isLetterOrDigit(c);
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
        teardownRecognizer();
        cancelWatchdog();
        releaseWakeLock();
        if (networkExecutor != null) {
            networkExecutor.shutdown();
            networkExecutor = null;
        }
        if (instance == this) instance = null;
        super.onDestroy();
    }

    // Voice mode uchun mikrofonni darhol ozod qilish. Plugin.stop() shu
    // metodni chaqiradi, keyin stopService. onDestroy asinxron — bu yo'l
    // bilan AudioRecord lock voice mode getUserMedia'dan oldin ozod bo'ladi.
    public void teardownRecognizer() {
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
    }

    // Watchdog AlarmManager intentini bekor qilish — aks holda 10 daqiqada
    // service o'z-o'zidan qayta yoqilib voice mode'ni buzadi.
    public void cancelWatchdog() {
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
            if (am != null) am.cancel(pi);
            pi.cancel();
        } catch (Exception e) {
            Log.w(TAG, "cancelWatchdog xato", e);
        }
    }

    // BackgroundMicPlugin.stop() darhol chaqirilganda — instance ushlanib
    // turilmaydi (Service singleton emas). Shu sabab static yo'l:
    // Service o'zining instance'ini static field'da saqlaydi.
    private static volatile MicService instance = null;

    public static MicService getInstance() {
        return instance;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
