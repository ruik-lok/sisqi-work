package com.sisqi.work;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Root 命令桥：通过 KernelSU/Magisk 的 su 执行 shell 命令，供页面里的 Agent 工具调用。
 * 只能在应用内页面使用（WebView 只加载本地 assets，且禁止外链导航）。
 */
final class ShellBridge {
    private static final String TAG = "SISQI";
    private static final int MAX_OUTPUT = 256 * 1024;
    private final WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final AtomicInteger seq = new AtomicInteger();

    ShellBridge(WebView web) {
        this.web = web;
    }

    @JavascriptInterface
    public void shellRun(final String id, final String cmd, final int timeoutMs) {
        Thread t = new Thread(new Runnable() {
            public void run() {
                execute(id, cmd, timeoutMs <= 0 ? 20000 : timeoutMs);
            }
        }, "sisqi-shell-" + seq.incrementAndGet());
        t.setDaemon(true);
        t.start();
    }

    private void execute(String id, String cmd, int timeoutMs) {
        JSONObject o = new JSONObject();
        Process p = null;
        try {
            p = new ProcessBuilder("su", "-c", cmd).redirectErrorStream(false).start();
            final InputStream out = p.getInputStream();
            final InputStream err = p.getErrorStream();
            final ByteArrayOutputStream bo = new ByteArrayOutputStream();
            final ByteArrayOutputStream be = new ByteArrayOutputStream();
            Thread to = new Thread(new Runnable() {
                public void run() {
                    copy(out, bo);
                }
            });
            Thread te = new Thread(new Runnable() {
                public void run() {
                    copy(err, be);
                }
            });
            to.start();
            te.start();
            to.join(timeoutMs);
            te.join(Math.max(1000, timeoutMs / 4));
            if (to.isAlive()) {
                p.destroy();
                o.put("timeout", true);
            }
            int code = -1;
            try {
                code = p.waitFor();
            } catch (Exception ignore) {
            }
            o.put("code", code);
            o.put("out", trim(bo));
            o.put("err", trim(be));
        } catch (Exception e) {
            Log.w(TAG, "shell failed: " + e);
            try {
                o.put("code", -1);
                o.put("err", e.getClass().getSimpleName() + ": " + e.getMessage());
            } catch (Exception ignore) {
            }
        } finally {
            if (p != null) {
                try {
                    p.destroy();
                } catch (Exception ignore) {
                }
            }
        }
        emit(id, o.toString());
    }

    private static String trim(ByteArrayOutputStream bos) {
        String s = new String(bos.toByteArray(), StandardCharsets.UTF_8);
        if (s.length() > MAX_OUTPUT) return s.substring(0, MAX_OUTPUT) + "\n…(truncated)";
        return s;
    }

    private static void copy(InputStream is, ByteArrayOutputStream bos) {
        try {
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) > 0) {
                if (bos.size() > MAX_OUTPUT) break;
                bos.write(buf, 0, n);
            }
        } catch (Exception ignore) {
        }
    }

    private void emit(String id, String json) {
        // json 必须作为「字符串」传过去：页面里是 JSON.parse(json)，
        // 直接拼对象字面量会让 JSON.parse 收到对象而抛错（"返回解析失败"）。
        final String js = "window.__sisqiShell&&window.__sisqiShell(" + JSONObject.quote(id) + "," + JSONObject.quote(json) + ")";
        ui.post(new Runnable() {
            public void run() {
                try {
                    if (web != null) web.evaluateJavascript(js, null);
                } catch (Exception ignore) {
                }
            }
        });
    }
}