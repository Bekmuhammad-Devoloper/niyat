package uz.yuksalish.niyat;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Niyat'ning custom plugin'lari — Capacitor super.onCreate'dan oldin
        // ro'yxatga olinishi shart. BackgroundMic — 24/7 orqa fon mikrofoni.
        // VoiceReminder — ilova yopiq bo'lsa ham AlarmManager + TTS bilan
        // ovozli reja eslatma chiqaradi.
        registerPlugin(BackgroundMicPlugin.class);
        registerPlugin(VoiceReminderPlugin.class);
        registerPlugin(PhoneControlPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
