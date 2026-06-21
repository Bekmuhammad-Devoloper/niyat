// Niyat AI'ning telefon boshqaruv plugin'i — JS tarafdan Android Intent
// orqali tashqi ilovalarni ochish, qo'ng'iroq qilish, SMS yuborish va
// alarm qo'yish.
//
// API:
//   PhoneControl.openApp({ name })       — ilova nomidan launch intent
//   PhoneControl.call({ target })        — tel:// intent (raqam yoki kontakt nomi)
//   PhoneControl.sms({ target, body })   — sms:// intent (matn bilan)
//   PhoneControl.setAlarm({ time, label })— ALARM_CLOCK intent (tizim soati)
//
// Eslatma: kontakt nomidan raqam qidirish uchun READ_CONTACTS ruxsati kerak.
// Hozircha "call" target = telefon raqami (formatlangan yoki olmagan).

package uz.yuksalish.niyat;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.provider.AlarmClock;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;
import java.util.Locale;

@CapacitorPlugin(name = "PhoneControl")
public class PhoneControlPlugin extends Plugin {

    @PluginMethod
    public void openApp(PluginCall call) {
        String name = call.getString("name");
        if (name == null || name.isEmpty()) {
            call.reject("name required");
            return;
        }
        Intent intent = findLaunchIntent(name);
        if (intent == null) {
            call.reject("app not found: " + name);
            return;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("launched", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("launch failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void call(PluginCall call) {
        String target = call.getString("target");
        if (target == null || target.isEmpty()) {
            call.reject("target required");
            return;
        }
        // ACTION_DIAL — terganni ko'rsatadi (ACTION_CALL avtomatik qo'ng'iroq
        // CALL_PHONE ruxsati shart). DIAL — foydalanuvchi tasdig'i bilan.
        Intent intent = new Intent(Intent.ACTION_DIAL);
        intent.setData(Uri.parse("tel:" + Uri.encode(target)));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("dial failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void sms(PluginCall call) {
        String target = call.getString("target");
        String body = call.getString("body", "");
        if (target == null || target.isEmpty()) {
            call.reject("target required");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_SENDTO);
        intent.setData(Uri.parse("smsto:" + Uri.encode(target)));
        if (body != null && !body.isEmpty()) {
            intent.putExtra("sms_body", body);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("sms failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setAlarm(PluginCall call) {
        String time = call.getString("time"); // HH:mm
        String label = call.getString("label", "Niyat eslatma");
        if (time == null || !time.matches("^\\d{1,2}:\\d{2}$")) {
            call.reject("time required as HH:mm");
            return;
        }
        String[] parts = time.split(":");
        int hour = Integer.parseInt(parts[0]);
        int minute = Integer.parseInt(parts[1]);
        Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM);
        intent.putExtra(AlarmClock.EXTRA_HOUR, hour);
        intent.putExtra(AlarmClock.EXTRA_MINUTES, minute);
        intent.putExtra(AlarmClock.EXTRA_MESSAGE, label);
        intent.putExtra(AlarmClock.EXTRA_SKIP_UI, false); // saat ilovasi ochiladi
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("alarm failed: " + e.getMessage());
        }
    }

    // ----- Yordamchi: ilova nomidan launch intent topish -----
    // Foydalanuvchi "Telegram", "YouTube", "Brauzer" kabi tabiiy nom yozadi.
    // Biz PackageManager'dan o'rnatilgan ilovalarni izlab, nomi yoki paket
    // ID'sida shu so'z bo'lgan birinchi mosini topamiz.
    private Intent findLaunchIntent(String name) {
        PackageManager pm = getContext().getPackageManager();
        String needle = name.toLowerCase(Locale.ROOT).trim();

        // Maxsus aliaslar — foydalanuvchi "telegram" desa org.telegram.messenger
        String[] aliasPkg = aliasToPackage(needle);
        for (String pkg : aliasPkg) {
            Intent i = pm.getLaunchIntentForPackage(pkg);
            if (i != null) return i;
        }

        // To'liq qidiruv — barcha launcher ilovalardan nom bo'yicha mos
        Intent mainIntent = new Intent(Intent.ACTION_MAIN, null);
        mainIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> apps = pm.queryIntentActivities(mainIntent, 0);
        for (ResolveInfo info : apps) {
            CharSequence labelCS = info.loadLabel(pm);
            String label = labelCS != null ? labelCS.toString().toLowerCase(Locale.ROOT) : "";
            String pkg = info.activityInfo.packageName.toLowerCase(Locale.ROOT);
            if (label.contains(needle) || pkg.contains(needle)) {
                Intent i = pm.getLaunchIntentForPackage(info.activityInfo.packageName);
                if (i != null) return i;
            }
        }
        return null;
    }

    private String[] aliasToPackage(String needle) {
        switch (needle) {
            case "telegram":
            case "telegramm":
                return new String[]{"org.telegram.messenger", "org.thunderdog.challegram"};
            case "whatsapp":
            case "vatsap":
            case "vatsapp":
                return new String[]{"com.whatsapp"};
            case "youtube":
            case "yt":
                return new String[]{"com.google.android.youtube", "com.google.android.apps.youtube.music"};
            case "instagram":
            case "insta":
                return new String[]{"com.instagram.android"};
            case "browser":
            case "brauzer":
            case "chrome":
                return new String[]{"com.android.chrome", "com.google.android.googlequicksearchbox"};
            case "gmail":
            case "mail":
            case "pochta":
                return new String[]{"com.google.android.gm"};
            case "maps":
            case "xarita":
                return new String[]{"com.google.android.apps.maps", "ru.yandex.yandexmaps"};
            case "kalkulyator":
            case "calculator":
                return new String[]{"com.google.android.calculator", "com.android.calculator2"};
            case "kamera":
            case "camera":
                return new String[]{"com.android.camera", "com.android.camera2", "com.google.android.GoogleCamera"};
            case "soat":
            case "clock":
            case "alarm":
                return new String[]{"com.google.android.deskclock", "com.android.deskclock"};
            case "sozlamalar":
            case "settings":
                return new String[]{"com.android.settings"};
            case "musiqa":
            case "music":
                return new String[]{"com.google.android.apps.youtube.music", "com.spotify.music"};
            default:
                return new String[]{};
        }
    }
}
