package fr.onizard.aleph;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Micro Bluetooth : bascule l'écoute sur le micro du kit voiture / des oreillettes (liaison « appel », SCO)
 * pendant que l'appli écoute, puis revient au son normal pour que la voix repasse en haute qualité.
 */
@CapacitorPlugin(name = "BtMic")
public class BtMic extends Plugin {
    private boolean active = false;

    private AudioManager am() {
        return (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public void on(PluginCall call) {
        JSObject r = new JSObject();
        AudioManager am = am();
        try {
            if (!active) {
                if (Build.VERSION.SDK_INT >= 31) {
                    AudioDeviceInfo sco = null;
                    for (AudioDeviceInfo d : am.getAvailableCommunicationDevices()) {
                        if (d.getType() == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) { sco = d; break; }
                    }
                    if (sco != null) {
                        am.setMode(AudioManager.MODE_IN_COMMUNICATION);
                        active = am.setCommunicationDevice(sco);
                        if (!active) am.setMode(AudioManager.MODE_NORMAL);
                    }
                } else if (am.isBluetoothScoAvailableOffCall() && am.isBluetoothA2dpOn()) {
                    am.setMode(AudioManager.MODE_IN_COMMUNICATION);
                    am.startBluetoothSco();
                    am.setBluetoothScoOn(true);
                    active = true;
                }
            }
        } catch (Exception e) {
            active = false;
        }
        r.put("bt", active);
        call.resolve(r);
    }

    @PluginMethod
    public void off(PluginCall call) {
        AudioManager am = am();
        try {
            if (active) {
                if (Build.VERSION.SDK_INT >= 31) am.clearCommunicationDevice();
                else { am.setBluetoothScoOn(false); am.stopBluetoothSco(); }
                am.setMode(AudioManager.MODE_NORMAL);
            }
        } catch (Exception e) { }
        active = false;
        call.resolve();
    }
}
