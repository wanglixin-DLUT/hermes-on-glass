# dsh-nerv-bridge

DeepSeek Harness plugin that exposes a tiny WebSocket menu for Rokid Glasses.

The glasses client (`aiui-nerv-terminal/`) never sees raw DSH events. The bridge
normalizes DSH workspaces, sessions, streaming assistant text, tool progress,
and approval requests into a server-driven UI protocol.

## What it injects

- `ctx.workspaceRegistry`
- `ctx.sessionController`

It listens to `approval/request` and forwards approvals only to the connected
glasses client that currently has the matching session open.

## Install

From this repository:

```bash
dsh plugin --profile nerv add ./dsh-nerv-bridge
```

Then edit `cordis.patch.yml` before starting the profile:

```yaml
sharedSecret: change-me
port: 3090
```

Start:

```bash
dsh --profile nerv
```

The bridge listens on `127.0.0.1:3090` by default. Put Cloudflare Tunnel or
Tailscale Funnel in front of it; do not expose the DSH Web UI itself.

## Test

```bash
cd dsh-nerv-bridge
npm install
npm test
```

The tests use a fake controller and a real WebSocket server, so they do not
need DSH or Rokid hardware.

## Probe

```bash
node tools/nerv-bridge-probe.js --url ws://127.0.0.1:3090/glasses --token change-me
```

## Protocol

Client to bridge:

```text
client_hello
list_workspaces
select_workspace
list_sessions
create_session
open_session
load_older
user_message
cancel_turn
approval_response
rename_session
ping / pong
```

Bridge to client:

```text
server_hello
connection_update
workspace_list
session_list
session_created
session_opened
message
assistant_start / assistant_delta / assistant_end
tool_progress
history_page
session_update
approval_request / approval_timeout
ack
error
ping / pong
```

All frames are JSON objects with a `type` field. Source: `src/server.js`,
`src/presenter.js`, `src/dsh.js`.
