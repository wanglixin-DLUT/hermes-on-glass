## Context

DSH runs on the Mac mini. It owns the model routes, sessions, workspace
registry, tool execution, and approval policy. The bridge must not create a
second source of truth for any of these.

The glasses display is small (AIUI safe canvas around 480x352) and monochrome
green. The UI must therefore be a small server-driven menu rather than a rich
chat client.

## Decisions

### D1: DSH plugin, not a sidecar ACP bridge

**Choice:** `dsh-nerv-bridge` runs inside the DSH process as a plugin and calls
`ctx.workspaceRegistry` / `ctx.sessionController`.

**Rationale:** The plugin gets titles, history pagination, follow streams,
approval waterfalls, and workspace membership for free. A sidecar ACP process
would force the bridge to maintain a duplicate transcript store.

**Trade-off:** DSH is a developer preview. All controller calls live in
`src/dsh.js`, tests use a fake controller, and the version is pinned in the
README.

### D2: Server-driven UI protocol

**Choice:** The bridge sends screen descriptions (`workspace_list`,
`session_list`, `session_opened`, `approval_request`) and the AIUI client only
renders the current screen and reports input.

**Rationale:** AIUI `.ink` pages should stay small and replaceable. Menu state,
pagination, and session lifecycle live on the Mac mini.

### D3: Workspaces select-only on glasses

**Choice:** The AIUI client never creates a workspace. It reads
`workspaceRegistry.list()` and sends `select_workspace`.

**Rationale:** User requirement. Workspaces are configured once in the DSH Web
UI. The bridge's `workspaceAllowCreate` is false by default.

### D4: New conversation creates a DSH session

**Choice:** `create_session` calls
`sessionController.create({ workspaceId })`; the returned session is opened
immediately with an empty history.

**Rationale:** One conversation maps to one DSH session, preserving DSH context,
KV cache, title generation, and resumption.

### D5: History and live output use the same presenters

**Choice:** `sessionController.follow()` and `sessionController.page()` both
produce DSH session events. `src/presenter.js` converts them into compact
wire messages: `user`, `assistant`, or `tool`.

**Rationale:** Historical and live transcripts render the same way. Unknown
event types are ignored rather than crashing the HUD.

### D6: Approvals are routed by active session

**Choice:** The bridge registers an `approval/request` waterfall listener.
When a connected client has the matching session open, it sends
`approval_request` and waits for `approval_response`. Otherwise it delegates to
`next()`.

**Rationale:** The glasses should be the human approval surface only for the
conversation the wearer is looking at. Fail-closed default is preserved for
unattended sessions.

### D7: Auth on the WebSocket upgrade

**Choice:** Accept `Authorization: Bearer <secret>` or `?token=<secret>`.
Bind to `127.0.0.1` by default. Public exposure goes through a tunnel.

**Rationale:** AIUI's WebSocket constructor cannot set a custom header, so the
query parameter is the fallback. TLS is provided by Cloudflare Tunnel or
Tailscale Funnel.

### D8: Voice on the glasses for v1

**Choice:** Use AIUI `SpeechRecognition` for short voice commands and message
dictation. Do not pipe Opus audio to DSH.

**Rationale:** DSH does not ship Hermes' TTS/STT pipeline. Keeping voice local
removes the phone relay, PCM handling, and audio caching from v1.

### D9: NERV asset stays local

**Choice:** The repository ships an original placeholder PNG. A user can drop a
personal NERV image into `aiui-nerv-terminal/assets/`, and `.aixignore` keeps
local overrides out of source control.

**Rationale:** Avoid copyright and trademark trouble in a public fork.

## Risks

- DSH developer-preview API drift -> adapter isolation and tests.
- AIUI endpoint/domain restrictions -> Phase 0 spike; fallback is a native CXR
  client in a future change.
- Tunnel availability -> Cloudflare Tunnel and Tailscale Funnel are both
  supported by configuration.
- Approval prompt while glasses are disconnected -> delegate to DSH, fail
  closed if no answerer exists.
- Voice recognition quality -> manual text input and menu commands remain
  usable without voice.
