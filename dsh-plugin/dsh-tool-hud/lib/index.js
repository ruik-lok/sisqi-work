/**
 * dsh-tool-hud：把 DSH 正在做的事推到手机上的悬浮 HUD（胶囊 + 涟漪）。
 * 通道：su -c am broadcast（ColorOS 会冻结后台进程，广播比 HTTP 可靠）。
 */
import { defineTool } from "@deepseek-ai/dsh-tools";
import { execFile } from "node:child_process";

const name = "tool-hud";
const inject = ["tools"];
const RECEIVER = "com.sisqi.hud/.HudReceiver";

function send(type, text, x, y, x2, y2) {
  return new Promise((resolve) => {
    const esc = String(text == null ? "" : text).replace(/'/g, "'\\''");
    let cmd =
      "am broadcast -n " + RECEIVER + " -a com.sisqi.hud.ACT --es type " + type +
      " --es text '" + esc + "'";
    if (typeof x === "number" && typeof y === "number") cmd += " --ef x " + x + " --ef y " + y;
    if (typeof x2 === "number" && typeof y2 === "number") cmd += " --ef x2 " + x2 + " --ef y2 " + y2;
    cmd += " >/dev/null 2>&1";
    execFile("su", ["-c", cmd], { timeout: 8000 }, (err) => {
      if (err) resolve({ ok: false, error: "广播失败：" + (err.message || err) });
      else resolve({ ok: true });
    });
  });
}

const outSchema = {
  type: "object",
  additionalProperties: false,
  properties: { ok: { type: "boolean", required: true }, error: { type: "string" } }
};

const render = (args, v) => [
  { type: "text", text: v && v.ok ? "已更新 HUD" : "HUD 更新失败：" + ((v && v.error) || "未知原因") }
];

function apply(ctx) {
  ctx.tools.register(defineTool({
    name: "hud_status",
    description:
      "在手机的悬浮 HUD 上显示当前动作（一句给人看的话）。点击类动作可带上坐标，HUD 会在该位置画涟漪。" +
      "每次操作手机前后调用，例如：正在打开设置 / 点击「WLAN」 / 滑动列表。",
    parameters: {
      text: { type: "string", description: "给人看的一句话，例如「正在打开设置」" },
      x: { type: "number", description: "点击坐标 x（可选，画涟漪用）" },
      y: { type: "number", description: "点击坐标 y（可选）" }
    },
    output: { schema: outSchema, render },
    async execute(args) {
      return send("status", args.text || "DSH 操作中", args.x, args.y);
    }
  }));

  ctx.tools.register(defineTool({
    name: "hud_tap",
    description: "在悬浮 HUD 上标记一次点击：显示文字 + 在 (x,y) 画涟漪和鲸鱼。",
    parameters: {
      text: { type: "string", description: "例如「点击「WLAN」」" },
      x: { type: "number", description: "屏幕像素 x" },
      y: { type: "number", description: "屏幕像素 y" }
    },
    output: { schema: outSchema, render },
    async execute(args) {
      return send("tap", args.text || "点击", args.x, args.y);
    }
  }));

  ctx.tools.register(defineTool({
    name: "hud_swipe",
    description: "在悬浮 HUD 上标记一次滑动：显示文字 + 画轨迹。",
    parameters: {
      text: { type: "string", description: "例如「上滑 · 下一个视频」" },
      x1: { type: "number" },
      y1: { type: "number" },
      x2: { type: "number" },
      y2: { type: "number" }
    },
    output: { schema: outSchema, render },
    async execute(args) {
      return send("swipe", args.text || "滑动", args.x1, args.y1, args.x2, args.y2);
    }
  }));

  ctx.tools.register(defineTool({
    name: "hud_done",
    description: "任务结束：HUD 胶囊变绿显示完成提示。",
    parameters: { text: { type: "string", description: "例如「完成 · 刷了 3 条视频」" } },
    output: { schema: outSchema, render },
    async execute(args) {
      return send("done", args.text || "任务完成");
    }
  }));

  ctx.tools.register(defineTool({
    name: "hud_hide",
    description: "收起 HUD 胶囊。",
    parameters: {},
    output: { schema: outSchema, render },
    async execute() {
      return send("hide", "");
    }
  }));
}

export { apply, inject, name };
