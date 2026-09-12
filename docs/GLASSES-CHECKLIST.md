# 让 NERV 项目在眼镜上跑起来：待办清单

> 生成日期：2026-09-13  
> 目标：在 Rokid Glasses 光波导 HUD 上看到 NERV 入口，选择工作区，新建或继续对话，并在眼镜上批准工具调用。

## 当前状态

已经完成：

- [x] Fork 项目并改成 DSH + AIUI 架构
- [x] DSH 插件 `dsh-nerv-bridge`
- [x] WebSocket 菜单协议与测试
- [x] 本地 `dsh --profile nerv` 安装
- [x] 真实 DSH 只读烟测：workspace_list / session_list 正常
- [x] AIUI 项目 `aiui-nerv-terminal`
- [x] `aix pack` 打包通过
- [x] 中文使用说明：`docs/USAGE.md`
- [x] 打包 Release：v0.1.0

还没完成：

- [ ] 公网 WSS 入口
- [ ] sharedSecret 正式替换
- [ ] AIUI 绑定和真机资源包更新
- [ ] 在眼镜上做端到端验收
- [ ] 长期运行的 launchd 自动启动

---

## 0. 先确认设备和服务器

- [ ] 确认眼镜型号是带光波导显示的 Rokid Glasses / 乐奇 AI 眼镜，系统为 YodaOS-Sprite。
  - 如果是 Rokid Max、Rokid Air、AR Studio、AR Lite 或 Glass3 企业版，路径不同。
- [ ] 确认哪台 Mac 当服务器：
  - 选项 A：当前这台 MacBook，先做快速验证。
  - 选项 B：Mac mini，适合长期常开。
- [ ] 服务器 Mac 必须满足：
  - 常开、常联网
  - 已安装 DeepSeek Harness 和 Node.js
  - DSH Web UI 里至少有一个工作区
  - 浏览器登录着同一个 Rokid 账号
- [ ] 如果先把当前 Mac 当服务器，确认这台机器的 DSH profile 已经可用。
- [ ] 如果换成 Mac mini，需要把仓库、DSH profile、`dsh-nerv-bridge` 和隧道配置复制过去。

---

## 1. 本地基础验证

如果继续使用当前这台 Mac，这一步已经基本完成，只需要重新确认。

- [ ] 进入项目目录：

```bash
cd ~/repos/hermes-on-glass
```

- [ ] 运行 bridge 测试：

```bash
cd dsh-nerv-bridge
npm test
```

- [ ] 启动 DSH `nerv` profile：

```bash
dsh --profile nerv --no-open --port 3099
```

- [ ] 另开终端做本地 probe：

```bash
cd ~/repos/hermes-on-glass/dsh-nerv-bridge
node tools/nerv-bridge-probe.js \
  --url ws://127.0.0.1:3090/glasses \
  --token 当前sharedSecret \
  --send '{"type":"list_workspaces"}'
```

- [ ] probe 能看到 `server_hello`、`connection_update`、`workspace_list`。
- [ ] DSH Web UI 里能看到工作区，并且眼镜菜单最终要显示同样的列表。

---

## 2. 修改 sharedSecret

这一步必须在接公网隧道之前完成。

- [ ] 生成一个随机 secret：

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

- [ ] 修改 `dsh-nerv-bridge/cordis.patch.yml`：

```yaml
sharedSecret: 你的新secret
```

- [ ] 同时修改 `aiui-nerv-terminal/app.js`：

```js
bridgeToken: '你的新secret',
```

- [ ] 如果要提交 Git，先把 `app.js` 里的 secret 改回 `CHANGE-ME`，或者使用本地未跟踪配置。
- [ ] 重启 DSH 后再跑一次本地 probe，确认新 secret 生效。

---

## 3. 配置公网 WSS

二选一即可。推荐先用 Tailscale Funnel 免费验证，稳定后再上 Cloudflare Tunnel 自定义域名。

### 方案 A：Tailscale Funnel

- [ ] 安装 Tailscale 并登录。
- [ ] 确认 Mac 节点在线。
- [ ] 执行：

```bash
tailscale funnel 3090
```

- [ ] 记下生成的 `https://<机器名>.<tailnet>.ts.net`。
- [ ] 在另一台设备上用手机热点访问该地址，确认外网可达。
- [ ] 如果 AIUI 不接受 `*.ts.net` 域名，改用 Cloudflare Tunnel 自有域名。

### 方案 B：Cloudflare Tunnel

- [ ] 准备一个域名，约 30 到 100 元每年。
- [ ] 把域名 DNS 接入 Cloudflare。
- [ ] 安装 `cloudflared`。
- [ ] 登录并创建 tunnel。
- [ ] 把 `nerv.你的域名` 指向 `http://127.0.0.1:3090`。
- [ ] 用外部网络访问 `https://nerv.你的域名` 验证可达。
- [ ] 确认 Cloudflare Tunnel 支持 WebSocket，尤其是 `wss://`。

### 外网验证命令

在另一台电脑或手机上，用手机热点网络执行：

```bash
npx wscat -c "wss://你的公网地址/glasses?token=你的secret"
```

连接后输入：

```json
{"type":"list_workspaces"}
```

能看到 `workspace_list` 即表示公网入口成功。

---

## 4. 配置 AIUI 并绑定智能体

- [ ] 修改 `aiui-nerv-terminal/app.js`：

