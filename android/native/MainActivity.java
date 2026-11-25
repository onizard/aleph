package fr.onizard.aleph;

import android.Manifest;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BtMic.class);
        super.onCreate(savedInstanceState);
        // micro (écoute) et Bluetooth (micro du kit voiture / des oreillettes) : demandés une fois au premier lancement
        String[] perms = Build.VERSION.SDK_INT >= 31
            ? new String[] { Manifest.permission.RECORD_AUDIO, Manifest.permission.BLUETOOTH_CONNECT }
            : new String[] { Manifest.permission.RECORD_AUDIO };
        ActivityCompat.requestPermissions(this, perms, 1);
    }
}
