package com.sisqi.hud;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** DSH HUD 控制页：授权悬浮窗、启动/停止 HUD、显示接口地址。 */
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

        Button perm = new Button(this);
        perm.setText("① 授予悬浮窗权限");
        perm.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
                startActivity(i);
            }
        });
        root.addView(perm);

        Button start = new Button(this);
        start.setText("② 启动 HUD");
        start.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                Intent i = new Intent(MainActivity.this, HudService.class);
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
                ui.postDelayed(new Runnable() { public void run() { refresh(); } }, 600);
            }
        });
        root.addView(start);

        Button stop = new Button(this);
        stop.setText("停止 HUD");
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
                "GET http://127.0.0.1:8765/act?type=tap&x=540&y=1200\n" +
                "GET /act?type=swipe&x1=100&y1=900&x2=900&y2=900\n" +
                "GET /act?type=status&text=正在打开设置\n" +
                "GET /act?type=done&text=任务完成\n" +
                "GET /act?type=hide");
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
        boolean overlay = Settings.canDrawOverlays(this);
        boolean running = HudService.isRunning;
        status.setText((overlay ? "悬浮窗权限：已授予" : "悬浮窗权限：未授予") + "\n" +
                "HUD 服务：" + (running ? "运行中 · 端口 8765" : "已停止"));
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
