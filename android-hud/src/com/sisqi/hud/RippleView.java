package com.sisqi.hud;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.drawable.Drawable;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.os.SystemClock;
import android.view.View;

import java.util.ArrayList;
import java.util.List;

/** 只负责画：点击涟漪 + 滑动轨迹。数据由 HudService 写入。 */
public class RippleView extends View {
    private static final long TAP_MS = 650;
    private static final long SWIPE_MS = 800;

    static class Tap {
        float x, y;
        long start;
    }

    static class Swipe {
        float x1, y1, x2, y2;
        long start;
    }

    private final List<Tap> taps = new ArrayList<Tap>();
    private final List<Swipe> swipes = new ArrayList<Swipe>();
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private Bitmap whale;
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);

    public RippleView(Context c) {
        super(c);
        paint.setStyle(Paint.Style.FILL);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(6f);
        stroke.setStrokeCap(Paint.Cap.ROUND);
        setWillNotDraw(false);
        // 鲸鱼位图（白色单色版，来自 DSH 图标路径）
        try {
            Drawable d = c.getDrawable(R.drawable.ic_stat);
            int s = (int) (56 * c.getResources().getDisplayMetrics().density);
            whale = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888);
            Canvas bc = new Canvas(whale);
            d.setBounds(0, 0, s, s);
            d.draw(bc);
        } catch (Throwable ignore) {
        }
    }

    void addTap(float x, float y) {
        Tap t = new Tap();
        t.x = x;
        t.y = y;
        t.start = SystemClock.uptimeMillis();
        taps.add(t);
        invalidate();
    }

    void addSwipe(float x1, float y1, float x2, float y2) {
        Swipe s = new Swipe();
        s.x1 = x1;
        s.y1 = y1;
        s.x2 = x2;
        s.y2 = y2;
        s.start = SystemClock.uptimeMillis();
        swipes.add(s);
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        long now = SystemClock.uptimeMillis();
        boolean active = false;

        for (int i = taps.size() - 1; i >= 0; i--) {
            Tap t = taps.get(i);
            long age = now - t.start;
            if (age > TAP_MS) {
                taps.remove(i);
                continue;
            }
            active = true;
            float p = age / (float) TAP_MS;
            paint.setColor(Color.argb((int) (200 * (1 - p)), 77, 107, 254));
            canvas.drawCircle(t.x, t.y, 14 + 40 * p, paint);
            // 鲸鱼在涟漪中心，淡出并轻微放大
            if (whale != null) {
                paint.setAlpha((int) (255 * (1 - p)));
                float half = whale.getWidth() / 2f * (0.9f + 0.5f * p);
                canvas.drawBitmap(whale, null, new android.graphics.RectF(t.x - half, t.y - half, t.x + half, t.y + half), paint);
                paint.setAlpha(255);
            }
            paint.setColor(Color.argb((int) (255 * (1 - p)), 77, 107, 254));
            canvas.drawCircle(t.x, t.y, 10, paint);
            // 十字准心，方便看精确位置
            stroke.setColor(Color.argb((int) (220 * (1 - p)), 255, 255, 255));
            canvas.drawLine(t.x - 26, t.y, t.x + 26, t.y, stroke);
            canvas.drawLine(t.x, t.y - 26, t.x, t.y + 26, stroke);
        }

        for (int i = swipes.size() - 1; i >= 0; i--) {
            Swipe s = swipes.get(i);
            long age = now - s.start;
            if (age > SWIPE_MS) {
                swipes.remove(i);
                continue;
            }
            active = true;
            float p = age / (float) SWIPE_MS;
            int alpha = (int) (230 * (1 - p));
            Path path = new Path();
            path.moveTo(s.x1, s.y1);
            path.lineTo(s.x2, s.y2);
            stroke.setColor(Color.argb(alpha, 77, 107, 254));
            stroke.setStrokeWidth(10f);
            canvas.drawPath(path, stroke);
            paint.setColor(Color.argb(alpha, 255, 255, 255));
            canvas.drawCircle(s.x2, s.y2, 12, paint);
        }

        if (active) postInvalidateOnAnimation();
    }
}