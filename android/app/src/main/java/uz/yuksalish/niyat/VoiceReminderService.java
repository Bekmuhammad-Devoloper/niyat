// Foreground service — Android'ning ichki TextToSpeech engine'i orqali matnni
// ovozli o'qib beradi. AlarmManager broadcast'ini olib, ilova yopiq bo'lsa ham
// ishlaydi. Audio media stream maksimal balandlikka ko'tariladi.

package uz.yuksalish.niyat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import androidx.core.app.NotificationCompat;

import java.util.HashMap;
import java.util.Locale;

public class VoiceReminderService extends Service {

    public static final String EXTRA_TEXT = "text";
    public static final String EXTRA_NOTIF_ID = "notifId";
    public static final String CHANNEL_ID = "niyat-voice-reminder-fg";
    public static final int FG_NOTIF_ID = 4711;

    private TextToSpeech tts;
    private int previousVolume = -1;
    private AudioManager audioManager;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(FG_NOTIF_ID, buildForegroundNotification("Niyat eslatma ovozi"));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        final String text = intent != null ? intent.getStringExtra(EXTRA_TEXT) : null;
        if (text == null || text.trim().isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        // Media volume'ni vaqtincha maksimumga ko'taramiz (keyin qaytaramiz).
        try {
            audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                previousVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
                int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, max, 0);
            }
        } catch (Exception ignored) {}

        tts = new TextToSpeech(getApplicationContext(), status -> {
            if (status != TextToSpeech.SUCCESS) {
                stopAndRelease();
                return;
            }
            // O'zbekcha ovoz aksar qurilmalarda yo'q — turkcha eng yaqin.
            Locale chosen = pickLocale(tts);
            if (chosen != null) {
                tts.setLanguage(chosen);
            }
            tts.setSpeechRate(0.88f);
            tts.setPitch(1.0f);

            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String utteranceId) {}
                @Override public void onDone(String utteranceId) { stopAndRelease(); }
                @Override public void onError(String utteranceId) { stopAndRelease(); }
            });

            HashMap<String, String> params = new HashMap<>();
            params.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "niyat-reminder");
            params.put(TextToSpeech.Engine.KEY_PARAM_STREAM,
                    String.valueOf(AudioManager.STREAM_MUSIC));
            params.put(TextToSpeech.Engine.KEY_PARAM_VOLUME, "1.0");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                Bundle b = new Bundle();
                b.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_MUSIC);
                b.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, b, "niyat-reminder");
            } else {
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, params);
            }
        });

        return START_NOT_STICKY;
    }

    private Locale pickLocale(TextToSpeech engine) {
        Locale[] preferred = new Locale[] {
                new Locale("uz", "UZ"),
                new Locale("tr", "TR"),
                new Locale("ru", "RU"),
                Locale.US
        };
        for (Locale l : preferred) {
            int res = engine.isLanguageAvailable(l);
            if (res == TextToSpeech.LANG_AVAILABLE
                    || res == TextToSpeech.LANG_COUNTRY_AVAILABLE
                    || res == TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE) {
                return l;
            }
        }
        return null;
    }

    private void stopAndRelease() {
        if (tts != null) {
            try { tts.stop(); } catch (Exception ignored) {}
            try { tts.shutdown(); } catch (Exception ignored) {}
            tts = null;
        }
        try {
            if (audioManager != null && previousVolume >= 0) {
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, previousVolume, 0);
            }
        } catch (Exception ignored) {}
        stopForeground(true);
        stopSelf();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel ch = nm.getNotificationChannel(CHANNEL_ID);
            if (ch == null) {
                NotificationChannel created = new NotificationChannel(
                        CHANNEL_ID,
                        "Niyat eslatma ovozi",
                        NotificationManager.IMPORTANCE_LOW);
                created.setDescription("Vazifa eslatma ovozi ijro etilmoqda");
                created.setShowBadge(false);
                nm.createNotificationChannel(created);
            }
        }
    }

    private Notification buildForegroundNotification(String contentText) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(this, 0, openIntent, flags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_silent_mode_off)
                .setContentTitle("Niyat eslatma")
                .setContentText(contentText)
                .setOngoing(true)
                .setContentIntent(pi)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        stopAndRelease();
        super.onDestroy();
    }
}
