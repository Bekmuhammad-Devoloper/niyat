// Telefon qayta yuklangach (BOOT_COMPLETED) MicService'ni avtomatik
// qaytadan ishga tushiradi. Foydalanuvchi mic_background sozlamasini
// yoqib qoyilgan bo'lsagina ishlaydi.

package uz.yuksalish.niyat;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "NiyatBootReceiver";
    private static final String PREFS_NAME = "niyat_mic";
    private static final String PREFS_ENABLED_KEY = "mic_background_enabled";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (ctx == null || intent == null) return;
        String action = intent.getAction();
        if (action == null) return;
        // Bir nechta brand'lar turli action'lar yuboradi
        if (!action.equals(Intent.ACTION_BOOT_COMPLETED) &&
            !action.equals("android.intent.action.QUICKBOOT_POWERON") &&
            !action.equals("com.htc.intent.action.QUICKBOOT_POWERON")) {
            return;
        }

        SharedPreferences prefs = ctx.getSharedPreferences(
                PREFS_NAME, Context.MODE_PRIVATE
        );
        boolean enabled = prefs.getBoolean(PREFS_ENABLED_KEY, false);
        if (!enabled) {
            Log.i(TAG, "Sozlama o'chirilgan — service ishga tushirilmaydi");
            return;
        }

        try {
            Intent svc = new Intent(ctx, MicService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(svc);
            } else {
                ctx.startService(svc);
            }
            Log.i(TAG, "MicService qayta yoqilgan (boot)");
        } catch (Exception e) {
            Log.w(TAG, "Boot'da MicService yoqilmadi", e);
        }
    }
}
