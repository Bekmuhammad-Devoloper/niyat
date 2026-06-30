// Native Android audio yozish plugin — WebView'ning getUserMedia / MediaRecorder
// API'sini chetlab o'tadi. Capacitor WebView'da getUserMedia ko'p Android
// qurilmalarida "Could not start audio source" xatosi qaytaradi, shuning
// uchun bu yerda biz Java tarafi MediaRecorder'ni to'g'ridan-to'g'ri ishlatamiz.
//
// API:
//   AudioCapture.startRecording()                    — mp4 fayl yozishni boshlaydi
//   AudioCapture.stopRecording() -> { audioBase64 }  — yozishni to'xtatib bytes qaytaradi
//   AudioCapture.cancelRecording()                   — bekor qiladi (faylni o'chiradi)
//   AudioCapture.isRecording() -> { recording }
//
// Audio formati: AAC (audio/mp4), 16 kHz mono — Whisper API uchun ideal.

package uz.yuksalish.niyat;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.MediaRecorder;
import android.os.Build;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;

@CapacitorPlugin(name = "AudioCapture")
public class AudioCapturePlugin extends Plugin {

    private MediaRecorder recorder;
    private File currentFile;
    private long startedAtMs;

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (ContextCompat.checkSelfPermission(
                getContext(), Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("mic_permission_denied");
            return;
        }
        if (recorder != null) {
            // Allaqachon yozyapti — eski sessiyani bekor qilamiz
            try { recorder.stop(); } catch (Exception ignored) {}
            try { recorder.release(); } catch (Exception ignored) {}
            recorder = null;
            if (currentFile != null && currentFile.exists()) currentFile.delete();
            currentFile = null;
        }

        // BackgroundMic ishlayotgan bo'lsa to'liq to'xtatamiz — aks holda
        // mikrofon band bo'ladi va MediaRecorder ishlamaydi.
        MicService svc = MicService.getInstance();
        if (svc != null) {
            try { svc.teardownRecognizer(); } catch (Exception ignored) {}
            try { svc.cancelWatchdog(); } catch (Exception ignored) {}
        }
        try {
            getContext().stopService(new android.content.Intent(getContext(), MicService.class));
        } catch (Exception ignored) {}
        // Sistema audio'ni ozod qilishi uchun qisqa pauza
        try { Thread.sleep(300); } catch (InterruptedException ignored) {}

        try {
            File dir = new File(getContext().getCacheDir(), "audio-capture");
            if (!dir.exists()) dir.mkdirs();
            currentFile = new File(dir, "rec-" + System.currentTimeMillis() + ".m4a");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                recorder = new MediaRecorder(getContext());
            } else {
                //noinspection deprecation
                recorder = new MediaRecorder();
            }
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            // Whisper uchun 16 kHz mono yetarli va fayl hajmini kichik tutadi
            recorder.setAudioSamplingRate(16000);
            recorder.setAudioChannels(1);
            recorder.setAudioEncodingBitRate(32000);
            recorder.setOutputFile(currentFile.getAbsolutePath());
            recorder.prepare();
            recorder.start();
            startedAtMs = System.currentTimeMillis();

            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("path", currentFile.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            cleanupAfterError();
            call.reject("startRecording failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        if (recorder == null || currentFile == null) {
            call.reject("not_recording");
            return;
        }
        try {
            try { recorder.stop(); } catch (RuntimeException ignored) {
                // MediaRecorder.stop() juda qisqa yozuvlarda RuntimeException
                // tashlaydi — bu nojo'ya emas
            }
            try { recorder.release(); } catch (Exception ignored) {}
            recorder = null;

            // Faylni o'qib base64 qilamiz
            if (!currentFile.exists() || currentFile.length() < 200) {
                if (currentFile.exists()) currentFile.delete();
                currentFile = null;
                call.reject("recording_too_short");
                return;
            }

            byte[] bytes = new byte[(int) currentFile.length()];
            FileInputStream fis = new FileInputStream(currentFile);
            int read = 0;
            while (read < bytes.length) {
                int r = fis.read(bytes, read, bytes.length - read);
                if (r < 0) break;
                read += r;
            }
            fis.close();
            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);

            long durationMs = System.currentTimeMillis() - startedAtMs;
            currentFile.delete();
            currentFile = null;

            JSObject ret = new JSObject();
            ret.put("audioBase64", base64);
            ret.put("mimeType", "audio/mp4");
            ret.put("durationMs", durationMs);
            ret.put("byteLength", bytes.length);
            call.resolve(ret);
        } catch (Exception e) {
            cleanupAfterError();
            call.reject("stopRecording failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelRecording(PluginCall call) {
        if (recorder != null) {
            try { recorder.stop(); } catch (Exception ignored) {}
            try { recorder.release(); } catch (Exception ignored) {}
            recorder = null;
        }
        if (currentFile != null && currentFile.exists()) {
            currentFile.delete();
        }
        currentFile = null;
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void isRecording(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("recording", recorder != null);
        call.resolve(ret);
    }

    private void cleanupAfterError() {
        if (recorder != null) {
            try { recorder.release(); } catch (Exception ignored) {}
            recorder = null;
        }
        if (currentFile != null && currentFile.exists()) currentFile.delete();
        currentFile = null;
    }

    @Override
    protected void handleOnDestroy() {
        cleanupAfterError();
        super.handleOnDestroy();
    }
}