```js
bridgeUrl: 'wss://你的公网地址/glasses',
bridgeToken: '你的secret',
```

- [ ] 本地检查和打包：

```bash
cd aiui-nerv-terminal
npm install
npx tsc --noEmit
cd ..
aix pack aiui-nerv-terminal -o dist/aiui-nerv-terminal.aix --optimize
```

- [ ] 登录 AIUI Studio：

```text
https://aiui.rokid.com/
```

- [ ] 在 Craft 中导入本地项目：

```text
https://js.rokid.com/craft
```

- [ ] 创建或绑定一个 AIUI 智能体。
- [ ] 填写名称、描述和图标。自用可以叫 `NERV Terminal`。
- [ ] 应用类别可以选工具或效率类。
- [ ] 权限至少勾选麦克风，和 `app.json` 里的 `RECORD_AUDIO` 保持一致。
- [ ] 生成 AIX 并同步到云端。
- [ ] 确认 AIUI 资源包已经绑定到你的账号和眼镜。

---

## 5. 更新到眼镜

- [ ] 手机安装 Rokid AI App 或 Hi Rokid。
- [ ] 登录与眼镜相同的 Rokid 账号。
- [ ] 通过蓝牙连接眼镜，并确认 App 内显示“已连接”。
- [ ] 打开手机 App 的：

```text
设置 -> 开发者选项 -> AIUI -> 更新眼镜资源包
```

- [ ] 等待“智能体资源包下载成功”。
- [ ] 对眼镜说：

```text
乐奇，打开 NERV 智能体
```

或者使用你在 AIUI Studio 中设置的名称。

---

## 6. 眼镜端验收清单

- [ ] NERV Splash 显示，并且状态为 `ONLINE`。
- [ ] 能进入工作区列表，且内容与 DSH Web UI 一致。
- [ ] 选择工作区后能看到“新建对话”和“历史对话”。
- [ ] 新建对话后能说话或输入文字，并看到流式回复。
- [ ] 工具执行时出现 `⚙ tool...` 状态行。
- [ ] 历史对话能看到旧会话标题。
- [ ] 打开旧会话后能看到历史消息并继续对话。
- [ ] 危险工具弹出审批层，能够批准一次或拒绝。
- [ ] 手机热点下也能连接公网 WSS。
- [ ] 眼镜熄屏再唤醒后能自动重连。
- [ ] 在室外强光和室内弱光下文字可读。
- [ ] NERV logo 不刺眼、不溢色、没有大面积泛光。
- [ ] 语音输入在嘈杂环境下仍然可用，或者文字输入可作为兜底。

---

## 7. 如果 AIUI 域名限制导致连不上

- [ ] 先验证最小 WSS 连接是否被 AIUI 拦截。
- [ ] 如果只是发布商店才需要域名白名单，自用真机调试可能不受影响。
- [ ] 如果自用也被拦截，选择以下一条：
  - [ ] 在 AIUI 开发者后台报备 `wss://` 域名。
  - [ ] 改用眼镜端裸机 Android 应用，直接连公网或局域网。
  - [ ] 改用 CXR-L / CXR-S 方案，走手机桥接。
- [ ] 裸机 Android 需要专用开发线和 ADB 调试线，零售充电线通常不够。

---

## 8. 长期日常使用

- [ ] 用 launchd 自动启动 DSH 和隧道。
- [ ] Mac 关闭自动睡眠：

```bash
sudo pmset -a sleep 0 disksleep 0
```

- [ ] 保持 Mac 常开、常联网。
- [ ] 定期轮换 sharedSecret。
- [ ] 不要把 DSH Web UI 暴露到公网，只暴露 bridge 端口。
- [ ] 备份 `~/.dsh` 和项目仓库。
- [ ] 如果公开 GitHub，确认没有提交 token、内网路径、NERV 原图和个人数据。

---

## 9. 最短路径建议

如果目标只是“先看到效果”：

1. [ ] 当前 Mac 当服务器。
2. [ ] 用 Tailscale Funnel，不买域名。
3. [ ] 改 sharedSecret。
4. [ ] 用 AIUI Studio 导入项目并绑定智能体。
5. [ ] 手机更新眼镜资源包。
6. [ ] 说“乐奇，打开 NERV 智能体”。
7. [ ] 确认工作区列表和新建对话。
8. [ ] 再慢慢补 Cloudflare 自定义域名、审批、历史对话和真机调优。

---

## 10. 常见错误速查

| 现象 | 可能原因 | 处理 |
|---|---|---|
| WebSocket 401 | secret 不一致 | 同步 `cordis.patch.yml` 和 `app.js` |
| 连接被拒绝 | DSH 或隧道没启动 | 启动 `dsh --profile nerv`，检查 3090 端口 |
| 工作区为空 | DSH 没有配置工作区 | 先在 DSH Web UI 添加目录 |
| 会话列表为空 | 工作区没有历史会话 | 新建一个对话并发送消息 |
| AIUI 一直 OFFLINE | 公网 WSS 不可达 | 先用 `npx wscat` 外网验证 |
| 没有审批弹层 | 眼镜没有打开对应会话 | 确认当前会话就是触发工具的会话 |
| 语音没反应 | 没给麦克风权限 | AIUI 权限勾选 `RECORD_AUDIO` |
| 旧会话打不开 | DSH 会话已移动或损坏 | 在 DSH Web UI 中检查该会话 |
