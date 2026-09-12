<script def>
{
  "navigationBarTitleText": "NERV Terminal"
}
</script>

<script setup>
import { createVoiceController } from '../../lib/voice.js'

function requestId() {
  return 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

export default {
  data: {
    screen: 'splash',
    connection: 'connecting',
    statusText: 'CONNECTING',
    errorText: '',
    workspaces: [],
    sessions: [],
    menuItems: [],
    focusIndex: 0,
    currentWorkspace: null,
    currentSession: null,
    messages: [],
    toolLine: '',
    streamingId: null,
    inputText: '',
    voicePartial: '',
    recording: false,
    approval: null,
    approvalFocus: 0,
    reconnectDelay: 1000,
  },

  onLoad() {
    const app = getApp()
    this.bridgeUrl = app.globalData.bridgeUrl
    this.bridgeToken = app.globalData.bridgeToken
    this.closed = false
    this.voice = createVoiceController({
      onStart: () => this.setData({ recording: true, statusText: '聆听中…' }),
      onPartial: (text) => this.setData({ voicePartial: text }),
      onFinal: (text) => this.onVoiceFinal(text),
      onEnd: () => this.setData({ recording: false, voicePartial: '', statusText: this.connection === 'online' ? 'ONLINE' : this.statusText }),
      onError: (error) => this.setData({ recording: false, statusText: String(error) }),
    })
    this.connectBridge()
  },

  onUnload() {
    this.closed = true
    if (this.voice) this.voice.stop()
    this.closeBridge()
  },

  closeBridge() {
    if (this.socket) {
      try {
        this.socket.close()
      } catch (error) {
        console.log('close bridge failed', error)
      }
      this.socket = null
    }
  },

  connectBridge() {
    this.closeBridge()
    const separator = this.bridgeUrl.indexOf('?') >= 0 ? '&' : '?'
    const url = this.bridgeUrl + separator + 'token=' + encodeURIComponent(this.bridgeToken)
    this.setData({ connection: 'connecting', statusText: 'CONNECTING' })
    const socket = new WebSocket(url)
    this.socket = socket
    socket.onopen = () => {
      this.setData({ connection: 'online', reconnectDelay: 1000, statusText: 'ONLINE' })
      this.send({ type: 'client_hello', client: { name: 'aiui-nerv-terminal', version: '0.1.0' } })
    }
    socket.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data)
        this.handleFrame(frame)
      } catch (error) {
        console.log('bad bridge frame', error)
      }
    }
    socket.onerror = () => {
      this.setData({ connection: 'offline', statusText: 'ERROR' })
    }
    socket.onclose = () => {
      if (this.closed) return
      this.setData({ connection: 'offline', statusText: 'OFFLINE' })
      const delay = this.reconnectDelay
      this.setData({ reconnectDelay: Math.min(delay * 2, 30000) })
      setTimeout(() => this.connectBridge(), delay)
    }
  },

  send(frame) {
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(JSON.stringify(frame))
    }
  },

  handleFrame(frame) {
    if (frame.type === 'server_hello') return
    if (frame.type === 'ping') {
      this.send({ type: 'pong', ts: frame.ts })
      return
    }
    if (frame.type === 'connection_update') {
      this.setData({ connection: frame.connected ? 'online' : 'offline' })
      return
    }
    if (frame.type === 'workspace_list') {
      this.setData({ workspaces: frame.items || [], focusIndex: 0, screen: 'workspaces' })
      return
    }
    if (frame.type === 'session_list') {
      const sessions = frame.items || []
      this.setData({ sessions: sessions, focusIndex: 0 })
      if (this.data.screen === 'workspace') this.updateMenuCount(sessions.length)
      else this.setData({ screen: 'history' })
      return
    }
    if (frame.type === 'session_created') {
      this.setData({ messages: [], currentSession: { id: frame.sessionId, title: null }, screen: 'conversation', focusIndex: 0 })
      return
    }
    if (frame.type === 'session_opened') {
      this.setData({
        currentSession: frame.session || { id: frame.sessionId, title: null },
        messages: frame.messages || [],
        screen: 'conversation',
        focusIndex: 0,
      })
      return
    }
    if (frame.type === 'message') {
      this.mergeMessage(frame.message)
      return
    }
    if (frame.type === 'assistant_start') {
      this.setData({ streamingId: frame.messageId })
      this.mergeMessage({ id: frame.messageId, role: 'assistant', text: '', streaming: true })
      return
    }
    if (frame.type === 'assistant_delta') {
      this.appendDelta(frame.messageId, frame.delta)
      return
    }
    if (frame.type === 'assistant_end') {
      this.finishStream(frame.messageId)
      return
    }
    if (frame.type === 'tool_progress') {
      if (frame.message.phase === 'started') this.setData({ toolLine: '⚙ ' + frame.message.toolName + '…' })
      else this.setData({ toolLine: '' })
      return
    }
    if (frame.type === 'session_update') {
      if (this.data.currentSession && this.data.currentSession.id === frame.sessionId) {
        this.setData({ currentSession: { id: frame.sessionId, title: frame.title } })
      }
      return
    }
    if (frame.type === 'history_page') {
      const older = frame.messages || []
      this.setData({ messages: older.concat(this.data.messages || []) })
      return
    }
    if (frame.type === 'approval_request') {
      this.setData({ approval: frame, approvalFocus: 0, statusText: 'APPROVAL' })
      return
    }
    if (frame.type === 'approval_timeout') {
      this.setData({ approval: null, statusText: 'ONLINE' })
      return
    }
    if (frame.type === 'ack') return
    if (frame.type === 'error') {
      this.setData({ errorText: frame.message || 'bridge error' })
      return
    }
  },

  mergeMessage(message) {
    if (message === undefined || message === null || message.id === undefined || message.id === null) return
    const messages = (this.data.messages || []).slice()
    const index = messages.findIndex((item) => item.id === message.id)
    if (index >= 0) messages[index] = Object.assign({}, messages[index], message)
    else messages.push(message)
    this.setData({ messages: messages })
  },

  appendDelta(messageId, delta) {
    const messages = (this.data.messages || []).slice()
    const index = messages.findIndex((item) => item.id === messageId)
    if (index >= 0) {
      const next = Object.assign({}, messages[index])
      next.text = (next.text || '') + (delta || '')
      messages[index] = next
    } else {
      messages.push({ id: messageId, role: 'assistant', text: delta || '', streaming: true })
    }
    this.setData({ messages: messages })
  },

  finishStream(messageId) {
    const messages = (this.data.messages || []).slice()
    const index = messages.findIndex((item) => item.id === messageId)
    if (index >= 0) {
      const next = Object.assign({}, messages[index])
      next.streaming = false
      messages[index] = next
    }
    this.setData({ messages: messages, streamingId: null, toolLine: '' })
  },

  updateMenuCount(count) {
    this.setData({
      menuItems: [
        { id: 'new', label: '新建对话' },
        { id: 'history', label: '历史对话', count: count },
      ],
    })
  },

  openWorkspace(index) {
    const workspace = this.data.workspaces[index]
    if (workspace === undefined || workspace === null) return
    this.setData({ currentWorkspace: workspace, focusIndex: 0, screen: 'workspace', sessions: [], toolLine: '' })
    this.updateMenuCount(0)
    this.send({ type: 'select_workspace', workspaceId: workspace.id })
  },

  openHistory() {
    const workspace = this.data.currentWorkspace
    if (workspace === undefined || workspace === null) return
    this.setData({ focusIndex: 0, screen: 'history' })
    this.send({ type: 'list_sessions', workspaceId: workspace.id })
  },

  openConversation(index) {
    const session = this.data.sessions[index]
    if (session === undefined || session === null) return
    this.setData({ messages: [], focusIndex: 0, screen: 'conversation' })
    this.send({ type: 'open_session', sessionId: session.id })
  },

  newConversation() {
    const workspace = this.data.currentWorkspace
    if (workspace === undefined || workspace === null) return
    this.setData({ messages: [], focusIndex: 0, screen: 'conversation' })
    this.send({ type: 'create_session', workspaceId: workspace.id })
  },

  listLength() {
    if (this.data.screen === 'workspaces') return this.data.workspaces.length
    if (this.data.screen === 'workspace') return this.data.menuItems.length
    if (this.data.screen === 'history') return this.data.sessions.length
    return 0
  },

  moveFocus(delta) {
    if (this.data.approval) {
      this.setData({ approvalFocus: (this.data.approvalFocus + delta + 2) % 2 })
      return
    }
    const length = this.listLength()
    if (length === 0) return
    const next = (this.data.focusIndex + delta + length) % length
    this.setData({ focusIndex: next })
  },

  handleSelect() {
    if (this.data.approval) {
      this.respondApproval()
      return
    }
    if (this.data.screen === 'workspaces') {
      this.openWorkspace(this.data.focusIndex)
      return
    }
    if (this.data.screen === 'workspace') {
      const item = this.data.menuItems[this.data.focusIndex]
      if (item === undefined || item === null) return
      if (item.id === 'new') this.newConversation()
      else this.openHistory()
      return
    }
    if (this.data.screen === 'history') {
      this.openConversation(this.data.focusIndex)
      return
    }
    if (this.data.screen === 'conversation') this.sendPrompt()
  },

  goBack() {
    if (this.data.approval) {
      this.setData({ approval: null, statusText: 'ONLINE' })
      return
    }
    if (this.data.screen === 'conversation') this.setData({ screen: 'workspace', focusIndex: 0 })
    else if (this.data.screen === 'history') this.setData({ screen: 'workspace', focusIndex: 0 })
    else if (this.data.screen === 'workspace') this.setData({ screen: 'workspaces', focusIndex: 0 })
    else if (this.data.screen === 'workspaces') this.finish()
  },

  sendPrompt() {
    const text = String(this.data.inputText || '').trim()
    const session = this.data.currentSession
    if (text.length === 0 || session === undefined || session === null) return
    this.send({ type: 'user_message', sessionId: session.id, requestId: requestId(), text: text })
    this.setData({ inputText: '' })
  },

  cancelTurn() {
    const session = this.data.currentSession
    if (session === undefined || session === null) return
    this.send({ type: 'cancel_turn', sessionId: session.id })
  },

  respondApproval() {
    const approval = this.data.approval
    if (approval === undefined || approval === null) return
    const outcome = this.data.approvalFocus === 0 ? 'allow-once' : 'reject-once'
    this.send({ type: 'approval_response', requestId: approval.requestId, outcome: outcome })
    this.setData({ approval: null, approvalFocus: 0, statusText: 'ONLINE' })
  },

  toggleVoice() {
    if (this.voice === undefined) return
    if (this.voice.isListening()) this.voice.stop()
    else this.voice.start()
  },

  onVoiceFinal(text) {
    const phrase = String(text || '')
    if (this.data.approval) {
      if (phrase.indexOf('批准') >= 0 || phrase.indexOf('同意') >= 0) {
        this.setData({ approvalFocus: 0 })
        this.respondApproval()
      } else if (phrase.indexOf('拒绝') >= 0) {
        this.setData({ approvalFocus: 1 })
        this.respondApproval()
      }
      return
    }
    if (phrase.indexOf('返回') >= 0 || phrase.indexOf('退出') >= 0) {
      this.goBack()
      return
    }
    if (phrase.indexOf('新建') >= 0 && this.data.screen === 'workspace') {
      this.newConversation()
      return
    }
    if (phrase.indexOf('历史') >= 0 && this.data.screen === 'workspace') {
      this.openHistory()
      return
    }
    if (phrase.indexOf('发送') >= 0 && this.data.screen === 'conversation') {
      this.sendPrompt()
      return
    }
    if (phrase.indexOf('停止') >= 0 || phrase.indexOf('取消') >= 0) {
      this.cancelTurn()
      return
    }
    if (this.data.screen === 'conversation') {
      this.setData({ inputText: phrase })
      return
    }
  },

  onKeyDown(event) {
    if (event.code === 'ArrowUp') this.moveFocus(-1)
    if (event.code === 'ArrowDown') this.moveFocus(1)
  },

  onKeyUp(event) {
    if (event.code === 'Backspace') {
      event.preventDefault()
      this.goBack()
      return
    }
    if (event.code === 'Enter') {
      event.preventDefault()
      this.handleSelect()
      return
    }
    if (event.code === 'GlobalHook') {
      event.preventDefault()
      this.toggleVoice()
    }
  },

  onVoiceWakeup(event) {
    if (event) event.preventDefault()
    this.toggleVoice()
  },
}
</script>

