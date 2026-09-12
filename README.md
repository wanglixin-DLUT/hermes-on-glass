# nerv-on-glass

This repository is a fork of `wdaniel1993/hermes-on-glass`, adapted from
Hermes Agent to **DeepSeek Harness (DSH)**.

The original upstream design was a native Android phone-app + glasses-app pair
using Rokid CXR. This fork keeps the same product shape but changes the client
and the Mac-side integration for DSH:

- Mac mini runs **DeepSeek Harness**.
- A DSH plugin, `dsh-nerv-bridge/`, exposes the workspace/session menu over a
  small WebSocket protocol.
- The glasses client is an **AIUI agent** (`aiui-nerv-terminal/`) because AIUI
  is Rokid's public path for custom HUD pages and it already provides display,
  touchpad/key events, speech recognition, and packaging.
- No native Android phone app is required for the first version.
- No Hermes Python channel adapter is required.

## Why the architecture changed

Hermes already has a channel-adapter model, server-side voice, and its own
session registry. DSH already has a workspace registry, session controller,
durable history, streaming events, and approval requests. The right adaptation
is therefore not to port the Hermes adapter to DSH, but to expose DSH's existing
workspace/session model directly to the glasses HUD.

The DSH plugin injects `workspaceRegistry` and `sessionController` and maps:

- workspaces -> first-level menu
- workspace sessions -> history list
- `sessionController.create(...)` -> new conversation
- `sessionController.follow(...)` -> live assistant/tool stream
- `sessionController.page(...)` -> older history
- `approval/request` -> Approve / Reject prompt on the HUD

## Repository layout

```text
dsh-nerv-bridge/       # DeepSeek Harness plugin + WebSocket server + tests
aiui-nerv-terminal/    # Rokid AIUI agent (NERV-style HUD client)
openspec/changes/      # DSH adaptation proposal, design, specs, tasks
docs/                  # deployment and debugging notes
dsh-nerv-bridge/tools/ # helper probes
```

## Quick start

1. Install DSH and configure a DeepSeek API key.
2. Add a workspace in the DSH Web UI.
3. Install the bridge into a DSH profile:

   ```bash
   dsh plugin --profile nerv add ./dsh-nerv-bridge
   ```

4. Change `sharedSecret` in `dsh-nerv-bridge/cordis.patch.yml`.
5. Start the bridge profile:

   ```bash
   dsh --profile nerv
   ```

6. Put Cloudflare Tunnel or Tailscale Funnel in front of
   `http://127.0.0.1:3090`.
7. Configure `aiui-nerv-terminal/app.js` with the public `wss://` URL and the
   shared secret.
8. Import `aiui-nerv-terminal/` in Craft or AIUI Studio, then package it with
   `aix pack` and install it on the glasses.

## Documentation

- `docs/USAGE.md` — 中文完整安装与使用方法
- `dsh-nerv-bridge/README.md` — plugin and protocol reference
- `aiui-nerv-terminal/README.md` — HUD client setup
- `openspec/changes/dsh-nerv-terminal/` — product/architecture change
- `docs/dsh-vs-hermes.md` — adaptation notes
- `docs/debugging.md` — step-by-step bridge and HUD debugging
- `docs/PLAN.md` — original research plan
- `docs/AIUI-MAC-SETUP.md` — macOS AIUI toolchain setup record
- `LICENSE` — MIT for the new fork code
- `NOTICE.md` — upstream licensing note

## Status

This is a debugging scaffold. The bridge has unit tests with a fake DSH
controller. The AIUI app builds with `aix pack`. Hardware debugging still needs
a real Mac mini, a tunnel, and Rokid Glasses.
