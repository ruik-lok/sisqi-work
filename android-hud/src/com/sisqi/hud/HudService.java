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
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * 悬浮窗 HUD：胶囊（状态文字）+ 涟漪（点击/滑动可视化），可拖动。
 * 事件由广播（HudReceiver）转发到本服务；不依赖通知刷新，所以不受 ColorOS 后台限制影响。
 */
public class HudService extends Service {
    public static volatile boolean isRunning = false;
    static volatile HudService instance = null;

    private static final String CH = "hud";
    private WindowManager wm;
    private FrameLayout rippleRoot;
    private RippleView ripple;
    private TextView pill;
    private WindowManager.LayoutParams pillParams;
    private int pillX = 24;
    private int pillY = 300;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private NotificationManager nm;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        startForeground(1, buildNotification());
        showOverlay();
        instance = this;
        isRunning = true;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            applyEvent(intent.getStringExtra("type"), intent.getStringExtra("text"),
                    intent.getFloatExtra("x", -1), intent.getFloatExtra("y", -1),
                    intent.getFloatExtra("x2", -1), intent.getFloatExtra("y2", -1));
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        instance = null;
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

    /** 广播入口：type = tap | swipe | status | done | hide */
    void applyEvent(final String type, final String text, final float x, final float y, final float x2, final float y2) {
        ui.post(new Runnable() {
            public void run() {
                try {
                    if ("tap".equals(type) && ripple != null && x >= 0) ripple.addTap(x, y);
                    if ("swipe".equals(type) && ripple != null && x >= 0 && x2 >= 0) ripple.addSwipe(x, y, x2, y2);
                    if ("hide".equals(type)) {
                        hidePill();
                        return;
                    }
                    if ("done".equals(type)) {
                        tapDone(text == null || text.isEmpty() ? "任务完成" : text);
                        return;
                    }
                    sendStatus(text == null || text.isEmpty() ? "DSH 操作中" : text);
                } catch (Throwable e) {
                    Log.w("HUD", "applyEvent: " + e);
                }
            }
        });
    }

    private void showOverlay() {
        if (!android.provider.Settings.canDrawOverlays(this)) {
            Log.w("HUD", "no overlay permission");
            return;
        }
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        int type = Build.VERSION.SDK_INT >= 26
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;

        rippleRoot = new FrameLayout(this);
        ripple = new RippleView(this);
        rippleRoot.addView(ripple, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        WindowManager.LayoutParams rp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        rp.gravity = Gravity.TOP | Gravity.START;
        try {
            wm.addView(rippleRoot, rp);
        } catch (Exception e) {
            Log.w("HUD", "add ripple: " + e);
        }

        android.content.SharedPreferences sp = getSharedPreferences("hud", MODE_PRIVATE);
        pillX = sp.getInt("x", 24);
        pillY = sp.getInt("y", 300);
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
        pill.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_stat, 0, 0, 0);
        pill.setCompoundDrawablePadding(dp(6));

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
            Log.w("HUD", "add pill: " + e);
        }

        pill.setOnTouchListener(new View.OnTouchListener() {
            private float downRawX, downRawY;
            private int startX, startY;
            private boolean moved;

            public boolean onTouch(View v, MotionEvent e) {
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downRawX = e.getRawX();
                        downRawY = e.getRawY();
                        startX = pillParams.x;
                        startY = pillParams.y;
                        moved = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
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
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
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
    }

    private void hidePill() {
        ui.post(new Runnable() {
            public void run() {
                if (pill != null) pill.setAlpha(0f);
            }
        });
    }

    private Notification buildNotification() {
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CH) == null) {
            nm.createNotificationChannel(new NotificationChannel(CH, "DSH HUD", NotificationManager.IMPORTANCE_LOW));
        }
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        return b.setContentTitle("DSH HUD 运行中")
                .setContentText("悬浮胶囊 + 涟漪已启用")
                .setSmallIcon(R.drawable.ic_stat)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
