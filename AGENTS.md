# AGENTS.md

Orientation for AI agents working in this fork.

## What this is

A Rokid Glasses client for **DeepSeek Harness (DSH)**. The upstream project
targeted Hermes Agent plus native Android apps; this fork keeps the product
shape but adapts it to DSH and AIUI.

The Mac mini runs DSH. A DSH plugin exposes a WebSocket protocol for the
glasses. The glasses app is a Rokid AIUI agent.

## Read first

- `README.md` — project overview
- `openspec/changes/dsh-nerv-terminal/proposal.md` — why this fork exists
- `openspec/changes/dsh-nerv-terminal/design.md` — architecture decisions
- `openspec/changes/dsh-nerv-terminal/specs/` — success criteria
- `openspec/changes/dsh-nerv-terminal/tasks.md` — implementation checklist
- `docs/dsh-vs-hermes.md` — differences between Hermes and DSH

## Modules

- `dsh-nerv-bridge/` — TypeScript/JavaScript DSH plugin and WebSocket server.
  Runtime imports are limited to Node stdlib and `ws`; DSH internals are read
  through `ctx` services only.
- `aiui-nerv-terminal/` — AIUI single-file agent pages, assets, voice helper.
- `openspec/` — change proposals, designs, specs, tasks.
- `docs/` — deployment, tunneling, protocol, and debugging notes.

## Rules

- Do not add a native Android phone bridge for v1 unless a new proposal says so.
- Do not port the Hermes Python channel adapter. DSH already owns workspaces,
  sessions, history, streaming, and approvals.
- Keep DSH service access inside `dsh-nerv-bridge/src/dsh.js` so version drift
  is localized.
- Keep the glasses protocol normalized. Do not send raw DSH session events to
  the AIUI client.
- Bridge tests use a fake controller; run `npm test` inside `dsh-nerv-bridge`.
- AIUI asset packaging must keep `node_modules` and TypeScript dev deps out of
  the `.aix` bundle through `.aixignore`.
- Do not commit NERV artwork, API keys, shared secrets, or tunnel credentials.

## Version pinning

DeepSeek Harness is a developer preview. Record the exact DSH CLI version and
the `@deepseek-ai/dsh-*` package versions used for a working bridge. Update
`dsh-nerv-bridge/src/dsh.js` when an upstream API changes, then rerun tests.

## Build commands

```bash
# bridge tests
cd dsh-nerv-bridge && npm install && npm test

# AIUI package
cd aiui-nerv-terminal && npm install
cd .. && aix pack aiui-nerv-terminal -o dist/aiui-nerv-terminal.aix --optimize
```

## Security

The bridge is a remote control for a DSH agent with filesystem and shell tools.
Treat the shared secret like an SSH key. Keep the bridge on loopback and expose
only that port through a tunnel. Approvals fail closed when no glasses client
is connected.