<page>
  <view class="app">
    <view class="screen" ink:if="{{ screen === 'splash' }}">
      <image class="logo" src="/assets/logo.placeholder.png" mode="aspectFit"></image>
      <text class="status">{{ statusText }}</text>
      <text class="error" ink:if="{{ errorText }}">{{ errorText }}</text>
      <text class="hint">Double tap to exit · GlobalHook to talk</text>
    </view>

    <view class="screen" ink:elif="{{ screen === 'workspaces' }}">
      <text class="title">选择工作区</text>
      <scroll-view class="list" scroll-y>
        <view
          class="row {{ focusIndex === index ? 'focused' : '' }}"
          ink:for="{{ workspaces }}"
          ink:key="index"
          bindtap="handleSelect"
        >
          <text class="row-title">{{ item.title }}</text>
          <text class="row-meta">{{ item.sessionCount }} conversations</text>
        </view>
      </scroll-view>
      <text class="empty" ink:if="{{ workspaces.length === 0 }}">No workspaces. Configure them in DSH Web UI.</text>
    </view>

    <view class="screen" ink:elif="{{ screen === 'workspace' }}">
      <text class="title">{{ currentWorkspace.title }}</text>
      <scroll-view class="list" scroll-y>
        <view
          class="row {{ focusIndex === index ? 'focused' : '' }}"
          ink:for="{{ menuItems }}"
          ink:key="index"
          bindtap="handleSelect"
        >
          <text class="row-title">{{ item.label }}</text>
          <text class="row-meta" ink:if="{{ item.count }}">{{ item.count }}</text>
        </view>
      </scroll-view>
      <text class="hint">Enter select · Double tap back</text>
    </view>

    <view class="screen" ink:elif="{{ screen === 'history' }}">
      <text class="title">历史对话</text>
      <scroll-view class="list" scroll-y>
        <view
          class="row {{ focusIndex === index ? 'focused' : '' }}"
          ink:for="{{ sessions }}"
          ink:key="id"
          bindtap="handleSelect"
        >
          <text class="row-title">{{ item.title ? item.title : 'Untitled session' }}</text>
          <text class="row-meta">{{ item.running ? 'RUNNING' : 'IDLE' }} · {{ item.updatedAt }}</text>
        </view>
      </scroll-view>
      <text class="empty" ink:if="{{ sessions.length === 0 }}">No previous conversations.</text>
    </view>

    <view class="screen conversation" ink:elif="{{ screen === 'conversation' }}">
      <view class="conversation-head">
        <text class="title">{{ currentWorkspace.title }}</text>
        <text class="subtitle">{{ currentSession.title ? currentSession.title : 'New conversation' }}</text>
      </view>

      <scroll-view class="messages" scroll-y>
        <view class="message {{ item.role }}" ink:for="{{ messages }}" ink:key="id">
          <text class="message-role">{{ item.role }}</text>
          <text class="message-text">{{ item.text }}</text>
        </view>
      </scroll-view>

      <text class="tool-line" ink:if="{{ toolLine }}">{{ toolLine }}</text>

      <view class="approval" ink:if="{{ approval }}">
        <text class="approval-title">APPROVAL REQUIRED</text>
        <text class="approval-tool">{{ approval.toolName }}</text>
        <text class="approval-reason">{{ approval.reason }}</text>
        <view class="approval-options">
          <text class="approval-option {{ approvalFocus === 0 ? 'focused' : '' }}">批准一次</text>
          <text class="approval-option {{ approvalFocus === 1 ? 'focused' : '' }}">拒绝</text>
        </view>
      </view>

      <view class="input-line">
        <text class="input-text" ink:if="{{ inputText }}">{{ inputText }}</text>
        <text class="input-text" ink:elif="{{ recording }}">{{ voicePartial ? voicePartial : 'Listening…' }}</text>
        <text class="input-hint" ink:else>GlobalHook to talk</text>
      </view>
      <text class="hint">Enter send · Double tap back · Long press cancel</text>
    </view>

    <view class="statusbar">
      <text>{{ statusText }}</text>
      <text>{{ connection }}</text>
    </view>
  </view>
