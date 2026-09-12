# AIUI macOS 本地开发工具包安装记录

> 安装日期：2026-09-12  
> 主机：macOS 26.3.1（arm64）  
> 仓库：~/repos/nerv-glasses

## 已安装内容

### 1. AIUI 项目脚手架

已在以下目录创建 AIUI 智能体项目：

```text
apps/aiui-nerv-terminal/
├── AGENTS.md
├── app.js
├── app.json
├── package.json
├── pages/index/index.ink
├── tsconfig.json
├── types/aiui.d.ts
└── .aixignore
```

脚手架来自官方 npm 包：

```bash
npx @yodaos-pkg/create-aiui-agent@latest aiui-nerv-terminal
```

### 2. TypeScript + AIUI 类型定义

项目 `apps/aiui-nerv-terminal` 中已安装：

```bash
npm install -D typescript@5.9.3 @yodaos-pkg/ink-env@0.16.0
```

并创建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["@yodaos-pkg/ink-env"]
  },
  "include": ["**/*.ts", "**/*.d.ts"]
}
```

说明：`skipLibCheck` 用于跳过 `@yodaos-pkg/ink-env` 声明文件自身的类型兼容检查。

验证：

```bash
cd apps/aiui-nerv-terminal
npx tsc --noEmit
```

### 3. AIX-CLI

全局安装：

```bash
npm install -g @yodaos-pkg/aix-cli@latest
```

验证 AIX 打包：

```bash
cd ~/repos/nerv-glasses
aix pack apps/aiui-nerv-terminal -o /tmp/aiui-nerv-terminal-test.aix --optimize
aix list /tmp/aiui-nerv-terminal-test.aix
```

已创建 `.aixignore`，排除 `node_modules`、TypeScript 开发依赖等，避免 AIX 包被开发依赖撑大。

### 4. aiui-dev Skill

已从官方 AIUI 仓库同步 skill 源文件：

```text
skills/aiui-dev/
```

并通过 `skills` CLI 安装到本仓库支持的 Coding Agent：

```text
.agents/skills/aiui-dev
.claude/skills/aiui-dev
```

安装命令（本地源）：

```bash
npx skills add ./skills/aiui-dev --copy -y -a codex -a claude-code
```

### 5. macOS / Apple 开发环境现状

- Xcode Command Line Tools 已安装：
  - `/Library/Developer/CommandLineTools`
  - 版本：26.2.0.0.1
- 未安装完整 Xcode。
- **AIUI 当前没有独立的 Xcode / Apple SDK 安装包。**
  - AIUI 是运行在 Rokid 眼镜上的 Agent Runtime；
  - 官方本地工具链是 npm 工具链（create-aiui-agent、ink-env、aix-cli、skills）；
  - 官方 Web IDE / 调试平台是 AIUI Studio 和 Craft；
  - 完整 Xcode 仅在你要另行开发 iOS 原生宿主、使用 CXR-L iOS SDK 等场景才需要。

### 6. 浏览器端官方工具

无需本地安装，直接访问：

- AIUI Studio：<https://aiui.rokid.com/>
- Craft（AIUI Web IDE）：<https://js.rokid.com/craft>
- AIUI 官方文档：<https://js.rokid.com/AIUI>

## 常用命令

```bash
# 进入 AIUI 项目
cd ~/repos/nerv-glasses/apps/aiui-nerv-terminal

# TypeScript 类型检查
npx tsc --noEmit

# 打包 AIX
cd ~/repos/nerv-glasses
aix pack apps/aiui-nerv-terminal -o dist/aiui-nerv-terminal.aix --optimize

# 查看 AIX 内容
aix list dist/aiui-nerv-terminal.aix
```

## 下一步

1. 用 Craft 导入 `apps/aiui-nerv-terminal`，做 Web 端预览。
2. 在 AIUI Studio 创建/绑定智能体，进行真机调试。
3. 实现 NERV 启动页、WebSocket 客户端和多级菜单。
4. 同时开发 `dsh-nerv-bridge` 插件，暴露工作区/对话协议。
5. 配置 Cloudflare Tunnel 或 Tailscale Funnel，把 Mac mini 的插件端口安全暴露给眼镜。

## 重要说明

- **不要**把 DeepSeek API Key、设备 token、Cloudflare 凭证、NERV 原版 logo 提交到 Git 仓库。
- AIUI 上线商店前通常需要域名白名单报备；纯自用真机调试需要先验证任意 `wss://` 域名是否放行。
- AIUI 单绿色光波导：纯黑=透明，只有绿色通道可用；NERV logo 需要做单绿色线稿版本。
