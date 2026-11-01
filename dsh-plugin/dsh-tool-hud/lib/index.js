/**
 * dsh-tool-hud：把 DSH 正在做的事推到手机状态栏的「流体云」。
 *
 * 通道：am broadcast（不是长连接）——ColorOS 会冻结后台进程，
 * HTTP 服务端会被冻住，而广播由系统投递，能唤醒进程。
 */
import { defineTool } from "@deepseek-ai/dsh-tools";
import { execFile } from "node:child_process";

const name = "tool-hud";
const inject = ["tools"];

const RECEIVER = "com.sisqi.hud/.HudReceiver";

function send(type, text) {
  return new Promise((resolve) => {
    const esc = String(text == null ? "" : text).replace(/'/g, "'\\''");
    const cmd =
      "am broadcast -n " + RECEIVER + " -a com.sisqi.hud.ACT --es type " + type +
      " --es text '" + esc + "' >/dev/null 2>&1";
    // 普通 app 用户不能直接跑 am（需要 shell/root），走 su；KernelSU 已授权本 App
    execFile("su", ["-c", cmd], { timeout: 8000 }, (err) => {
      if (err) resolve({ ok: false, error: "广播失败：" + (err.message || err) });
      else resolve({ ok: true });
    });
  });
}

const outSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ok: { type: "boolean", required: true },
    error: { type: "string" }
  }
};

/** 工具结果展示：必须返回内容块数组 */
const render = (args, v) => [
  {
    type: "text",
    text: v && v.ok ? "已更新流体云" : "流体云更新失败：" + ((v && v.error) || "未知原因")
  }
];

function apply(ctx) {
  ctx.tools.register(defineTool({
    name: "hud_status",
    description:
      "在手机状态栏的「流体云」里显示当前正在做什么（一句给人看的话，不要传坐标）。" +
      "在每次操作手机前后调用，例如：正在打开设置 / 点击「WLAN」 / 滑动列表 / 正在输入。",
    parameters: { text: { type: "string", description: "给人看的一句话，例如「正在打开设置」" } },
    output: { schema: outSchema, render },
    async execute(args) {
      return send("status", args.text || "DSH 操作中");
    }
  }));

  ctx.tools.register(defineTool({
    name: "hud_done",
    description: "任务结束时把流体云切成完成态（例如「完成 · 已打开 WLAN」），30 秒无事件后自动收起。",
    parameters: { text: { type: "string", description: "完成提示，例如「完成 · 用时 12s」" } },
    output: { schema: outSchema, render },
    async execute(args) {
      return send("done", args.text || "任务完成");
    }
  }));

  ctx.tools.register(defineTool({
    name: "hud_hide",
    description: "立即收起流体云。",
    parameters: {},
    output: { schema: outSchema, render },
    async execute() {
      return send("hide", "");
    }
  }));
}

export { apply, inject, name };