</page>

<style>
page,
.app {
  width: 100%;
  height: 100%;
  background: #000000;
  color: #40ff5e;
  font-family: sans-serif;
  overflow: hidden;
}

.screen {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 32px;
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.logo {
  width: 320px;
  height: 142px;
  margin: 56px auto 24px auto;
}

.title {
  font-size: 22px;
  line-height: 1.2;
  margin-bottom: 12px;
}

.subtitle {
  font-size: 12px;
  opacity: 0.72;
  margin-bottom: 12px;
}

.status {
  text-align: center;
  font-size: 16px;
  margin-top: 8px;
}

.error {
  color: #40ff5e;
  text-align: center;
  font-size: 12px;
  margin-top: 8px;
}

.hint,
.empty {
  font-size: 10px;
  opacity: 0.48;
  line-height: 1.4;
}

.empty {
  margin-top: 24px;
}

.list {
  flex: 1;
}

.row {
  min-height: 40px;
  border-bottom: 1px solid rgba(64, 255, 94, 0.24);
  padding: 8px 4px;
  box-sizing: border-box;
}

.row.focused {
  background: rgba(64, 255, 94, 0.12);
  border-left: 2px solid #40ff5e;
  padding-left: 8px;
}

.row-title {
  display: block;
  font-size: 14px;
}

.row-meta {
  display: block;
  font-size: 10px;
  opacity: 0.72;
  margin-top: 2px;
}

.conversation {
  padding-bottom: 8px;
}

.conversation-head {
  border-bottom: 1px solid rgba(64, 255, 94, 0.24);
}

.messages {
  flex: 1;
  margin-top: 8px;
}

.message {
  margin-bottom: 10px;
  padding-left: 4px;
  border-left: 1px solid rgba(64, 255, 94, 0.24);
}

.message.user {
  border-left-color: rgba(64, 255, 94, 0.72);
}

.message.assistant {
  border-left-color: #40ff5e;
}

.message.tool {
  border-left-color: rgba(64, 255, 94, 0.48);
}

.message-role {
  display: block;
  font-size: 10px;
  opacity: 0.48;
  text-transform: uppercase;
}

.message-text {
  display: block;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
}

.tool-line {
  font-size: 10px;
  opacity: 0.72;
  margin: 4px 0;
}

.approval {
  border: 1px dashed #40ff5e;
  padding: 8px;
  margin-bottom: 8px;
}

.approval-title {
  display: block;
  font-size: 10px;
  letter-spacing: 0.08em;
}

.approval-tool {
  display: block;
  font-size: 14px;
  margin-top: 4px;
}

.approval-reason {
  display: block;
  font-size: 11px;
  opacity: 0.72;
  margin-top: 2px;
}

.approval-options {
  display: flex;
  margin-top: 8px;
}

.approval-option {
  border: 1px solid rgba(64, 255, 94, 0.48);
  padding: 4px 8px;
  margin-right: 8px;
  font-size: 11px;
}

.approval-option.focused {
  border-color: #40ff5e;
  background: rgba(64, 255, 94, 0.12);
}

.input-line {
  border-top: 1px solid rgba(64, 255, 94, 0.24);
  padding-top: 6px;
}

.input-text {
  display: block;
  font-size: 12px;
  line-height: 1.4;
}

.statusbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 32px;
  padding: 0 16px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  opacity: 0.48;
  border-top: 1px solid rgba(64, 255, 94, 0.24);
}
</style>
