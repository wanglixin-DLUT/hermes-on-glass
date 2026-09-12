## ADDED Requirements

### Requirement: NERV-style entry screen

The AIUI agent SHALL render a splash screen with the local placeholder logo and
connection state before showing the workspace menu.

#### Scenario: Connect to bridge

- **WHEN** the page loads with a configured bridge URL and token
- **THEN** it opens the WebSocket, sends `client_hello`, and changes the splash
  status to ONLINE when `server_hello` arrives

#### Scenario: Bridge offline

- **WHEN** the socket closes
- **THEN** the splash shows OFFLINE and reconnects with exponential backoff

### Requirement: Workspace selection only

The HUD SHALL show the `workspace_list` items and SHALL send
`select_workspace` on selection. It SHALL NOT expose workspace creation.

#### Scenario: Select workspace

- **WHEN** the user focuses a workspace row and confirms
- **THEN** the HUD sends `select_workspace` and shows the workspace home menu

#### Scenario: No workspaces

- **WHEN** the workspace list is empty
- **THEN** the HUD shows a hint to configure workspaces in the DSH Web UI

### Requirement: Workspace home menu

The workspace home SHALL offer `New conversation` and `History`.

#### Scenario: New conversation

- **WHEN** the user selects New conversation
- **THEN** the HUD sends `create_session` and waits for `session_opened`

#### Scenario: History

- **WHEN** the user selects History
- **THEN** the HUD sends `list_sessions` and shows the returned sessions

### Requirement: Conversation view

The conversation view SHALL render normalized messages and live assistant
deltas, and SHALL send `user_message` for submitted text.

#### Scenario: Streaming assistant message

- **WHEN** `assistant_start` and `assistant_delta` frames arrive
- **THEN** the HUD updates the assistant message with matching id

#### Scenario: Voice input

- **WHEN** the user long-presses the temple key or starts voice capture
- **THEN** the AIUI page uses its speech recognition helper and places the final
  transcript into the input field

### Requirement: Approval overlay

The HUD SHALL show tool name, reason, and Allow once / Reject choices when an
`approval_request` frame arrives.

#### Scenario: Approve

- **WHEN** the user selects Allow once
- **THEN** the HUD sends `approval_response` with `outcome: allow-once`

#### Scenario: Reject

- **WHEN** the user selects Reject
- **THEN** the HUD sends `approval_response` with `outcome: reject-once`

### Requirement: Touchpad and key mapping

The HUD SHALL handle arrow keys, Enter, Backspace, and GlobalHook through AIUI
page events.

#### Scenario: Navigation

- **WHEN** the user presses ArrowUp or ArrowDown
- **THEN** focus moves within the current list or approval choices

#### Scenario: Back

- **WHEN** the user double-taps or presses Backspace
- **THEN** the HUD returns to the previous menu level

### Requirement: AIX package is small

The AIUI project SHALL exclude `node_modules`, TypeScript developer files, and
local logo overrides from the `.aix` package.

#### Scenario: Pack

- **WHEN** `aix pack` runs on `aiui-nerv-terminal`
- **THEN** the resulting `.aix` contains only runtime app files and assets
