package uz.yuksalish.niyat;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // BackgroundMicPlugin O'CHIRILGAN — orqa fon mikrofoni endi
        // ishlatilmaydi. Foydalanuvchi xavfsizligi va Android stabilligi uchun.
        super.onCreate(savedInstanceState);
    }
}
