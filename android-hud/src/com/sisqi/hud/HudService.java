package com.sisqi.hud;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

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
 * HUD 服务：
 *  - 悬浮层：顶部胶囊（状态文字）+ 全屏透明绘制层（点击涟漪/滑动轨迹）
 *  - 本机 HTTP 接口 127.0.0.1:8765/act?type=tap|swipe|status|done|hide
 * 供 DSH 的工具在操作手机时上报，实时可视化。
 */
public class HudService extends Service {
    public static volatile boolean isRunning = false;
    private static final String CH = "hud";
    private static final int PORT = 8765;

    private WindowManager wm;
    private FrameLayout rippleRoot;
    private RippleView ripple;
    private TextView pill;
    private WindowManager.LayoutParams pillParams;
    private int pillX = 24;
    private int pillY = 180;
    private NotificationManager nm;
    private String cloudText = "DSH 就绪";
    private long lastEventAt = android.os.SystemClock.uptimeMillis();
    private long lastCloudAt = 0;
    private Runnable pendingCloud;

    /** 心跳：有活动时每 20s 续一次，30s 无事件就撤掉流体云 */
    private final Runnable heartbeat = new Runnable() {
        public void run() {
            long idle = android.os.SystemClock.uptimeMillis() - lastEventAt;
            if (idle <= 30000) {
                pushCloudNow();
                ui.postDelayed(this, 20000);
            } else if (nm != null) {
                try {
                    nm.cancel(3);
                } catch (Throwable ignore) {
                }
            }
        }
    };
    private final Handler ui = new Handler(Looper.getMainLooper());
    private ServerSocket server;
    private volatile boolean running = false;
    private Thread serverThread;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        startForeground(1, buildNotification("DSH HUD 运行中", "监听 127.0.0.1:" + PORT));
        promote("就绪");
        showOverlay();
        startServer();
        isRunning = true;
        sendStatus("DSH 就绪");
        ui.postDelayed(heartbeat, 20000);
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
        try {
            if (rippleRoot != null && wm != null) wm.removeView(rippleRoot);
        } catch (Exception ignore) {
        }
        try {
            if (pill != null && wm != null) wm.removeView(pill);
        } catch (Exception ignore) {
        }
        super.onDestroy();
    }

    /* ---------------------------------------------------------- overlay */

    private void showOverlay() {
        if (!android.provider.Settings.canDrawOverlays(this)) {
            Log.w("HUD", "no overlay permission");
            return;
        }
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;

        // 1) 全屏透明绘制层：只画涟漪/轨迹，不接收触摸
        rippleRoot = new FrameLayout(this);
        ripple = new RippleView(this);
        rippleRoot.addView(ripple, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        WindowManager.LayoutParams rippleParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        rippleParams.gravity = Gravity.TOP | Gravity.START;
        try {
            wm.addView(rippleRoot, rippleParams);
        } catch (Exception e) {
            Log.w("HUD", "add ripple view failed: " + e);
        }

        // 2) 胶囊：独立小窗口，可拖动，不遮挡点击以外区域
        android.content.SharedPreferences sp = getSharedPreferences("hud", MODE_PRIVATE);
        pillX = sp.getInt("x", 24);
        pillY = sp.getInt("y", 300);
        // 状态栏那一条留给系统的流体云，旧位置（<240）自动下移
        if (pillY < 240) pillY = 300;

        pill = new TextView(this);
        pill.setTextColor(Color.WHITE);
        pill.setTextSize(12);
        pill.setPadding(dp(12), dp(7), dp(12), dp(7));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#E01F2330"));
        bg.setCornerRadius(dp(16));
        bg.setStroke(dp(1), Color.parseColor("#664D6BFE"));
        pill.setBackground(bg);

        pillParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
        pillParams.gravity = Gravity.TOP | Gravity.START;
        pillParams.x = pillX;
        pillParams.y = pillY;
        try {
            wm.addView(pill, pillParams);
        } catch (Exception e) {
            Log.w("HUD", "add pill failed: " + e);
        }

        // 拖动：按住胶囊移动；松手记住位置
        pill.setOnTouchListener(new android.view.View.OnTouchListener() {
            private float downRawX, downRawY;
            private int startX, startY;
            private boolean moved;

            public boolean onTouch(android.view.View v, android.view.MotionEvent e) {
                switch (e.getActionMasked()) {
                    case android.view.MotionEvent.ACTION_DOWN:
                        downRawX = e.getRawX();
                        downRawY = e.getRawY();
                        startX = pillParams.x;
                        startY = pillParams.y;
                        moved = false;
                        return true;
                    case android.view.MotionEvent.ACTION_MOVE:
                        int dx = (int) (e.getRawX() - downRawX);
                        int dy = (int) (e.getRawY() - downRawY);
                        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
                        pillParams.x = startX + dx;
                        pillParams.y = Math.max(0, startY + dy);
                        try {
                            wm.updateViewLayout(pill, pillParams);
                        } catch (Exception ignore) {
                        }
                        return true;
                    case android.view.MotionEvent.ACTION_UP:
                    case android.view.MotionEvent.ACTION_CANCEL:
                        if (moved) {
                            pillX = pillParams.x;
                            pillY = pillParams.y;
                            getSharedPreferences("hud", MODE_PRIVATE).edit().putInt("x", pillX).putInt("y", pillY).apply();
                        }
                        return true;
                }
                return false;
            }
        });
    }

    private void sendStatus(final String text) {
        ui.post(new Runnable() {
            public void run() {
                if (pill == null) return;
                pill.setText(text);
                pill.setTextColor(Color.WHITE);
                pill.setAlpha(1f);
                promote(text);
            }
        });
    }

    private void tapDone(final String text) {
        ui.post(new Runnable() {
            public void run() {
                if (pill == null) return;
                pill.setText(text);
                pill.setTextColor(Color.parseColor("#7CFFB2"));
                pill.setAlpha(1f);
                ui.postDelayed(new Runnable() {
                    public void run() {
                        if (pill != null) pill.setAlpha(0.35f);
                    }
                }, 2500);
            }
        });
        promote(text);
    }

    private void hidePill() {
        ui.post(new Runnable() {
            public void run() {
                if (pill != null) pill.setAlpha(0f);
            }
        });
    }

    /* ------------------------------------------------------------ http */

    private void startServer() {
        running = true;
        serverThread = new Thread(new Runnable() {
            public void run() {
                try {
                    server = new ServerSocket(PORT, 8, InetAddress.getByName("127.0.0.1"));
                    while (running) {
                        Socket s = server.accept();
                        try {
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
                } catch (Exception e) {
                    Log.w("HUD", "server: " + e);
                }
            }
        }, "hud-http");
        serverThread.setDaemon(true);
        serverThread.start();
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
                if (eq > 0) {
                    q.put(kv.substring(0, eq), URLDecoder.decode(kv.substring(eq + 1), "UTF-8"));
                }
            }
            path = path.substring(0, qi);
        }
        if (!"/act".equals(path) && !"/".equals(path)) {
            respond(s, "unknown");
            return;
        }
        String type = q.get("type");
        if (type == null) type = "status";
        if ("tap".equals(type)) {
            final float x = num(q.get("x"));
            final float y = num(q.get("y"));
            final String label = q.get("text");
            ui.post(new Runnable() {
                public void run() {
                    if (ripple != null) ripple.addTap(x, y);
                    if (label != null) sendStatus(label);
                    else sendStatus("点击 (" + (int) x + ", " + (int) y + ")");
                }
            });
        } else if ("swipe".equals(type)) {
            final float x1 = num(q.get("x1")), y1 = num(q.get("y1")), x2 = num(q.get("x2")), y2 = num(q.get("y2"));
            final String label = q.get("text");
            ui.post(new Runnable() {
                public void run() {
                    if (ripple != null) ripple.addSwipe(x1, y1, x2, y2);
                    sendStatus(label != null ? label : "滑动 (" + (int) x1 + "," + (int) y1 + ") → (" + (int) x2 + "," + (int) y2 + ")");
                }
            });
        } else if ("status".equals(type)) {
            sendStatus(q.get("text") != null ? q.get("text") : "DSH 操作中");
        } else if ("done".equals(type)) {
            tapDone(q.get("text") != null ? q.get("text") : "任务完成");
        } else if ("hide".equals(type)) {
            hidePill();
        }
        respond(s, "ok");
    }

    private float num(String v) {
        try {
            return Float.parseFloat(v);
        } catch (Exception e) {
            return 0f;
        }
    }

    private void respond(Socket s, String body) {
        try {
            OutputStream os = s.getOutputStream();
            byte[] b = body.getBytes("UTF-8");
            String head = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: " + b.length + "\r\nConnection: close\r\n\r\n";
            os.write(head.getBytes("UTF-8"));
            os.write(b);
            os.flush();
        } catch (Exception ignore) {
        }
    }

    /* ------------------------------------------------------ notification */


    /* --------------------------------------------- 流体云（实时更新通知） */

    /** 状态变化：胶囊立即更新；流体云按 ~900ms 合并推送（系统本身还有一层节流） */
    private void promote(final String text) {
        cloudText = text;
        lastEventAt = android.os.SystemClock.uptimeMillis();
        if (pendingCloud != null) ui.removeCallbacks(pendingCloud);
        long wait = Math.max(0, 900 - (android.os.SystemClock.uptimeMillis() - lastCloudAt));
        pendingCloud = new Runnable() {
            public void run() {
                pendingCloud = null;
                pushCloudNow();
            }
        };
        ui.postDelayed(pendingCloud, wait);
    }

    private void pushCloudNow() {
        lastCloudAt = android.os.SystemClock.uptimeMillis();
        if (nm == null) return;
        try {
            nm.notify(3, buildPromoted(cloudText));
        } catch (Throwable e) {
            Log.w("HUD", "promote failed: " + e);
        }
    }

    private Notification buildPromoted(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        b.setContentTitle(text)
                .setContentText("DSH · 正在操作这台手机")
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(pi)
                .setCategory(Notification.CATEGORY_PROGRESS);
        // Android 16：胶囊短文字 + 请求升级为「实时更新 / 流体云」。低版本没有这些方法，用反射跳过。
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

    /** 系统是否允许本应用发布提升通知（API 36 才有） */
    static String promotedState(android.content.Context ctx) {
        try {
            NotificationManager m = (NotificationManager) ctx.getSystemService(NOTIFICATION_SERVICE);
            Object v = NotificationManager.class.getMethod("canPostPromotedNotifications").invoke(m);
            return String.valueOf(v);
        } catch (Throwable e) {
            return "不可用（" + e.getClass().getSimpleName() + "）";
        }
    }

    private Notification buildNotification(String title, String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CH) == null) {
            NotificationChannel c = new NotificationChannel(CH, "DSH HUD", NotificationManager.IMPORTANCE_LOW);
            nm.createNotificationChannel(c);
        }
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        return b.setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}