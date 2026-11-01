package com.sisqi.hud;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** DSH HUD 控制页：悬浮窗权限、启动/停止。 */
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
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(64), dp(64));
        lp.bottomMargin = dp(12);
        root.addView(logo, lp);

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
        perm.setText("授予悬浮窗权限");
        perm.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
            }
        });
        root.addView(perm);

        Button start = new Button(this);
        start.setText("启动悬浮 HUD");
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
        hint.setText("胶囊可拖动；事件由广播驱动：\n" +
                "am broadcast -n com.sisqi.hud/.HudReceiver\n" +
                "  -a com.sisqi.hud.ACT --es type tap\n" +
                "  --es text 点击 --ef x 540 --ef y 1150");
        root.addView(hint);

        setContentView(root);
    }

    @Override
    protected void onResume() {
        super.onResume();
        refresh();
    }

    private void refresh() {
        boolean overlay = Settings.canDrawOverlays(this);
        status.setText("悬浮窗权限：" + (overlay ? "已授予" : "未授予") + "\n" +
                "HUD 服务：" + (HudService.isRunning ? "运行中" : "已停止"));
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
