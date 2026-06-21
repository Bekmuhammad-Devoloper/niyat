// JS tarafdan Android AlarmManager'ga ovozli eslatma jadval qo'yish va
// bekor qilish uchun Capacitor bridge.
//
// API:
//   VoiceReminder.schedule({ id, text, triggerAtMs })
//   VoiceReminder.cancel({ id })
//   VoiceReminder.cancelAll()

package uz.yuksalish.niyat;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "VoiceReminder")
public class VoiceReminderPlugin extends Plugin {

    private static final String PREFS = "niyat_voice_reminder";
    private static final String KEY_IDS = "scheduled_ids";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        Integer id = call.getInt("id");
        String text = call.getString("text");
        String audioBase64 = call.getString("audioBase64"); // ixtiyoriy — pre-rendered MP3
        Long triggerAtMs = call.getLong("triggerAtMs");

        if (id == null || text == null || triggerAtMs == null) {
            call.reject("id, text, triggerAtMs required");
            return;
        }
        if (triggerAtMs <= System.currentTimeMillis()) {
            call.reject("triggerAtMs must be in the future");
            return;
        }

        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            call.reject("AlarmManager unavailable");
            return;
        }

        // Agar audio base64 berilgan bo'lsa, cache'ga MP3 fayl saqlaymiz
        String audioPath = null;
        if (audioBase64 != null && !audioBase64.isEmpty()) {
            try {
                byte[] mp3 = Base64.decode(audioBase64, Base64.DEFAULT);
                File dir = new File(ctx.getCacheDir(), "voice-reminder");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, "reminder-" + id + ".mp3");
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(mp3);
                fos.close();
                audioPath = f.getAbsolutePath();
            } catch (Exception e) {
                // Audio yozib bo'lmasa — TTS fallback ishlatamiz
                audioPath = null;
            }
        }

        PendingIntent pi = buildPendingIntent(ctx, id, text, audioPath);

        try {
            // setExactAndAllowWhileIdle — Doze mode'ni yengadi (Android 6+).
            // Aniq vaqtga uyg'otadi, ilova yopiq bo'lsa ham.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (am.canScheduleExactAlarms()) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
                } else {
                    // Foydalanuvchi exact alarm ruxsatini bermagan — yumshoq variant
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
            }

            // ID'ni saqlaymiz — keyinroq cancel qila olish uchun
            Set<String> ids = new HashSet<>(prefs().getStringSet(KEY_IDS, new HashSet<>()));
            ids.add(String.valueOf(id));
            prefs().edit().putStringSet(KEY_IDS, ids).apply();

            JSObject ret = new JSObject();
            ret.put("scheduled", true);
            ret.put("id", id);
            call.resolve(ret);
        } catch (SecurityException e) {
            call.reject("exact alarm permission missing: " + e.getMessage());
        } catch (Exception e) {
            call.reject("schedule failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("id required");
            return;
        }
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            PendingIntent pi = buildPendingIntent(ctx, id, "", null);
            try { am.cancel(pi); } catch (Exception ignored) {}
            try { pi.cancel(); } catch (Exception ignored) {}
        }
        // Saqlangan MP3 fayl bo'lsa o'chiramiz
        try {
            File f = new File(new File(ctx.getCacheDir(), "voice-reminder"),
                    "reminder-" + id + ".mp3");
            if (f.exists()) f.delete();
        } catch (Exception ignored) {}
        Set<String> ids = new HashSet<>(prefs().getStringSet(KEY_IDS, new HashSet<>()));
        ids.remove(String.valueOf(id));
        prefs().edit().putStringSet(KEY_IDS, ids).apply();

        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        Set<String> ids = new HashSet<>(prefs().getStringSet(KEY_IDS, new HashSet<>()));
        if (am != null) {
            for (String idStr : ids) {
                try {
                    int id = Integer.parseInt(idStr);
                    PendingIntent pi = buildPendingIntent(ctx, id, "", null);
                    am.cancel(pi);
                    pi.cancel();
                } catch (Exception ignored) {}
            }
        }
        // Cache faylllarni tozalash
        try {
            File dir = new File(ctx.getCacheDir(), "voice-reminder");
            if (dir.exists()) {
                File[] files = dir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        try { f.delete(); } catch (Exception ignored) {}
                    }
                }
            }
        } catch (Exception ignored) {}
        prefs().edit().remove(KEY_IDS).apply();
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        ret.put("count", ids.size());
        call.resolve(ret);
    }

    @PluginMethod
    public void canScheduleExact(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            ret.put("allowed", am != null && am.canScheduleExactAlarms());
        } else {
            ret.put("allowed", true);
        }
        call.resolve(ret);
    }

    private PendingIntent buildPendingIntent(Context ctx, int id, String text, String audioPath) {
        Intent intent = new Intent(ctx, VoiceReminderReceiver.class);
        intent.putExtra(VoiceReminderReceiver.EXTRA_TEXT, text);
        if (audioPath != null) {
            intent.putExtra(VoiceReminderReceiver.EXTRA_AUDIO_PATH, audioPath);
        }
        intent.putExtra(VoiceReminderReceiver.EXTRA_NOTIF_ID, id);
        // setData — har bir id uchun unikal Intent (PendingIntent dedupe uchun)
        intent.setData(android.net.Uri.parse("niyat-voice-reminder://" + id));
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(ctx, id, intent, flags);
    }
}
