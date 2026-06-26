// JS tarafdan MicService'ni boshqarish uchun Capacitor bridge.
//
// API:
//   BackgroundMic.start()           — foreground service'ni yoqadi + boot uchun saqlaydi
//   BackgroundMic.stop()            — service'ni to'xtatadi + boot uchun o'chiradi
//   BackgroundMic.isRunning()       — service holati
//   BackgroundMic.getTranscripts()  — saqlangan transkriptlar
//   BackgroundMic.clearTranscripts()— transkriptlarni tozalaydi
//   BackgroundMic.isIgnoringBatteryOptimizations() — battery exempt mi
//   BackgroundMic.requestIgnoreBatteryOptimizations() — Android'dan exempt so'raydi
//   BackgroundMic.openAppSettings() — telefon Settings → Niyat ni ochadi (manufacturer
//                                     specific battery saver uchun)

package uz.yuksalish.niyat;

import android.Manifest;
import android.app.ActivityManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundMic")
public class BackgroundMicPlugin extends Plugin {

    private static final String PREFS_NAME = "niyat_mic";
    private static final String PREFS_TRANSCRIPTS_KEY = "transcripts";
    private static final String PREFS_ENABLED_KEY = "mic_background_enabled";
    private static final String PREFS_AUTH_TOKEN = "auth_token";
    private static final String PREFS_API_BASE = "api_base";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    // Wake word broadcast'ni qabul qiluvchi — MicService "niyat" so'zini
    // topganda broadcast yuboradi, biz JS'ga "wakeWord" eventi qilib uzatamiz.
    private BroadcastReceiver wakeReceiver;

    @Override
    public void load() {
        super.load();
        wakeReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                if (intent == null) return;
                String text = intent.getStringExtra(MicService.EXTRA_WAKE_TEXT);
                emitWakeWord(text);
            }
        };
        IntentFilter filter = new IntentFilter(MicService.ACTION_WAKE_WORD);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(
                        wakeReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(wakeReceiver, filter);
            }
        } catch (Exception ignored) {}

        // Plugin yuklanganda — MainActivity wake intent bilan ochilgan bo'lsa,
        // pendingWakeWordText'ni o'qib darhol JS event'ni yuboramiz.
        // JS listener'lar hali registratsiya qilmagan bo'lishi mumkin —
        // shuning uchun biroz kutish kerak.
        try {
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(
                    this::notifyWakeWordIfPending,
                    1500
            );
        } catch (Exception ignored) {}
    }

    // MainActivity tomonidan chaqiriladi (onNewIntent) yoki Plugin load()'da
    // — pendingWakeWordText bor bo'lsa JS event'ni yuborib tozalaymiz.
    public void notifyWakeWordIfPending() {
        String pending = MainActivity.pendingWakeWordText;
        if (pending == null) return;
        MainActivity.pendingWakeWordText = null;
        emitWakeWord(pending);
    }

    private void emitWakeWord(String text) {
        JSObject data = new JSObject();
        data.put("text", text != null ? text : "");
        data.put("at", System.currentTimeMillis());
        notifyListeners("wakeWord", data);
    }

    @Override
    protected void handleOnDestroy() {
        if (wakeReceiver != null) {
            try { getContext().unregisterReceiver(wakeReceiver); } catch (Exception ignored) {}
            wakeReceiver = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void start(PluginCall call) {
        Context ctx = getContext();
        // Mikrofon ruxsati grant qilinmagan bo'lsa, foreground service'ni
        // ishga tushirishga URINMAYMIZ. Android 14+ da foregroundServiceType
        // "microphone" RECORD_AUDIO permission talab qiladi, aks holda
        // SecurityException tashlanadi va ilova crash bo'ladi.
        int perm = ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO);
        if (perm != PackageManager.PERMISSION_GRANTED) {
            JSObject ret = new JSObject();
            ret.put("started", false);
            ret.put("reason", "mic_permission_denied");
            call.resolve(ret);
            return;
        }
        // Boot receiver uchun saqlaymiz — telefon qayta yuklangandan keyin avtomatik
        prefs().edit().putBoolean(PREFS_ENABLED_KEY, true).apply();
        Intent intent = new Intent(ctx, MicService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("started", false);
            ret.put("reason", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        prefs().edit().putBoolean(PREFS_ENABLED_KEY, false).apply();
        Intent intent = new Intent(ctx, MicService.class);
        try {
            ctx.stopService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("stop xato: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        boolean running = isServiceRunning(MicService.class);
        JSObject ret = new JSObject();
        ret.put("running", running);
        call.resolve(ret);
    }

    @PluginMethod
    public void getTranscripts(PluginCall call) {
        String json = prefs().getString(PREFS_TRANSCRIPTS_KEY, "[]");
        JSObject ret = new JSObject();
        ret.put("transcripts", json);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearTranscripts(PluginCall call) {
        prefs().edit().remove(PREFS_TRANSCRIPTS_KEY).apply();
        call.resolve();
    }

    // Auth token va API base'ni SharedPreferences ga saqlash — MicService bu yerdan oqib
    // serverga heartbeat yuboradi (ilova yopiq bo'lganda ham).
    @PluginMethod
    public void saveAuth(PluginCall call) {
        String token = call.getString("token");
        String apiBase = call.getString("apiBase");
        SharedPreferences.Editor editor = prefs().edit();
        if (token != null) {
            editor.putString(PREFS_AUTH_TOKEN, token);
        } else {
            editor.remove(PREFS_AUTH_TOKEN);
        }
        editor.putString(PREFS_API_BASE, apiBase != null ? apiBase : "");
        editor.apply();
        call.resolve();
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        boolean ignoring = checkBatteryExempt();
        JSObject ret = new JSObject();
        ret.put("ignoring", ignoring);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Context ctx = getContext();
        if (checkBatteryExempt()) {
            JSObject ret = new JSObject();
            ret.put("alreadyExempt", true);
            call.resolve(ret);
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("alreadyExempt", false);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("battery exempt so'rovi: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("settings ochib bo'lmadi: " + e.getMessage());
        }
    }

    // Android 11+ "Auto-revoke": foydalanuvchi ilovani 3+ oy ishlatmasa, tizim
    // ruxsatlarni avtomatik o'chiradi. Mikrofon uchun bu falokat — exempt qilamiz.
    @PluginMethod
    public void disableAutoRevoke(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            // Android 10 va undan past — auto-revoke yo'q
            call.resolve();
            return;
        }
        try {
            Context ctx = getContext();
            // Foydalanuvchini Settings → App permissions ga jonatamiz
            // (Auto-revoke toggle shu yerda)
            Intent intent = new Intent(
                    "android.intent.action.AUTO_REVOKE_PERMISSIONS"
            );
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                ctx.startActivity(intent);
            } catch (Exception ignored) {
                // Action mavjud bo'lmasa, fallback — oddiy app settings
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + ctx.getPackageName()));
                fallback.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("auto-revoke o'chirib bolmadi: " + e.getMessage());
        }
    }

    private boolean checkBatteryExempt() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
    }

    @SuppressWarnings("deprecation")
    private boolean isServiceRunning(Class<?> serviceClass) {
        ActivityManager am = (ActivityManager) getContext()
                .getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return false;
        for (ActivityManager.RunningServiceInfo svc : am.getRunningServices(Integer.MAX_VALUE)) {
            if (serviceClass.getName().equals(svc.service.getClassName())) {
                return true;
            }
        }
        return false;
    }
}
