package com.zestok.mobile;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(ServerConfigPlugin.class);
        registerPlugin(DiscoveryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
