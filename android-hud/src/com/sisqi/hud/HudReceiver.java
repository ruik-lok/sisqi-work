package com.sisqi.hud;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * 广播入口：把事件转给已运行的 HudService（同进程，直接调用，不走通知）。
 *   am broadcast -n com.sisqi.hud/.HudReceiver -a com.sisqi.hud.ACT  *      --es type tap --es text "点击「WLAN」" --ef x 540 --ef y 1150
 */
public class HudReceiver extends BroadcastReceiver {
    static final String ACTION_ACT = "com.sisqi.hud.ACT";
    static final String ACTION_HIDE = "com.sisqi.hud.HIDE";

    @Override
    public void onReceive(Context ctx, Intent i) {
        String action = i == null ? null : i.getAction();
        HudService s = HudService.instance;
        if (ACTION_HIDE.equals(action)) {
            if (s != null) s.applyEvent("hide", "", -1, -1, -1, -1);
            return;
        }
        String type = i == null ? null : i.getStringExtra("type");
        String text = i == null ? null : i.getStringExtra("text");
        float x = i == null ? -1 : i.getFloatExtra("x", -1);
        float y = i == null ? -1 : i.getFloatExtra("y", -1);
        float x2 = i == null ? -1 : i.getFloatExtra("x2", -1);
        float y2 = i == null ? -1 : i.getFloatExtra("y2", -1);

        if (s != null) {
            s.applyEvent(type, text, x, y, x2, y2);
            return;
        }
        // 服务没起来：尝试拉起（后台受限时可能失败，失败就算了）
        try {
            Intent svc = new Intent(ctx, HudService.class);
            svc.putExtra("type", type);
            svc.putExtra("text", text);
            svc.putExtra("x", x);
            svc.putExtra("y", y);
            svc.putExtra("x2", x2);
            svc.putExtra("y2", y2);
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(svc);
            else ctx.startService(svc);
        } catch (Throwable ignore) {
        }
    }
}
