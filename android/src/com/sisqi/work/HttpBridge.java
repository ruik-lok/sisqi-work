package com.sisqi.work;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 原生 HTTP 桥：WebView 里向第三方 LLM 端点发请求会被 CORS 拦截（供应商不返回 ACAO），
 * 所以流式对话和 /models 都走这里，由 Java 发请求、逐行把 SSE 数据回吐给页面。
 * 只允许 http(s)，不做任何本地文件/命令能力。
 */
final class HttpBridge {
    private static final String TAG = "SISQI";
    private final WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ConcurrentHashMap<String, HttpURLConnection> live = new ConcurrentHashMap<>();
    private final AtomicInteger seq = new AtomicInteger();

    HttpBridge(WebView web) {
        this.web = web;
    }

    private boolean allowed(String url) {
        if (url == null) return false;
        String u = url.toLowerCase();
        return u.startsWith("https://") || u.startsWith("http://");
    }

    private void emit(String id, String kind, String status, String payload) {
        final String js = "window.__sisqiHttp&&window.__sisqiHttp("
                + JSONObject.quote(id) + "," + JSONObject.quote(kind) + ","
                + (status == null ? "null" : JSONObject.quote(status)) + ","
                + JSONObject.quote(payload == null ? "" : payload) + ")";
        ui.post(new Runnable() {
            public void run() {
                try {
                    web.evaluateJavascript(js, null);
                } catch (Exception ignore) {
                }
            }
        });
    }

    @JavascriptInterface
    public void httpStream(final String id, final String url, final String auth, final String body) {
        if (!allowed(url)) {
            emit(id, "error", "0", "只支持 http(s) 地址");
            return;
        }
        Thread t = new Thread(new Runnable() {
            public void run() {
                runStream(id, url, auth, body);
            }
        }, "sisqi-http-" + seq.incrementAndGet());
        t.start();
    }

    private void runStream(String id, String url, String auth, String body) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            live.put(id, c);
            c.setRequestMethod("POST");
            c.setConnectTimeout(20000);
            c.setReadTimeout(180000);
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("Accept", "text/event-stream");
            if (auth != null && !auth.isEmpty()) c.setRequestProperty("Authorization", auth);
            OutputStream os = c.getOutputStream();
            os.write(body.getBytes(StandardCharsets.UTF_8));
            os.flush();
            os.close();

            int code = c.getResponseCode();
            if (code < 200 || code >= 300) {
                emit(id, "error", String.valueOf(code), readAll(c.getErrorStream()));
                return;
            }
            BufferedReader br = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8));
            String line;
            while ((line = br.readLine()) != null) {
                if (live.get(id) != c) break;
                String t = line.trim();
                if (t.startsWith("data:")) emit(id, "data", null, t.substring(5).trim());
            }
            br.close();
            emit(id, "end", null, "");
        } catch (Exception e) {
            if (live.get(id) != c) return; // 用户主动取消
            emit(id, "error", "0", e.getClass().getSimpleName() + ": " + e.getMessage());
        } finally {
            live.remove(id);
            if (c != null) {
                try {
                    c.disconnect();
                } catch (Exception ignore) {
                }
            }
        }
    }

    @JavascriptInterface
    public void httpCancel(String id) {
        HttpURLConnection c = live.remove(id);
        if (c != null) {
            try {
                c.disconnect();
            } catch (Exception ignore) {
            }
        }
    }

    /** 同步请求（连接测试 / 拉模型列表）：返回 {"status":200,"body":"..."} 或 {"error":"..."} */
    @JavascriptInterface
    public String httpRequest(String method, String url, String auth, String body) {
        if (!allowed(url)) return "{\"error\":\"只支持 http(s) 地址\"}";
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setRequestMethod("GET".equalsIgnoreCase(method) ? "GET" : "POST");
            c.setConnectTimeout(20000);
            c.setReadTimeout(60000);
            if (auth != null && !auth.isEmpty()) c.setRequestProperty("Authorization", auth);
            if (body != null && !body.isEmpty()) {
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                OutputStream os = c.getOutputStream();
                os.write(body.getBytes(StandardCharsets.UTF_8));
                os.flush();
                os.close();
            }
            int code = c.getResponseCode();
            String text = readAll(code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream());
            JSONObject out = new JSONObject();
            out.put("status", code);
            out.put("body", text == null ? "" : text);
            return out.toString();
        } catch (Exception e) {
            Log.w(TAG, "httpRequest failed: " + e);
            try {
                return new JSONObject().put("error", e.getClass().getSimpleName() + ": " + e.getMessage()).toString();
            } catch (Exception ignore) {
                return "{\"error\":\"request failed\"}";
            }
        } finally {
            if (c != null) {
                try {
                    c.disconnect();
                } catch (Exception ignore) {
                }
            }
        }
    }

    private static String readAll(InputStream is) throws IOException {
        if (is == null) return "";
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
        return new String(bos.toByteArray(), StandardCharsets.UTF_8);
    }
}