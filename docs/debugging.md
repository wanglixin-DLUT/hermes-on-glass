# Debugging the NERV bridge

## 1. DSH profile

Create the profile and install the bridge:

```bash
dsh --profile nerv --from-default-profile web --dump-config
dsh plugin --profile nerv add ./dsh-nerv-bridge
```

Confirm the plugin row is in the composed config:

```bash
dsh --profile nerv --dump-config | grep -A10 dsh-nerv-bridge
```

Change `sharedSecret` in `dsh-nerv-bridge/cordis.patch.yml` before exposing the
bridge through a tunnel.

## 2. Start DSH

```bash
dsh --profile nerv --no-open --port 3099
```

Expected log:

```text
[dsh-nerv-bridge] listening on 127.0.0.1:3090
dsh web: http://127.0.0.1:3099/?token=...
```

Check the listener:

```bash
lsof -nP -iTCP:3090 -sTCP:LISTEN
```

## 3. Probe the bridge

From another terminal:

```bash
cd dsh-nerv-bridge
node tools/nerv-bridge-probe.js \
  --url ws://127.0.0.1:3090/glasses \
  --token change-me \
  --send '{"type":"list_workspaces"}'
```

Expected first frames:

- `server_hello`
- `connection_update`
- `workspace_list`

To inspect a workspace:

```bash
node tools/nerv-bridge-probe.js \
  --url ws://127.0.0.1:3090/glasses \
  --token change-me \
  --send '{"type":"select_workspace","workspaceId":"WORKSPACE_ID"}'
```

## 4. Tunnel

Cloudflare Tunnel example:

```bash
cloudflared tunnel --url http://127.0.0.1:3090
```

Tailscale Funnel example:

```bash
tailscale funnel 3090
```

Use the generated `wss://` host in `aiui-nerv-terminal/app.js` and append the
same shared secret as the token.

## 5. AIUI client

```bash
cd aiui-nerv-terminal
npm install
npx tsc --noEmit
cd ..
aix pack aiui-nerv-terminal -o dist/aiui-nerv-terminal.aix --optimize
```

Then in the Rokid AI App developer options, update the glasses resource pack.

## 6. End-to-end checks

1. Glasses splash shows ONLINE.
2. Workspace list matches DSH Web UI.
3. New conversation creates a DSH session.
4. Sending a message produces `assistant_start`, deltas, and `assistant_end`.
5. History lists the persisted DSH session and opens its messages.
6. A tool call produces a `tool_progress` line.
7. A risky tool call produces an approval overlay.
8. Rejecting the approval keeps the agent fail-closed.
9. Killing DSH and restarting it brings the bridge back on the same port.
10. The DSH Web UI is still only bound to loopback.

## 7. Common failures

- `spawnSync pnpm ENOEXEC`: reinstall pnpm as a normal npm package
  (`npm install -g pnpm@11.7.0 --allow-scripts=pnpm`).
- Bridge port already in use: change `port` in the bundle config or stop the
  old DSH process.
- AIUI cannot connect: verify the public `wss://` URL with `websocat` or the
  probe from outside the LAN.
- No workspace list: confirm the DSH Web UI has at least one workspace.
- Approval hangs: confirm a glasses client has the matching session open; the
  bridge delegates to the next DSH answerer otherwise.
