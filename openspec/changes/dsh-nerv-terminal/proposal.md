## Why

The upstream `hermes-on-glass` design targeted Hermes Agent and native Android
apps. The user now runs **DeepSeek Harness (DSH)** on a Mac mini and wants the
glasses to act as a small terminal for DSH.

The required navigation model is stricter than a chat app:

1. Select a workspace (selection only, no workspace creation on the glasses).
2. In that workspace, choose "New conversation" or "History".
3. Open an old conversation and continue it.
4. Approve or reject DSH tool calls when asked.

DSH already models all of this with `workspaceRegistry` and
`sessionController`. Rebuilding it in Python or inside an Android app would
duplicate DSH state and drift from the Web UI.

## What Changes

- **Target DSH, not Hermes.** Remove the Python `BasePlatformAdapter`
  assumption. Add a DSH plugin that injects `workspaceRegistry` and
  `sessionController`.
- **Expose a normalized glasses protocol.** The plugin translates DSH
  workspaces, sessions, history pages, assistant deltas, tool progress, and
  approvals into a small JSON frame protocol.
- **Glasses client becomes AIUI.** Use the installed AIUI toolchain rather than
  a native Android glasses app. The HUD is a single AIUI agent with workspace,
  history, conversation, and approval screens.
- **No phone app in v1.** The AIUI client connects directly to the bridge over
  a public WSS endpoint, optionally through the phone proxy provided by Rokid
  AI App.
- **Voice stays on the glasses for v1.** DSH has no built-in STT/TTS channel.
  AIUI SpeechRecognition / TTS handles voice locally until a later proposal.
- **Keep the original Android/CXR design as history.** The old OpenSpec change
  is archived under `openspec/changes/archive/hermes-initial-mvp/`.

## Capabilities

### New Capabilities

- `bridge`: DSH plugin that owns the WebSocket listener, authentication,
  workspace/session menu, history paging, streaming, and approval forwarding.
- `protocol`: JSON frame vocabulary shared between the bridge and the AIUI
  client, including workspaces, sessions, messages, tool progress, and
  approvals.
- `aiui-hud`: Rokid AIUI agent that renders the NERV-style entry, workspace
  menu, history list, conversation view, and approval overlay.

### Modified Capabilities

None. This is a new change layered over the archived Hermes design.

## Impact

- New code: `dsh-nerv-bridge/` (Node/JavaScript DSH bundle) and
  `aiui-nerv-terminal/` (AIUI agent).
- DSH runtime: plugin must be installed into a DSH profile.
- Network: bridge listens on `127.0.0.1:3090`; a tunnel exposes only that port.
- Hardware: Rokid Glasses with AIUI developer mode.
- Security: shared secret on the WebSocket upgrade; approvals fail closed when
  no HUD client is connected.
