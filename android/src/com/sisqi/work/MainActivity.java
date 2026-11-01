package com.sisqi.work;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Intent;
import android.content.res.Configuration;
import android.database.Cursor;
import android.provider.DocumentsContract;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.text.TextUtils;
import android.util.Base64;
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

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String TAG = "SISQI";
    private static final String ORIGIN = "https://appassets.local";
    private static final boolean DEBUG_AUDIT = true;
    private static final int REQ_PICK = 4711;
    private static final int REQ_TREE = 4712;
    private String pickId;
    private String treeId;
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
        web.setBackgroundColor(Color.parseColor("#191A1E"));
        // 状态栏/导航栏跟随页面主题：页面里的 index.html 会在主题变化时调用 SisqiHost.setChrome('light'|'dark')
        secrets = new SecretStore(this);
        web.addJavascriptInterface(new Host(), "SisqiHost");
        web.addJavascriptInterface(new HttpBridge(web), "SisqiHttp");
        web.addJavascriptInterface(new ShellBridge(web), "SisqiShell");
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

        /** 真实设备信息（设置页展示，替代"待检测"） */
        @JavascriptInterface
        public String deviceInfo() {
            try {
                JSONObject o = new JSONObject();
                o.put("model", Build.MODEL);
                o.put("brand", Build.BRAND);
                o.put("manufacturer", Build.MANUFACTURER);
                o.put("android", Build.VERSION.RELEASE);
                o.put("sdk", Build.VERSION.SDK_INT);
                o.put("abis", TextUtils.join(",", Build.SUPPORTED_ABIS));
                o.put("cores", Runtime.getRuntime().availableProcessors());
                ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
                ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
                if (am != null) {
                    am.getMemoryInfo(mi);
                    o.put("totalRamMb", mi.totalMem / (1024 * 1024));
                    o.put("availRamMb", mi.availMem / (1024 * 1024));
                }
                o.put("suBinary", new java.io.File("/system/bin/su").exists() || new java.io.File("/system/xbin/su").exists());
                return o.toString();
            } catch (Exception e) {
                Log.w(TAG, "deviceInfo failed: " + e);
                return "{}";
            }
        }

        /** 选择项目文件夹（SAF 目录授权，持久化读取权限） */
        @JavascriptInterface
        public void pickFolder(String id) {
            treeId = id;
            try {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                startActivityForResult(i, REQ_TREE);
            } catch (Exception e) {
                Log.w(TAG, "pickFolder failed: " + e);
                emitFolder(id, "null");
            }
        }

        /** 刷新目录（docId 为空表示根目录） */
        @JavascriptInterface
        public void listFolder(String id, String treeUri, String docId) {
            try {
                emitFolder(id, listTreeJson(Uri.parse(treeUri), docId));
            } catch (Exception e) {
                Log.w(TAG, "listFolder failed: " + e);
                emitFolder(id, "null");
            }
        }

        /** 按相对路径读取目录内的文本文件（如 .git/HEAD），用于读取仓库信息 */
        @JavascriptInterface
        public void readPath(String id, String treeUri, String path) {
            try {
                Uri tree = Uri.parse(treeUri);
                String docId = DocumentsContract.getTreeDocumentId(tree);
                for (String seg : path.split("/")) {
                    if (seg.isEmpty()) continue;
                    docId = childDocId(tree, docId, seg);
                    if (docId == null) {
                        emitDoc(id, "null");
                        return;
                    }
                }
                Uri doc = DocumentsContract.buildDocumentUriUsingTree(tree, docId);
                InputStream is = getContentResolver().openInputStream(doc);
                if (is == null) throw new IOException("no stream");
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n, total = 0;
                while ((n = is.read(buf)) > 0 && total < 512 * 1024) {
                    bos.write(buf, 0, n);
                    total += n;
                }
                is.close();
                JSONObject o = new JSONObject();
                o.put("text", new String(bos.toByteArray(), StandardCharsets.UTF_8));
                emitDoc(id, o.toString());
            } catch (Exception e) {
                Log.w(TAG, "readPath failed: " + e);
                emitDoc(id, "null");
            }
        }

        /** 按相对路径读取二进制文件（base64），用于 .git/index */
        @JavascriptInterface
        public void readPathB64(String id, String treeUri, String path) {
            try {
                Uri tree = Uri.parse(treeUri);
                String docId = DocumentsContract.getTreeDocumentId(tree);
                for (String seg : path.split("/")) {
                    if (seg.isEmpty()) continue;
                    docId = childDocId(tree, docId, seg);
                    if (docId == null) {
                        emitDoc(id, "null");
                        return;
                    }
                }
                Uri doc = DocumentsContract.buildDocumentUriUsingTree(tree, docId);
                InputStream is = getContentResolver().openInputStream(doc);
                if (is == null) throw new IOException("no stream");
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n, total = 0;
                while ((n = is.read(buf)) > 0 && total < 4 * 1024 * 1024) {
                    bos.write(buf, 0, n);
                    total += n;
                }
                is.close();
                JSONObject o = new JSONObject();
                o.put("b64", Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP));
                emitDoc(id, o.toString());
            } catch (Exception e) {
                Log.w(TAG, "readPathB64 failed: " + e);
                emitDoc(id, "null");
            }
        }

        /** 按相对路径列目录（path 为空表示根），用于扫描工作区状态 */
        @JavascriptInterface
        public void listPath(String id, String treeUri, String path) {
            try {
                Uri tree = Uri.parse(treeUri);
                String docId = DocumentsContract.getTreeDocumentId(tree);
                if (path != null && !path.isEmpty()) {
                    for (String seg : path.split("/")) {
                        if (seg.isEmpty()) continue;
                        docId = childDocId(tree, docId, seg);
                        if (docId == null) {
                            emitFolder(id, "null");
                            return;
                        }
                    }
                }
                emitFolder(id, listTreeJson(tree, docId));
            } catch (Exception e) {
                Log.w(TAG, "listPath failed: " + e);
                emitFolder(id, "null");
            }
        }

        /** 在指定目录下按名字找子项，返回 docId（找不到返回 null） */
        private String childDocId(Uri tree, String parentDocId, String name) {
            Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentDocId);
            String[] cols = new String[]{
                    DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            };
            Cursor c = getContentResolver().query(children, cols, null, null, null);
            if (c == null) return null;
            try {
                while (c.moveToNext()) {
                    if (name.equals(c.getString(1))) return c.getString(0);
                }
            } finally {
                c.close();
            }
            return null;
        }

        /** 读取文本文件内容（上限 256KB） */
        @JavascriptInterface
        public void readDoc(String id, String treeUri, String docId) {
            try {
                Uri doc = DocumentsContract.buildDocumentUriUsingTree(Uri.parse(treeUri), docId);
                InputStream is = getContentResolver().openInputStream(doc);
                if (is == null) throw new IOException("no stream");
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n, total = 0;
                while ((n = is.read(buf)) > 0 && total < 256 * 1024) {
                    bos.write(buf, 0, n);
                    total += n;
                }
                is.close();
                JSONObject o = new JSONObject();
                o.put("text", new String(bos.toByteArray(), StandardCharsets.UTF_8));
                o.put("truncated", total >= 256 * 1024);
                emitDoc(id, o.toString());
            } catch (Exception e) {
                Log.w(TAG, "readDoc failed: " + e);
                emitDoc(id, "null");
            }
        }

        /** 系统文件选择器：图片给 dataUrl，文本给 text（沙盒内安全读取，不需要存储权限） */
        @JavascriptInterface
        public void pickFile(String id, String mime) {
            pickId = id;
            try {
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(mime == null || mime.isEmpty() ? "*/*" : mime);
                startActivityForResult(Intent.createChooser(i, "选择文件"), REQ_PICK);
            } catch (Exception e) {
                Log.w(TAG, "pickFile failed: " + e);
                emitFile(id, "null");
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_TREE) {
            String id = treeId;
            treeId = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null) {
                emitFolder(id, "null");
                return;
            }
            Uri tree = data.getData();
            try {
                getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (Exception e) {
                Log.w(TAG, "takePersistableUriPermission failed: " + e);
            }
            try {
                emitFolder(id, listTreeJson(tree, null));
            } catch (Exception e) {
                Log.w(TAG, "list picked tree failed: " + e);
                emitFolder(id, "null");
            }
            return;
        }
        if (requestCode != REQ_PICK) return;
        String id = pickId;
        pickId = null;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            emitFile(id, "null");
            return;
        }
        Uri uri = data.getData();
        try {
            String name = null;
            long size = -1;
            String mime = getContentResolver().getType(uri);
            Cursor c = getContentResolver().query(uri, null, null, null, null);
            if (c != null) {
                if (c.moveToFirst()) {
                    int ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    int si = c.getColumnIndex(OpenableColumns.SIZE);
                    if (ni >= 0) name = c.getString(ni);
                    if (si >= 0 && !c.isNull(si)) size = c.getLong(si);
                }
                c.close();
            }
            JSONObject o = new JSONObject();
            o.put("name", name == null ? "file" : name);
            o.put("mime", mime == null ? "application/octet-stream" : mime);
            o.put("size", size);

            if (mime != null && mime.startsWith("image/")) {
                if (size > 1536L * 1024) {
                    o.put("tooLarge", true);
                } else {
                    byte[] bytes = readBytes(uri);
                    o.put("dataUrl", "data:" + mime + ";base64," + Base64.encodeToString(bytes, Base64.NO_WRAP));
                }
            } else if (isTextLike(mime) && size <= 512L * 1024) {
                byte[] bytes = readBytes(uri);
                o.put("text", new String(bytes, StandardCharsets.UTF_8));
            }
            emitFile(id, o.toString());
        } catch (Exception e) {
            Log.w(TAG, "read picked file failed: " + e);
            emitFile(id, "null");
        }
    }

    private String listTreeJson(Uri tree, String docId) throws Exception {
        String rootDocId = docId == null || docId.isEmpty() ? DocumentsContract.getTreeDocumentId(tree) : docId;
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, rootDocId);
        String[] cols = new String[]{
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
                DocumentsContract.Document.COLUMN_SIZE,
                DocumentsContract.Document.COLUMN_LAST_MODIFIED,
        };
        Cursor c = getContentResolver().query(children, cols, null, null, null);
        JSONObject root = new JSONObject();
        root.put("uri", tree.toString());
        root.put("docId", rootDocId);
        org.json.JSONArray arr = new org.json.JSONArray();
        String folderName = "";
        if (c != null) {
            while (c.moveToNext() && arr.length() < 400) {
                String did = c.getString(0);
                String name = c.getString(1);
                String mime = c.getString(2);
                long size = c.isNull(3) ? -1 : c.getLong(3);
                long lm = c.isNull(4) ? 0 : c.getLong(4);
                boolean dir = "vnd.android.document/directory".equals(mime);
                if (did.equals(rootDocId) && name != null) folderName = name;
                JSONObject f = new JSONObject();
                f.put("name", name == null ? did : name);
                f.put("docId", did);
                f.put("mime", mime == null ? "" : mime);
                f.put("size", size);
                f.put("lastModified", lm);
                f.put("dir", dir);
                arr.put(f);
            }
            c.close();
        }
        if (folderName.isEmpty()) {
            try {
                Uri self = DocumentsContract.buildDocumentUriUsingTree(tree, rootDocId);
                Cursor sc = getContentResolver().query(self, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null);
                if (sc != null) {
                    if (sc.moveToFirst()) folderName = sc.getString(0);
                    sc.close();
                }
            } catch (Exception ignore) {
            }
        }
        root.put("name", folderName);
        root.put("files", arr);
        return root.toString();
    }

    private void emitFolder(String id, String json) {
        if (id == null) return;
        final String js = "window.__sisqiFolder&&window.__sisqiFolder(" + JSONObject.quote(id) + "," + json + ")";
        runOnUiThread(new Runnable() {
            public void run() {
                try {
                    if (web != null) web.evaluateJavascript(js, null);
                } catch (Exception ignore) {
                }
            }
        });
    }

    private void emitDoc(String id, String json) {
        if (id == null) return;
        final String js = "window.__sisqiDoc&&window.__sisqiDoc(" + JSONObject.quote(id) + "," + json + ")";
        runOnUiThread(new Runnable() {
            public void run() {
                try {
                    if (web != null) web.evaluateJavascript(js, null);
                } catch (Exception ignore) {
                }
            }
        });
    }

    private static boolean isTextLike(String mime) {
        if (mime == null) return false;
        return mime.startsWith("text/") || mime.contains("json") || mime.contains("xml") || mime.contains("javascript") || mime.contains("yaml");
    }

    private byte[] readBytes(Uri uri) throws IOException {
        InputStream is = getContentResolver().openInputStream(uri);
        if (is == null) throw new IOException("no stream");
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
        is.close();
        return bos.toByteArray();
    }

    private void emitFile(String id, String json) {
        if (id == null) return;
        final String js = "window.__sisqiFile&&window.__sisqiFile(" + JSONObject.quote(id) + "," + json + ")";
        runOnUiThread(new Runnable() {
            public void run() {
                try {
                    if (web != null) web.evaluateJavascript(js, null);
                } catch (Exception ignore) {
                }
            }
        });
    }

    private boolean systemInNightMode() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    private void applyChrome(boolean light) {
        final int bg = Color.parseColor(light ? "#FFFFFF" : "#191A1E");
        final int nav = Color.parseColor(light ? "#FFFFFF" : "#202127");
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