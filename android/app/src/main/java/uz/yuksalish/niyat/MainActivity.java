package uz.yuksalish.niyat;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebView;

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

        // WebView ichidagi JS getUserMedia / Web Audio so'rovlariga ruxsat
        // berish — ilova RECORD_AUDIO ga ega bo'lsa ham, WebView alohida
        // so'raydi. Bu override'siz Whisper STT (voice mode) ishlamaydi.
        //
        // Muhim: BridgeWebChromeClient'ni subclass qilamiz, oddiy
        // WebChromeClient bilan almashtirmaymiz. Aks holda Capacitor'ning
        // file chooser, geolocation prompt, JS dialog, console log
        // hooklari yo'qoladi.
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                @Override
                public void onPermissionRequest(PermissionRequest request) {
                    if (request != null) {
                        try {
                            // RECORD_AUDIO ilova darajasida grant qilingan
                            // bo'lsa, WebView so'roviga ham javob beramiz.
                            request.grant(request.getResources());
                            return;
                        } catch (Exception ignored) {}
                    }
                    super.onPermissionRequest(request);
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
