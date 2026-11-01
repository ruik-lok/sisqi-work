package com.sisqi.work;

import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Build;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String TAG = "SISQI";
    private static final String ORIGIN = "https://appassets.local";
    private static final boolean DEBUG_AUDIT = true;
    private WebView web;
    private SecretStore secrets;
    private volatile boolean finished = false;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        // 页面来自 assets：禁用缓存，升级 APK 后不会再跑到旧的 index.html / JS
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.setBackgroundColor(Color.parseColor("#0C1422"));
        // 状态栏/导航栏跟随页面主题：页面里的 index.html 会在主题变化时调用 SisqiHost.setChrome('light'|'dark')
        secrets = new SecretStore(this);
        web.addJavascriptInterface(new Host(), "SisqiHost");
        web.addJavascriptInterface(new HttpBridge(web), "SisqiHttp");
        applyChrome(!systemInNightMode());

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                String path = r.getUrl().getPath();
                Log.i(TAG, "req " + r.getUrl());
                if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
                return serve(path);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                // 只允许留在应用内页面，外部链接不接管（避免页面被导航到第三方站点后滥用原生桥）
                String u = r.getUrl().toString();
                return !u.startsWith(ORIGIN);
            }

            @Override
            public void onPageStarted(WebView v, String u, Bitmap f) {
                Log.i(TAG, "pageStarted " + u);
            }

            @Override
            public void onPageFinished(WebView v, String u) {
                finished = true;
                Log.i(TAG, "pageFinished " + u);
                v.evaluateJavascript("JSON.stringify({root:(document.getElementById('root')||{}).childElementCount||0,body:(document.body?document.body.innerHTML.length:-1)})", null);
                if (DEBUG_AUDIT) {
                    try {
                        java.io.InputStream is = getAssets().open("www/audit.js");
                        ByteArrayOutputStream bos = new ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
                        is.close();
                        v.evaluateJavascript(new String(bos.toByteArray(), "UTF-8"), null);
                    } catch (Exception e) {
                        Log.e(TAG, "audit " + e);
                    }
                }
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                Log.e(TAG, "err " + r.getUrl() + " code=" + e.getErrorCode() + " " + e.getDescription());
            }

            @Override
            public void onReceivedHttpError(WebView v, WebResourceRequest r, WebResourceResponse er) {
                Log.e(TAG, "httpErr " + r.getUrl() + " " + er.getStatusCode());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i(TAG, "console " + m.messageLevel() + ": " + m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });

        setContentView(web);
        // 说明：ColorOS 下做边到边（setDecorFitsSystemWindows(false) + 透明状态栏）会让状态栏变黑、图标消失，
        // 因此这里保持系统栏不透明，只把系统栏颜色改成与页面背景一致，并同步图标明暗；页面不再自行预留状态栏高度。
        web.loadUrl(ORIGIN + "/index.html?native=1");

        ui.postDelayed(new Runnable() {
            public void run() {
                if (finished) return;
                Log.e(TAG, "TIMEOUT -> loadDataWithBaseURL fallback");
                try {
                    InputStream is = getAssets().open("www/index.html");
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
                    is.close();
                    web.loadDataWithBaseURL(ORIGIN + "/", new String(bos.toByteArray(), "UTF-8"), "text/html", "UTF-8", null);
                } catch (Exception e) {
                    Log.e(TAG, "fallback " + e);
                }
            }
        }, 6000);
    }

    /** 页面桥：系统栏配色 + 加密凭据存储，不暴露任何 shell / 文件能力 */
    private class Host {
        @JavascriptInterface
        public void setChrome(String theme) {
            boolean light;
            if ("light".equals(theme)) light = true;
            else if ("dark".equals(theme)) light = false;
            else light = !systemInNightMode();
            applyChrome(light);
        }

        @JavascriptInterface
        public String secretBackend() {
            return "android-keystore-aes-gcm";
        }

        @JavascriptInterface
        public boolean setSecret(String id, String value) {
            return secrets.set(id, value);
        }

        @JavascriptInterface
        public String getSecret(String id) {
            return secrets.get(id);
        }

        @JavascriptInterface
        public void deleteSecret(String id) {
            secrets.delete(id);
        }
    }

    private boolean systemInNightMode() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    private void applyChrome(boolean light) {
        final int bg = Color.parseColor(light ? "#F4F7FC" : "#0C1422");
        final int nav = Color.parseColor(light ? "#FFFFFF" : "#121E30");
        runOnUiThread(new Runnable() {
            public void run() {
                Window w = getWindow();
                w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                w.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
                w.setStatusBarColor(bg);
                w.setNavigationBarColor(nav);
                w.setBackgroundDrawable(new ColorDrawable(bg));
                if (web != null) web.setBackgroundColor(bg);
                View decor = w.getDecorView();
                int vis = decor.getSystemUiVisibility();
                vis |= View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
                if (Build.VERSION.SDK_INT >= 23) {
                    if (light) vis |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                    else vis &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                }
                if (Build.VERSION.SDK_INT >= 26) {
                    if (light) vis |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    else vis &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
                decor.setSystemUiVisibility(vis);
            }
        });
    }

    private WebResourceResponse serve(String path) {
        String rel = "www" + path;
        try {
            InputStream is = getAssets().open(rel);
            String mime = "application/octet-stream";
            if (rel.endsWith(".html")) mime = "text/html";
            else if (rel.endsWith(".js")) mime = "application/javascript";
            else if (rel.endsWith(".css")) mime = "text/css";
            else if (rel.endsWith(".svg")) mime = "image/svg+xml";
            else if (rel.endsWith(".png")) mime = "image/png";
            else if (rel.endsWith(".jpg")) mime = "image/jpeg";
            else if (rel.endsWith(".woff2")) mime = "font/woff2";
            else if (rel.endsWith(".woff")) mime = "font/woff";
            else if (rel.endsWith(".json")) mime = "application/json";
            Map<String, String> h = new HashMap<String, String>();
            h.put("Access-Control-Allow-Origin", "*");
            h.put("Cache-Control", "no-store");
            WebResourceResponse r = new WebResourceResponse(mime, "UTF-8", is);
            r.setResponseHeaders(h);
            return r;
        } catch (IOException e) {
            Log.e(TAG, "404 " + rel);
            return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("404".getBytes()));
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}