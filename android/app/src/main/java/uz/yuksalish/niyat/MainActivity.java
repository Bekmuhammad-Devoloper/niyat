package uz.yuksalish.niyat;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebView;

import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    // Wake word (Niyat) tomonidan ochilgan bo'lsa — JS plugin instance shu
    // flagni tekshirib darhol "wakeWord" event'ini yuboradi va voice mode
    // avtomatik ochiladi. Static — Plugin yuklanguncha saqlanib turadi.
    public static volatile String pendingWakeWordText = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        handleWakeIntent(getIntent());
        // Niyat'ning custom plugin'lari — Capacitor super.onCreate'dan oldin
        // ro'yxatga olinishi shart. BackgroundMic — 24/7 orqa fon mikrofoni.
        // VoiceReminder — ilova yopiq bo'lsa ham AlarmManager + TTS bilan
        // ovozli reja eslatma chiqaradi. PhoneControl — telefon boshqaruv.
        registerPlugin(BackgroundMicPlugin.class);
        registerPlugin(VoiceReminderPlugin.class);
        registerPlugin(PhoneControlPlugin.class);
        super.onCreate(savedInstanceState);

        // WebView ichidagi JS getUserMedia / Web Audio so'rovlariga ruxsat.
        // Muhim: OS darajasida RECORD_AUDIO grant qilingan bo'lsa GINA
        // request.grant() qilamiz. Aks holda super.onPermissionRequest'ga
        // delegate qilamiz — BridgeWebChromeClient o'zi RECORD_AUDIO ni
        // OS dan so'raydi (dialog ko'rsatadi).
        //
        // Avval men har doim grant qilardim — bu RECORD_AUDIO yo'q paytda
        // ham WebView ruxsat olgan deb hisoblanardi, lekin AudioRecord OS
        // darajasida bloklangan edi → "Could not start audio source".
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                @Override
                public void onPermissionRequest(PermissionRequest request) {
                    if (request == null) {
                        super.onPermissionRequest(request);
                        return;
                    }
                    boolean needsAudio = false;
                    for (String r : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                            needsAudio = true;
                            break;
                        }
                    }
                    if (needsAudio) {
                        int granted = ContextCompat.checkSelfPermission(
                                MainActivity.this, Manifest.permission.RECORD_AUDIO);
                        if (granted != PackageManager.PERMISSION_GRANTED) {
                            // OS darajasida hali ruxsat yo'q — Capacitor'ning
                            // o'zi OS dialog ko'rsatishi uchun delegate qilamiz
                            super.onPermissionRequest(request);
                            return;
                        }
                    }
                    try {
                        request.grant(request.getResources());
                    } catch (Exception ignored) {
                        super.onPermissionRequest(request);
                    }
                }
            });
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleWakeIntent(intent);
        // Plugin allaqachon yuklangan — flagni o'qib JS event yuborish uchun
        // BackgroundMicPlugin.notifyWakeWordIfPending chaqirilishi kerak.
        // Buni Plugin'ning load()'ida + bu yerda yumshoq trigger qilamiz.
        try {
            BackgroundMicPlugin plugin =
                    (BackgroundMicPlugin) getBridge().getPlugin("BackgroundMic").getInstance();
            if (plugin != null) {
                plugin.notifyWakeWordIfPending();
            }
        } catch (Exception ignored) {}
    }

    private void handleWakeIntent(Intent intent) {
        if (intent == null) return;
        if (intent.getBooleanExtra("from_wake_word", false)) {
            String text = intent.getStringExtra("wake_text");
            pendingWakeWordText = text != null ? text : "(wake)";
        }
    }
}
