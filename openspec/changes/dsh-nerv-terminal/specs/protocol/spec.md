## ADDED Requirements

### Requirement: Client-to-bridge frames

The protocol SHALL accept these client frame types:

`client_hello`, `list_workspaces`, `select_workspace`, `list_sessions`,
`create_session`, `open_session`, `load_older`, `user_message`, `cancel_turn`,
`approval_response`, `rename_session`, `ping`, `pong`.

#### Scenario: Unknown frame

- **WHEN** the bridge receives a JSON object with an unknown type
- **THEN** it returns an `error` frame and keeps the connection open

### Requirement: Bridge-to-client frames

The protocol SHALL emit these bridge frame types:

`server_hello`, `connection_update`, `workspace_list`, `session_list`,
`session_created`, `session_opened`, `message`, `assistant_start`,
`assistant_delta`, `assistant_end`, `tool_progress`, `history_page`,
`session_update`, `approval_request`, `approval_timeout`, `ack`, `error`,
`ping`, `pong`.

#### Scenario: Streaming assistant text

- **WHEN** DSH emits assistant text deltas for an open session
- **THEN** the bridge sends `assistant_start`, one `assistant_delta` per text
  delta, and `assistant_end` when the attempt settles

#### Scenario: Tool progress

- **WHEN** DSH emits a `tool/call` event
- **THEN** the bridge sends `tool_progress` with phase `started`; a matching
  `tool/result` sends phase `finished`

### Requirement: Messages are normalized

The bridge SHALL convert DSH `user/message`, `assistant/message`, `tool/call`,
and `tool/result` events into compact wire messages with id, role, text, time,
and seq. Unknown event types SHALL be ignored.

#### Scenario: Historical and live events use the same shape

- **WHEN** a page of history and a live follow event contain the same DSH event
- **THEN** both are rendered as the same wire message fields

### Requirement: Session opened snapshot

The `session_opened` frame SHALL contain the session id, title, normalized
messages, a `throughSeq` cursor, and `hasOlder`.

#### Scenario: Empty new session

- **WHEN** a newly created DSH session has no messages
- **THEN** `session_opened` contains an empty messages array and a cursor of -1
