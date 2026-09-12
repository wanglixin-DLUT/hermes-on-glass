## 1. Foundation

- [x] 1.1 Archive the Hermes-focused change under `openspec/changes/archive/hermes-initial-mvp/`
- [x] 1.2 Create the DSH change proposal/design/specs/tasks
- [x] 1.3 Rewrite root README and AGENTS for the DSH adaptation
- [x] 1.4 Document DSH-vs-Hermes differences in `docs/dsh-vs-hermes.md`

## 2. DSH bridge plugin

- [x] 2.1 Bundle manifest (`package.json`, `cordis.patch.yml`)
- [x] 2.2 Config defaults and secret warning
- [x] 2.3 DSH controller adapter (`src/dsh.js`)
- [x] 2.4 Presenter for user/assistant/tool events (`src/presenter.js`)
- [x] 2.5 WebSocket server with token auth (`src/server.js`)
- [x] 2.6 Workspace list, session list, create, open, history paging
- [x] 2.7 Assistant streaming frames and tool progress frames
- [x] 2.8 Approval request/response bridge
- [x] 2.9 Fake-DSH WebSocket tests
- [x] 2.10 CLI probe (`tools/nerv-bridge-probe.js`)

## 3. AIUI HUD

- [x] 3.1 Create `aiui-nerv-terminal/` AIUI project
- [x] 3.2 Splash screen with placeholder logo
- [x] 3.3 Workspace list, workspace home, history list
- [x] 3.4 Conversation view with streaming assistant messages
- [x] 3.5 Approval overlay
- [x] 3.6 Key event mapping and voice helper
- [x] 3.7 `.aixignore` and package build check

## 4. Human setup

- [ ] 4.1 Start DSH Web UI and add at least one workspace
- [ ] 4.2 Install the bridge into a custom `nerv` profile
- [ ] 4.3 Change `sharedSecret` in `dsh-nerv-bridge/cordis.patch.yml`
- [ ] 4.4 Configure Cloudflare Tunnel or Tailscale Funnel to `127.0.0.1:3090`
- [ ] 4.5 Put the public `wss://` URL and token in `aiui-nerv-terminal/app.js`
- [ ] 4.6 Import the AIUI project in Craft / AIUI Studio
- [ ] 4.7 Package with `aix pack` and download the resource pack to the glasses

## 5. End-to-end debug

- [ ] 5.1 Probe the bridge from the Mac with `npm run probe`
- [ ] 5.2 Verify workspace list on the glasses HUD
- [ ] 5.3 Verify new conversation and a streaming reply
- [ ] 5.4 Verify old conversation list and continue
- [ ] 5.5 Verify tool progress line
- [ ] 5.6 Verify approval overlay allow/reject
- [ ] 5.7 Verify reconnect after sleep/network loss
- [ ] 5.8 Verify Mac reboot auto-start through launchd
- [ ] 5.9 Verify public DSH Web UI is not exposed

## 6. Later (new proposal required)

- [ ] 6.1 AIUI domain-whitelist validation and fallback decision
- [ ] 6.2 Native CXR phone/glasses bridge if AIUI cannot connect
- [ ] 6.3 Server-side STT/TTS via a local Hermes-like voice service
- [ ] 6.4 Session rename/archive/search on the HUD
- [ ] 6.5 Multi-device pairing and token rotation
