# 使用方法

本文档说明如何把 `dsh-nerv-bridge` 和 `aiui-nerv-terminal` 跑起来，并在
Rokid Glasses 上调试。

## 1. 项目结构

```text
dsh-nerv-bridge/       DeepSeek Harness 插件 + WebSocket 服务
aiui-nerv-terminal/    Rokid AIUI 眼镜端
docs/                  方案、调试、使用文档
openspec/              设计变更、规格和任务
dist/                  本地 AIX 输出（不提交）
```

## 2. 前置条件

- Mac mini 或 Mac 电脑，常开，已联网。
- DeepSeek Harness 已安装，并且 DSH Web UI 可以正常对话。
- Node.js 22 或更高版本，pnpm 可用。
- Rokid 账号和 AIUI Studio 环境。
- 手机安装 Rokid AI App 或 Hi Rokid，并已连接眼镜。
- 可选：Cloudflare 账号 + 域名，或 Tailscale 账号。

## 3. 安装 bridge 插件

进入项目根目录：

```bash
cd ~/repos/hermes-on-glass
```

创建 DSH profile：

```bash
dsh --profile nerv --from-default-profile web --dump-config
```

安装本地插件：

```bash
dsh plugin --profile nerv add ./dsh-nerv-bridge
```

确认组合配置里出现插件：

```bash
dsh --profile nerv --dump-config | grep -A10 dsh-nerv-bridge
```

## 4. 修改 sharedSecret

编辑：

```text
dsh-nerv-bridge/cordis.patch.yml
```

把：

```yaml
sharedSecret: change-me
```

改成你自己的随机长字符串。这个值同时要填到 AIUI 的 `app.js`。

## 5. 启动 DSH

```bash
dsh --profile nerv --no-open --port 3099
```

看到下面两行说明 bridge 已启动：

```text
[dsh-nerv-bridge] listening on 127.0.0.1:3090
dsh web: http://127.0.0.1:3099/?token=...
```

DSH Web UI 只绑定 loopback，不要直接暴露给公网。

## 6. 本地验证 bridge

另开一个终端：

```bash
cd ~/repos/hermes-on-glass/dsh-nerv-bridge
node tools/nerv-bridge-probe.js \
  --url ws://127.0.0.1:3090/glasses \
  --token 你的sharedSecret \
  --send '{"type":"list_workspaces"}'
```

预期看到：

```text
server_hello
connection_update
workspace_list
```

再测某个工作区的会话列表：

```bash
node tools/nerv-bridge-probe.js \
  --url ws://127.0.0.1:3090/glasses \
  --token 你的sharedSecret \
  --send '{"type":"select_workspace","workspaceId":"工作区ID"}'
```

出现 `session_list` 即表示 DSH 适配层工作正常。

## 7. 配置公网 WSS

Cloudflare Tunnel 示例：

```bash
cloudflared tunnel --url http://127.0.0.1:3090
```

Tailscale Funnel 示例：

```bash
tailscale funnel 3090
```

把生成的公网地址记下来，AIUI 需要把它改成：

```text
wss://你的公网地址/glasses
```

## 8. 配置 AIUI 客户端

编辑：

```text
aiui-nerv-terminal/app.js
```

修改：

```js
bridgeUrl: 'wss://你的公网地址/glasses',
bridgeToken: '你的sharedSecret',
```

本地检查：

```bash
cd aiui-nerv-terminal
npm install
npx tsc --noEmit
```

打包：

```bash
cd ..
aix pack aiui-nerv-terminal -o dist/aiui-nerv-terminal.aix --optimize
```

## 9. 真机调试

1. 在 AIUI Studio 中创建或绑定一个智能体。
2. 打开 Craft，导入 `aiui-nerv-terminal/`。
3. 使用 AIUI Studio 的打包和真机调试流程。
4. 在手机 Rokid AI App 中进入：
   `设置 → 开发者选项 → AIUI → 更新眼镜资源包`。
5. 下载完成后，对眼镜说：`乐奇，打开 NERV 智能体`，或者用语义命中你设置的名称。

## 10. 眼镜上的操作

| 操作 | 按键 |
|---|---|
| 移动焦点 | TouchPad 上下 / ArrowUp / ArrowDown |
| 选择 | 单击 / Enter |
| 返回 | 双击 / Backspace |
| 语音输入 | GlobalHook / 语音唤醒 |
| 审批 | 方向键选择后 Enter，或说“批准 / 拒绝” |
| 取消生成 | 说“停止”或“取消” |

流程：

```text
NERV Splash
  → 工作区列表
    → 工作区主页
      → 新建对话
      → 历史对话
        → 会话详情
          → 语音/文字输入
          → 流式回复
          → 工具状态
          → 审批弹层
```

## 11. 常见问题

- `spawnSync pnpm ENOEXEC`：重装 pnpm：
  `npm install -g pnpm@11.7.0 --allow-scripts=pnpm`
- 3090 端口被占用：修改 `dsh-nerv-bridge/cordis.patch.yml` 里的 `port`。
- AIUI 连不上：先用 probe 在 Mac 上确认 3090 正常，再从外部网络测试 WSS。
- 没有工作区：先在 DSH Web UI 里添加工作区目录。
- 审批一直不返回：确认眼镜端打开了对应会话；没有连接时 bridge 会交给 DSH 默认审批链。
- 关闭 DSH 后重连失败：检查 launchd 或手动重新执行 `dsh --profile nerv --no-open --port 3099`。

## 12. 安全注意

- 不要把 `sharedSecret`、DeepSeek API Key、Cloudflare 凭证提交到 Git。
- 只暴露 bridge 的 3090 端口，不要暴露 DSH Web UI。
- shared secret 相当于远程执行 Harness 工具的钥匙，请像 SSH 私钥一样保管。
- NERV 原版 logo 不要提交到公开仓库，使用 `assets/logo.placeholder.png` 或本地私有素材。
