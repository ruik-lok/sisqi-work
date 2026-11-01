package com.sisqi.hud;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.Map;

/**
 * DSH HUD（流体云版）：只用 Android 16 的“实时更新”通知做状态播报，
 * ColorOS 会把它渲染成状态栏流体云。不创建任何悬浮窗。
 *
 * 接口：127.0.0.1:8765/act?type=status|tap|swipe|done&text=人话&x=..
 */
public class HudService extends Service {
    public static volatile boolean isRunning = false;
    private static final String CH = "hud";
    private static final int PORT = 8765;
    private static final int NOTIF_ID = 3;

    private NotificationManager nm;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private ServerSocket server;
    private volatile boolean running = false;

    private String cloudText = "DSH 就绪";
    private long lastEventAt = SystemClock.uptimeMillis();
    private long lastCloudAt = 0;
    private Runnable pendingCloud;

    /** 心跳：有活动时每 20s 续一次，30s 无事件就撤掉流体云 */
    private final Runnable heartbeat = new Runnable() {
        public void run() {
            long idle = SystemClock.uptimeMillis() - lastEventAt;
            if (idle <= 30000) {
                pushCloudNow();
                ui.postDelayed(this, 20000);
            } else {
                try {
                    nm.cancel(NOTIF_ID);
                } catch (Throwable ignore) {
                }
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        startForeground(1, buildNotification("DSH HUD 运行中", "监听 127.0.0.1:" + PORT));
        isRunning = true;
        status("DSH 就绪");
        ui.postDelayed(heartbeat, 20000);
        startServer();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        isRunning = false;
        try {
            if (server != null) server.close();
        } catch (Exception ignore) {
        }
        super.onDestroy();
    }

    /* ------------------------------------------------------------ 状态 */

    /** 状态变化：合并到 ~900ms 一次推给流体云（系统本身还有一层节流） */
    private void status(String text) {
        cloudText = text;
        lastEventAt = SystemClock.uptimeMillis();
        if (pendingCloud != null) ui.removeCallbacks(pendingCloud);
        long wait = Math.max(0, 900 - (SystemClock.uptimeMillis() - lastCloudAt));
        pendingCloud = new Runnable() {
            public void run() {
                pendingCloud = null;
                pushCloudNow();
            }
        };
        ui.postDelayed(pendingCloud, wait);
    }

    private void pushCloudNow() {
        lastCloudAt = SystemClock.uptimeMillis();
        if (nm == null) return;
        try {
            nm.notify(NOTIF_ID, buildPromoted(cloudText));
        } catch (Throwable e) {
            Log.w("HUD", "promote failed: " + e);
        }
    }

    private void hideCloud() {
        try {
            nm.cancel(NOTIF_ID);
        } catch (Throwable ignore) {
        }
    }

    /* ------------------------------------------------------------ http */

    private void startServer() {
        running = true;
        Thread t = new Thread(new Runnable() {
            public void run() {
                try {
                    server = new ServerSocket(PORT, 8, InetAddress.getByName("127.0.0.1"));
                    while (running) {
                        final Socket s = server.accept();
                        // 每个连接单独线程 + 读超时：避免一个半开连接把 accept 循环卡死
                        new Thread(new Runnable() {
                            public void run() {
                                try {
                                    s.setSoTimeout(5000);
                                    handle(s);
                                } catch (Exception e) {
                                    Log.w("HUD", "handle: " + e);
                                } finally {
                                    try {
                                        s.close();
                                    } catch (Exception ignore) {
                                    }
                                }
                            }
                        }, "hud-conn").start();
                    }
                } catch (Exception e) {
                    Log.w("HUD", "server: " + e);
                }
            }
        }, "hud-http");
        t.setDaemon(true);
        t.start();
    }

    private void handle(Socket s) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), "UTF-8"));
        String line = in.readLine();
        if (line == null) return;
        String[] parts = line.split(" ");
        String path = parts.length > 1 ? parts[1] : "/";
        Map<String, String> q = new HashMap<String, String>();
        int qi = path.indexOf('?');
        if (qi >= 0) {
            for (String kv : path.substring(qi + 1).split("&")) {
                int eq = kv.indexOf('=');
                if (eq > 0) q.put(kv.substring(0, eq), URLDecoder.decode(kv.substring(eq + 1), "UTF-8"));
            }
            path = path.substring(0, qi);
        }
        if (!"/act".equals(path) && !"/".equals(path)) {
            respond(s, "unknown");
            return;
        }
        String type = q.get("type");
        String text = q.get("text");
        if (type == null) type = "status";
        if ("tap".equals(type)) {
            status(text != null && !text.isEmpty() ? text : "点击");
        } else if ("swipe".equals(type)) {
            status(text != null && !text.isEmpty() ? text : "滑动");
        } else if ("done".equals(type)) {
            status(text != null && !text.isEmpty() ? text : "任务完成");
            lastEventAt = SystemClock.uptimeMillis();
        } else if ("hide".equals(type)) {
            hideCloud();
        } else {
            status(text != null && !text.isEmpty() ? text : "DSH 操作中");
        }
        respond(s, "ok");
    }

    private void respond(Socket s, String body) {
        try {
            OutputStream os = s.getOutputStream();
            byte[] b = body.getBytes("UTF-8");
            String head = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: " + b.length
                    + "\r\nConnection: close\r\n\r\n";
            os.write(head.getBytes("UTF-8"));
            os.write(b);
            os.flush();
        } catch (Exception ignore) {
        }
    }

    /* ------------------------------------------------------ notification */

    private Notification buildPromoted(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        b.setContentTitle(text)
                .setContentText("DSH · 正在操作这台手机")
                .setSmallIcon(R.drawable.ic_stat)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(pi)
                .setCategory(Notification.CATEGORY_PROGRESS);
        // Android 16：胶囊短文字 + 请求升级为「实时更新 / 流体云」
        try {
            Notification.Builder.class.getMethod("setShortCriticalText", CharSequence.class).invoke(b, "DSH");
        } catch (Throwable ignore) {
        }
        try {
            Notification.Builder.class.getMethod("setRequestPromotedOngoing", boolean.class).invoke(b, true);
        } catch (Throwable ignore) {
        }
        return b.build();
    }

    private Notification buildNotification(String title, String text) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel c = new NotificationChannel(CH, "DSH HUD", NotificationManager.IMPORTANCE_LOW);
            nm.createNotificationChannel(c);
        }
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        return b.setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    /** 系统是否允许发布提升通知（API 36 才有） */
    static String promotedState(android.content.Context ctx) {
        try {
            NotificationManager m = (NotificationManager) ctx.getSystemService(NOTIFICATION_SERVICE);
            Object v = NotificationManager.class.getMethod("canPostPromotedNotifications").invoke(m);
            return String.valueOf(v);
        } catch (Throwable e) {
            return "不可用（" + e.getClass().getSimpleName() + "）";
        }
    }
}