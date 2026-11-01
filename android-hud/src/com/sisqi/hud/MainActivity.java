package com.sisqi.hud;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** DSH HUD 控制页：启动/停止流体云服务，查看状态与接口。 */
public class MainActivity extends Activity {
    private TextView status;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(24), dp(48), dp(24), dp(24));
        root.setBackgroundColor(Color.parseColor("#F6F7FB"));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.ic_launcher);
        LinearLayout.LayoutParams logoLp = new LinearLayout.LayoutParams(dp(64), dp(64));
        logoLp.bottomMargin = dp(12);
        root.addView(logo, logoLp);

        TextView title = new TextView(this);
        title.setText("DSH HUD");
        title.setTextSize(26);
        title.setTextColor(Color.parseColor("#191A1E"));
        root.addView(title);

        status = new TextView(this);
        status.setTextSize(14);
        status.setTextColor(Color.parseColor("#5B6070"));
        status.setPadding(0, dp(12), 0, dp(20));
        root.addView(status);

        Button start = new Button(this);
        start.setText("启动流体云");
        start.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                Intent i = new Intent(MainActivity.this, HudService.class);
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
                ui.postDelayed(new Runnable() { public void run() { refresh(); } }, 600);
            }
        });
        root.addView(start);

        Button stop = new Button(this);
        stop.setText("停止");
        stop.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                stopService(new Intent(MainActivity.this, HudService.class));
                ui.postDelayed(new Runnable() { public void run() { refresh(); } }, 400);
            }
        });
        root.addView(stop);

        TextView hint = new TextView(this);
        hint.setTextSize(12);
        hint.setTextColor(Color.parseColor("#8A90A2"));
        hint.setPadding(0, dp(24), 0, 0);
        hint.setText("接口（本机回环）：\n" +
                "GET /act?type=status&text=正在打开设置\n" +
                "GET /act?type=tap&text=点击「WLAN」\n" +
                "GET /act?type=swipe&text=滑动列表\n" +
                "GET /act?type=done&text=完成 · 已打开 WLAN\n" +
                "GET /act?type=hide\n\n" +
                "（地址 http://127.0.0.1:8765）");
        root.addView(hint);

        setContentView(root);

        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        refresh();
    }

    private void refresh() {
        status.setText("HUD 服务：" + (HudService.isRunning ? "运行中 · 端口 8765" : "已停止") + "\n" +
                "流体云（实时通知）：" + HudService.promotedState(this) + "\n" +
                "悬浮窗：已移除（只走流体云）");
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
