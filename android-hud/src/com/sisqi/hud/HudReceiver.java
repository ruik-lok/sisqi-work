package com.sisqi.hud;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * 广播入口（替代 HTTP 服务）：
 *   am broadcast -a com.sisqi.hud.ACT --es type status --es text "正在打开设置"
 *   am broadcast -a com.sisqi.hud.HIDE
 *
 * 用广播的原因：ColorOS 会把后台进程冻结，长连接的服务端会卡住；
 * 广播由系统投递，能唤醒冻结的进程。
 */
public class HudReceiver extends BroadcastReceiver {
    static final int NOTIF_ID = 3;
    static final String CH = "hud";
    static final String ACTION_ACT = "com.sisqi.hud.ACT";
    static final String ACTION_HIDE = "com.sisqi.hud.HIDE";

    @Override
    public void onReceive(Context ctx, Intent i) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        String action = i == null ? null : i.getAction();

        if (ACTION_HIDE.equals(action)) {
            nm.cancel(NOTIF_ID);
            return;
        }

        String type = i == null ? null : i.getStringExtra("type");
        String text = i == null ? null : i.getStringExtra("text");
        if (text == null || text.trim().isEmpty()) {
            text = "done".equals(type) ? "任务完成" : "DSH 操作中";
        }
        post(ctx, nm, text);
        scheduleHide(ctx);
    }

    private void post(Context ctx, NotificationManager nm, String text) {
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CH) == null) {
            nm.createNotificationChannel(new NotificationChannel(CH, "DSH HUD", NotificationManager.IMPORTANCE_LOW));
        }
        Intent open = new Intent(ctx, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CH) : new Notification.Builder(ctx);
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
        try {
            nm.notify(NOTIF_ID, b.build());
        } catch (Throwable ignore) {
        }
    }

    /** 30 秒内没有新事件就自动收起 */
    private void scheduleHide(Context ctx) {
        Intent hide = new Intent(ctx, HudReceiver.class).setAction(ACTION_HIDE);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 1, hide, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.set(AlarmManager.RTC, System.currentTimeMillis() + 30000, pi);
    }
}
