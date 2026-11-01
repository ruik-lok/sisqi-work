package com.sisqi.hud;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.util.AttributeSet;
import android.view.View;
import android.widget.TextView;

/**
 * 液态玻璃质感的胶囊：
 *  - 半透明白色渐变底（上亮下暗）
 *  - 顶部高光弧线 + 1px 渐变描边
 *  - 外发光阴影
 * 注意：Android 的窗口级背景模糊在这台机器上不可用
 * （ro.surface_flinger.supports_background_blur 为空），
 * 所以用渐变+高光+描边模拟玻璃质感，而不是真实折射。
 */
public class GlassPill extends TextView {
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint gloss = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rect = new RectF();
    private final Path glossPath = new Path();

    public GlassPill(Context c) {
        super(c);
        init();
    }

    public GlassPill(Context c, AttributeSet a) {
        super(c, a);
        init();
    }

    private void init() {
        setLayerType(View.LAYER_TYPE_SOFTWARE, null); // 阴影需要软件层
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(dp(1));
        gloss.setStyle(Paint.Style.FILL);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float w = getWidth();
        float h = getHeight();
        float r = getPaddingTop() + dp(10);
        r = Math.min(r, h / 2f);
        rect.set(dp(1), dp(1), w - dp(1), h - dp(1));

        // 1) 玻璃底：上亮下暗的半透明白
        // 深色玻璃：在浅色/深色背景上都看得清；顶部略亮，底部更沉
        fill.setShader(new LinearGradient(0, 0, 0, h,
                Color.argb(168, 20, 22, 30),
                Color.argb(206, 12, 13, 18),
                Shader.TileMode.CLAMP));
        fill.setShadowLayer(dp(10), 0, dp(3), Color.argb(90, 0, 0, 0));
        canvas.drawRoundRect(rect, r, r, fill);
        fill.clearShadowLayer();

        // 2) 顶部高光弧（模拟玻璃折射的亮边）
        gloss.setShader(new LinearGradient(0, 0, 0, h * 0.55f,
                Color.argb(90, 255, 255, 255),
                Color.argb(0, 255, 255, 255),
                Shader.TileMode.CLAMP));
        glossPath.reset();
        glossPath.addRoundRect(new RectF(dp(1), dp(1), w - dp(1), h * 0.55f), r, r, Path.Direction.CW);
        canvas.drawPath(glossPath, gloss);

        // 3) 渐变描边：上亮下暗
        stroke.setShader(new LinearGradient(0, 0, 0, h,
                Color.argb(150, 255, 255, 255),
                Color.argb(28, 255, 255, 255),
                Shader.TileMode.CLAMP));
        canvas.drawRoundRect(rect, r, r, stroke);
        stroke.setShader(null);

        super.onDraw(canvas);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}