/**
 * dsh-tool-hud：把 DSH 正在做的事推到手机状态栏的「流体云」。
 *
 * 依赖 DSH HUD 小应用（com.sisqi.hud）在本机 127.0.0.1:8765 上的 HTTP 接口。
 * 没有悬浮窗：只在状态栏显示一句人话，30 秒无事件自动收起。
 */
import { defineTool } from "@deepseek-ai/dsh-tools";
import { get as httpGet } from "node:http";

const name = "tool-hud";
const inject = ["tools"];

const port = () => parseInt(process.env.HUD_PORT || "8765", 10);

/** 调 HUD 的 /act 接口 */
function hud(params) {
  return new Promise((resolve) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(String(v)))
      .join("&");
    const req = httpGet(
      { host: "127.0.0.1", port: port(), path: "/act?" + qs, timeout: 4000 },
      (res) => {
        res.resume();
        res.on("end", () => resolve({ ok: res.statusCode === 200 }));
      }
    );
    req.on("error", (e) => resolve({ ok: false, error: String((e && e.message) || e) }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "HUD 超时（DSH HUD 应用没在运行？）" });
    });
    req.end();
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

/** 工具结果展示：必须返回内容块数组（框架会对它调用 .some） */
const render = (args, v) => [
  {
    type: "text",
    text: v && v.ok ? "已更新流体云" : "流体云更新失败：" + ((v && v.error) || "HUD 应用没在运行")
  }
];

function apply(ctx) {
  ctx.tools.register(defineTool({
    name: "hud_status",
    description:
      "在手机状态栏的「流体云」里显示当前正在做什么（一句给人看的话，不要传坐标）。" +
      "在每次操作手机前后调用，例如：正在打开设置 / 点击「WLAN」 / 滑动列表 / 正在输入。",
    parameters: {
      text: { type: "string", description: "给人看的一句话，例如「正在打开设置」" }
    },
    output: { schema: outSchema, render },
    async execute(args) {
      return hud({ type: "status", text: args.text || "DSH 操作中" });
    }
  }));

  ctx.tools.register(defineTool({
    name: "hud_done",
    description: "任务结束时把流体云切成完成态（例如「完成 · 已打开 WLAN」），30 秒无事件后自动收起。",
    parameters: {
      text: { type: "string", description: "完成提示，例如「完成 · 用时 12s」" }
    },
    output: { schema: outSchema, render },
    async execute(args) {
      return hud({ type: "done", text: args.text || "任务完成" });
    }
  }));

  ctx.tools.register(defineTool({
    name: "hud_hide",
    description: "立即收起流体云。",
    parameters: {},
    output: { schema: outSchema, render },
    async execute() {
      return hud({ type: "hide" });
    }
  }));
}

export { apply, inject, name };