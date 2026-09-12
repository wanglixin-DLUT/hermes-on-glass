# NERV Glasses × DeepSeek Harness 完整方案

> 记录日期：2026-09-12
> 目标：Mac mini 运行 DeepSeek Harness，Rokid Glasses 光波导 HUD 显示 NERV 入口，先选工作区，再新建/查看对话。
> 原则：完全自用；最多 GitHub MIT 开源。

## 0. 结论

- 不需要买公网 IP。
- 不要在眼镜上跑 Harness；Harness 跑在 Mac mini，眼镜只做 HUD + 语音 + 按键。
- 推荐架构：**DeepSeek Harness 官方插件 + AIUI 智能体**。
- DSH 已内置工作区注册表（workspace registry）和会话控制器（session controller），无需自己造轮子。
- 公网入口推荐 Cloudflare Tunnel（需域名）或 Tailscale Funnel（免费）。
- DSH 是 developer preview，必须锁版本，插件加兼容层。

## 1. 总体架构

```text
DeepSeek API / 本地 OpenAI-compatible 模型
              ▲
              │ HTTPS
┌─────────────┴──────────────────────────────────────┐
│ Mac mini                                           │
│  dsh --profile nerv                                │
│   ├─ DSH Web UI 127.0.0.1:3080（仅管理）            │
│   └─ dsh-nerv-bridge 插件 127.0.0.1:3090            │
│        ├─ workspaceRegistry → 工作区菜单            │
│        ├─ sessionController → 新建/历史/继续/流式    │
│        ├─ sessionTitle → 旧对话标题                 │
│        ├─ approval/request → 审批转发               │
│        └─ WebSocket Server → 眼镜端协议             │
└─────────────▲──────────────────────────────────────┘
              │ Cloudflare Tunnel / Tailscale Funnel
              │ wss://nerv.example.com
┌─────────────┴──────────────────────────────────────┐
│ Rokid Glasses（AIUI）                              │
│  NERV Splash → Workspace List → Workspace Home     │
│    ├─ New Conversation                             │
│    └─ History → Conversation View                  │
└────────────────────────────────────────────────────┘
```

## 2. 眼镜端交互

### 页面流程

1. NERV Splash：绿色单色 logo + CONNECTING/ONLINE/OFFLINE。
2. Workspace List：只选择，不新建。
3. Workspace Home：新建对话 / 历史对话。
4. History List：旧对话列表，显示标题、时间、RUNNING/UNREAD。
5. Conversation View：消息流、工具状态、语音输入、审批弹层。

### 操作映射

- 上/下：TouchPad / ArrowUp/ArrowDown
- 选择：单击 / Enter
- 返回：双击 / Backspace
- 语音输入：GlobalHook/长按 + SpeechRecognitionSession
- 审批：方向键 + Enter，或语音“批准/拒绝”
- 取消生成：长按 / 语音“停止”

### 显示规范

- AIUI 单绿色光波导：纯黑=透明，只能一个绿色通道，参考画布 480×352。
- 主色 #40ff5e；避免大面积实心填充；线条 1px；优先低视觉质量。
- NERV logo 必须重绘为单绿色线稿；开源仓库不提交原版 logo，用原创占位图。

## 3. Mac mini 服务端：dsh-nerv-bridge

### 为什么用 DSH 插件

DSH 已经提供：
- ctx.workspaceRegistry：工作区是命名目录，持久化、可排序、按工作区分组会话。
- ctx.sessionController：list / create / page / follow / prompt / cancel。
- 会话标题、历史持久化、工具执行、审批。
- 插件体系：一切皆插件，MIT。

### 注入的服务

```text
ctx.workspaceRegistry
ctx.sessionController
ctx.sessionProjections
ctx.sessionTitle
ctx.on('approval/request')
ctx.userQuestions（可选）
```

### 模块划分

```text
dsh-nerv-bridge/
├── src/
│   ├── index.ts
│   ├── protocol.ts
│   ├── screens.ts
│   ├── workspace.ts
│   ├── sessions.ts
│   ├── history.ts
│   ├── approval.ts
│   ├── auth.ts
│   └── compat.ts
├── test/
├── package.json
└── cordis.patch.yml
```

### 眼镜端协议（服务端驱动 UI）

服务端 → 眼镜：
- screen.workspaces
- screen.workspace
- screen.history
- screen.conversation
- overlay.approval
- event.assistant / event.tool / notice

眼镜 → 服务端：
- workspace.select
- workspace.newSession
- workspace.history
- session.open
- session.prompt
- session.cancel
- history.loadOlder
- approval.respond
- nav.back

### 旧对话

- 打开：sessionController.follow({ sessionId }) 获取 snapshot + 实时事件。
- 加载更早：sessionController.page。
- 继续：sessionController.prompt，DSH 自动恢复冷会话。
- 不直接解析 session.jsonl。

### 审批策略

- 眼镜在线：转发审批，等待选择 allow-once/reject。
- 眼镜离线或超时：委托 DSH 默认审批链或 fail-closed。
- 绝不自动放行危险工具。

### 版本策略

- 锁定 DSH 版本。
- 所有 DSH API 调用集中在 compat.ts。
- 升级前让 LLM 读 release notes/diff，更新 compat.ts 并跑测试。

## 4. 你必须自己做的事（Agent 不能替代）

### 账号与支付

- DeepSeek 平台注册/实名/充值/创建 API Key。
- 域名购买（Cloudflare 方案，约 ¥30–100/年）。
- Cloudflare / Tailscale 登录与授权。
- GitHub 账号与仓库；决定开源范围。
- Rokid 账号 / AIUI Studio 登录 / 实名认证。
- 可选 VPS 购买。

