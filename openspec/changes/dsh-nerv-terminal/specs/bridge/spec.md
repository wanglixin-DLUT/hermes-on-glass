## ADDED Requirements

### Requirement: Bridge is a DeepSeek Harness plugin

The bridge SHALL be installable as a DSH bundle and SHALL inject
`workspaceRegistry` and `sessionController`. It SHALL NOT read session JSONL
files directly.

#### Scenario: Plugin loads

- **WHEN** the bridge is installed into a DSH profile and the profile starts
- **THEN** the plugin starts a WebSocket listener on the configured loopback
  host and port

#### Scenario: Controller unavailable

- **WHEN** the required DSH services are not present in the profile
- **THEN** the plugin remains pending and does not answer WebSocket clients

### Requirement: Bridge exposes workspaces and sessions

The bridge SHALL map `workspaceRegistry.list()` to a `workspace_list` frame and
the selected workspace's session ids to a `session_list` frame.

#### Scenario: Workspace list

- **WHEN** a client sends `list_workspaces`
- **THEN** the bridge returns every workspace in registry order with id, title,
  path, session count, and running count

#### Scenario: Session list

- **WHEN** a client sends `select_workspace { workspaceId }`
- **THEN** the bridge returns the workspace's sessions ordered by latest
  activity, with id, title, updatedAt, running, and blank fields

### Requirement: Bridge creates and opens sessions

The bridge SHALL call `sessionController.create({ workspaceId })` for
`create_session`, and `sessionController.follow(...)` for `open_session`.

#### Scenario: New conversation

- **WHEN** a client sends `create_session { workspaceId }`
- **THEN** the bridge creates a DSH session and streams `session_created`
  followed by a `session_opened` snapshot

#### Scenario: Old conversation

- **WHEN** a client sends `open_session { sessionId }`
- **THEN** the bridge streams a `session_opened` snapshot containing the
  durable messages and the cursor for older history

### Requirement: Bridge forwards prompts, cancellations, and history

The bridge SHALL call `sessionController.prompt(...)`,
`sessionController.cancel(...)`, and `sessionController.page(...)`.

#### Scenario: Prompt admitted

- **WHEN** a client sends `user_message { sessionId, text }`
- **THEN** the bridge calls `prompt` with a unique requestId and returns an
  `ack` frame

#### Scenario: Older history

- **WHEN** a client sends `load_older` with `throughSeq` and `beforeSeq`
- **THEN** the bridge returns a `history_page` frame with older messages

### Requirement: Bridge forwards approvals

The bridge SHALL listen to the DSH `approval/request` waterfall and forward the
request to the connected client whose activeSessionId matches the request's
session. If no matching client exists it SHALL call `next()`.

#### Scenario: HUD is watching

- **WHEN** DSH asks for approval for session S and a client has S open
- **THEN** the client receives `approval_request` and its `approval_response`
  resolves the DSH request with `allowed-once` or `rejected`

#### Scenario: HUD is offline

- **WHEN** DSH asks for approval for a session with no connected client
- **THEN** the bridge delegates to the next answerer and does not silently
  approve

### Requirement: Bridge authenticates upgrades

The bridge SHALL reject WebSocket upgrades that do not present the configured
shared secret in the `Authorization` header or `token` query parameter.

#### Scenario: Missing secret

- **WHEN** an upgrade has no token
- **THEN** the bridge responds with HTTP 401 and does not create a connection

#### Scenario: Valid secret

- **WHEN** an upgrade presents the configured token
- **THEN** the bridge sends `server_hello` and accepts menu frames
