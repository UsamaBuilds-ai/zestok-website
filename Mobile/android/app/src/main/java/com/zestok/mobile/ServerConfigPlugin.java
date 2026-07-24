package com.zestok.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ServerConfig")
public class ServerConfigPlugin extends Plugin {

    private static final String PREFS_NAME = "ZestokPrefs";
    private static final String SERVER_URL_KEY = "serverUrl";

    @PluginMethod
    public void getServerUrl(PluginCall call) {
        String url = getContext().getSharedPreferences(PREFS_NAME, 0).getString(SERVER_URL_KEY, "");
        JSObject ret = new JSObject();
        ret.put("url", url);
        call.resolve(ret);
    }

    @PluginMethod
    public void setServerUrl(PluginCall call) {
        String url = call.getString("url");
        getContext().getSharedPreferences(PREFS_NAME, 0).edit().putString(SERVER_URL_KEY, url).apply();
        call.resolve();
    }

    @PluginMethod
    public void clearServerUrl(PluginCall call) {
        getContext().getSharedPreferences(PREFS_NAME, 0).edit().remove(SERVER_URL_KEY).apply();
        call.resolve();
    }
}
