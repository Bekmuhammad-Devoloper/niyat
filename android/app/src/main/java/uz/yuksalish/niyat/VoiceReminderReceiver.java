// AlarmManager belgilangan vaqtga yetganda Android tomonidan chaqiriladi.
// Ilova butunlay yopiq bo'lsa ham ishlaydi (Android shu maqsadda receiver'ni
// uyg'otib chaqiradi). Vazifasi — TTS service'ni baland ovozda ishga tushirish.

package uz.yuksalish.niyat;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;

public class VoiceReminderReceiver extends BroadcastReceiver {

    public static final String EXTRA_TEXT = "text";
    public static final String EXTRA_NOTIF_ID = "notifId";

    @Override
    public void onReceive(Context context, Intent intent) {
        String text = intent.getStringExtra(EXTRA_TEXT);
        int notifId = intent.getIntExtra(EXTRA_NOTIF_ID, 0);

        // CPU'ni qisqa vaqtga yorug' tutamiz — TTS service ishga tushguncha
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = pm != null
                ? pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "niyat:voice-reminder")
                : null;
        if (wl != null) {
            try { wl.acquire(15_000L); } catch (Exception ignored) {}
        }

        Intent svc = new Intent(context, VoiceReminderService.class);
        svc.putExtra(VoiceReminderService.EXTRA_TEXT, text);
        svc.putExtra(VoiceReminderService.EXTRA_NOTIF_ID, notifId);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }
        } catch (Exception e) {
            // Foreground start cheklanmagan ekan, oddiy service sifatida urinamiz
            try { context.startService(svc); } catch (Exception ignored) {}
        } finally {
            if (wl != null && wl.isHeld()) {
                try { wl.release(); } catch (Exception ignored) {}
            }
        }
    }
}