### Mac mini

- 常开、常联网；关闭睡眠 `sudo pmset -a sleep 0 disksleep 0`。
- 决定 FileVault、自动登录；用 launchd 管理 DSH 和隧道。
- 授权麦克风、网络、后台权限。
- 物理位置、电源、网络连接。

### 网络

- 不需要公网 IP（推荐 Tunnel）。
- Cloudflare Tunnel：买域名、改 NS、cloudflared 登录、建 Tunnel/DNS route。
- Tailscale Funnel：登录 Tailscale、开启 Funnel。
- 用手机蜂窝网络验证 wss:// 外网可达。
- 如果隧道不可用，再考虑 VPS / 公网 IP / DDNS。

### Rokid 眼镜

- 手机装 Rokid AI App / Hi Rokid，配对眼镜。
- AIUI Studio 创建项目、真机调试、更新眼镜资源包。
- 戴上眼镜测试亮度、字号、FOV、按键、语音、不同光照。
- 若 AIUI 不允许任意 WSS 域名，备选裸机 Android / CXR-L。

### 决策

- 工作区目录与名称。
- 审批策略和危险工具白名单。
- 隐私、备份、数据保留。
- MIT 开源范围；不要提交任何 token、路径、NERV 原图。

## 5. 大模型/Agent 可以帮你做什么

- 读 DSH 固定版本源码，写 dsh-nerv-bridge 插件。
- 写 WebSocket 协议、菜单状态机、历史分页、流式转发。
- 接 approval/request 到眼镜审批 UI。
- 写 AIUI .ink 页面、单绿色样式、NERV 风格占位 logo。
- 写测试、mock SessionWireEvent、CI、secret scanning。
- 生成 launchd/cloudflared/Tailscale 配置和文档。
- DSH 升级时做兼容性修复。
- 运行时可选：标题、摘要、语音菜单意图解析、审批说明。

## 6. 实施阶段

### Phase 0：风险预验证
- AIUI 真机连接任意 wss:// 是否可行。
- 选择 Cloudflare Tunnel 或 Tailscale Funnel。
- 若 AIUI 不行，切裸机 Android / CXR-L。

### Phase 1：Mac mini + DSH
- 安装 Node/pnpm/Git。
- `npx @deepseek-ai/dsh web`
- 配置 DeepSeek API Key。
- Web UI 里添加工作区、跑通对话。
- `dsh --profile nerv --from-default-profile web`

### Phase 2：dsh-nerv-bridge
- 创建 DSH bundle。
- 注入 workspaceRegistry/sessionController。
- loopback WebSocket server 127.0.0.1:3090。
- 实现工作区/新建/历史/读取/流式/审批。
- 用 websocat 和假数据联调。

### Phase 3：公网隧道
- Cloudflare Tunnel / Tailscale Funnel。
- 映射 wss:// 到 127.0.0.1:3090。
- 外网测试、launchd 自动启动。

### Phase 4：AIUI 眼镜端
- NERV splash。
- 接 WebSocket 协议，渲染服务端 screen。
- 接按键、TouchPad、语音。
- 真机调 NERV logo/字号/亮度/焦点。

### Phase 5：验收
- 工作区列表与 DSH Web UI 一致。
- 新建对话、流式回复。
- 旧对话可查看、可继续。
- 标题正常。
- 工具状态和审批正常。
- Mac 重启后自动恢复。
- 公网不能访问 DSH Web UI。
- 仓库无密钥。

### Phase 6：MIT 开源
- README/架构/协议/部署文档。
- local/ 忽略目录放个人 NERV logo 和 token。
- MIT LICENSE、CI、gitleaks。
- v0.1.0。

## 7. 成本

- DeepSeek API：按量；建议默认 deepseek-flash，复杂任务用 deepseek-v4-pro。
- DeepSeek 峰谷价差 2 倍；北京时间晚上/周末更便宜。
- Cloudflare Tunnel 免费；Tailscale Funnel 免费。
- 域名约 ¥30–100/年。
- VPS 可选约 ¥20–60/月。
- 公网 IP：通常不需要。

## 8. 风险

- DSH developer preview 破坏性变更 → 锁版本 + compat.ts。
- AIUI 域名限制 → Phase 0 验证，备选裸机 Android。
- 隧道不稳定 → 备用 VPS/frp。
- 审批离线 → fail-closed。
- token 泄露 → 强随机 token、TLS、只暴露插件端口、轮换。
- 会话无法删除 → DSH 当前只支持工作区级归档隐藏。
- NERV 版权 → 个人自用可；GitHub 用原创占位图。
- 成本失控 → Flash 为主、峰谷调度、保持 session 缓存。

## 9. 参考链接

- DeepSeek Harness: https://github.com/deepseek-ai/deepseek-harness
- DSH 文档: https://deepseek-harness.github.io/deepseek-harness/en/guide/quickstart
- DSH Workspace: packages/workspace/workspace/README.md
- DSH Session Controller: packages/api/session-controller/README.md
- DSH Approval: docs/subsystems/approval.md
- DSH ACP 备选: packages/acp/acp/README.md
- DeepSeek API: https://api-docs.deepseek.com/
- AIUI 文档: https://js.rokid.com/AIUI
- AIUI 网络/域名白名单: documentation/0-guide/basic/network/usage.md
- AIUI 单绿色设计: design/monochrome/design-system-green.md
- Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- Tailscale Funnel: https://tailscale.com/kb/1223/funnel
