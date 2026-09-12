# DSH vs Hermes adaptation notes

This fork started from `hermes-on-glass`, which was a specification-only
project. Upstream had no application code; it described a Hermes channel
adapter plus native Android phone/glasses apps.

We adapted the design to DeepSeek Harness and the AIUI glasses client.

## What stays the same

- Glasses are a wearable HUD with touchpad/key input.
- The Mac mini is the only always-on host.
- Work is organized by workspace, then by conversation.
- The phone/glasses side must not implement its own agent loop.

## What changed

| Upstream Hermes design | This DSH fork |
|---|---|
| Python `BasePlatformAdapter` subclass | DSH plugin (`apply(ctx)`) injected with `workspaceRegistry` and `sessionController` |
| Hermes owns channels and sessions | DSH owns workspaces, sessions, history, titles, and approvals |
| Hermes provides server-side STT/TTS | v1 uses AIUI speech recognition / TTS on the glasses; audio frames are not sent to DSH |
| Native Android phone + glasses apps via CXR | AIUI agent on the glasses; no phone app required for v1 |
| `chat_id`-based session routing | Explicit workspaceId + sessionId routing |
| Hermes `send`/`send_voice` outbound hooks | `sessionController.follow(...)` stream normalized into assistant/tool frames |
| Approve/deny through Hermes channel commands | `approval/request` forwarded to the HUD with one-shot allow/reject |
| Tailscale-only WS with Bearer header | Bearer header and query token; intended to sit behind Cloudflare Tunnel or Tailscale Funnel |
| Session list is a thin Hermes view | Workspace list -> session list -> new/old conversation is the primary navigation model |

## Why drop the native Android bridge for v1

The upstream Android design depended on:

- Rokid CXR-M / CXR-S SDKs with Bluetooth pairing and APK sideload.
- A separate glasses app plus a phone app.
- Phone-side relay of Opus audio and 256 KB JPEGs.

DSH does not provide the Hermes voice pipeline that made that relay useful. AIUI
already gives the glasses a supported custom UI runtime with key events,
speech recognition, and packaging. For the first debug loop, the shortest path
is:

```text
AIUI HUD <-> wss:// public bridge <-> DSH plugin <-> DeepSeek Harness
```

A future proposal can add a native CXR path if AIUI cannot connect to the
required endpoint or if background audio/screen wake becomes mandatory.

## Why a plugin instead of reading session files

DSH exports:

- `ctx.workspaceRegistry` for persistent named workspaces and grouped sessions.
- `ctx.sessionController` for `list`, `create`, `page`, `follow`, `prompt`,
  `cancel`, and `rename`.
- `approval/request` for one-shot human decisions.

Reading `session.jsonl` directly would duplicate title folding, pagination,
compaction, fork logic, and privacy boundaries. The plugin uses the same
services the DSH Web UI uses.

## Known DSH gaps handled by the bridge

- DSH has no built-in voice channel. Voice stays on the glasses for v1.
- DSH has no session deletion in the public API. Old conversations can be
  viewed and continued but not deleted from the HUD.
- DSH is a developer preview. The bridge isolates controller calls in
  `src/dsh.js` and tests with a fake controller.
- Approvals may arrive while the glasses are offline. The bridge delegates to
  the next DSH answerer; if none answers, DSH fails closed.
