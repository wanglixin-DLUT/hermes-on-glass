import http from 'node:http'
import crypto from 'node:crypto'
import { WebSocketServer } from 'ws'
import { encode, parseFrame, errorFrame } from './protocol.js'
import { recordsToWireMessages, extractTitle, eventToWireMessages } from './presenter.js'

function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  if (a.length === b.length) return crypto.timingSafeEqual(a, b)
  return false
}

function bearerToken(req) {
  const header = req.headers.authorization || ''
  const prefix = 'Bearer '
  if (header.startsWith(prefix)) return header.slice(prefix.length)
  return ''
}

function queryToken(req) {
  try {
    const url = new URL(req.url, 'http://localhost')
    return url.searchParams.get('token') || ''
  } catch (error) {
    return ''
  }
}

export class BridgeServer {
  constructor(options) {
    this.ctx = options.ctx
    this.config = options.config
    this.dsh = options.dsh
    this.logger = options.logger
    this.connections = new Set()
    this.httpServer = null
    this.wss = null
    this.heartbeatTimer = null
  }

  authorize(req) {
    if (this.config.allowAnonymous) return true
    const expected = this.config.sharedSecret
    if (expected.length === 0) return false
    const offered = bearerToken(req) || queryToken(req)
    if (offered.length === 0) return false
    return safeEqual(offered, expected)
  }

  async start() {
    this.httpServer = http.createServer((req, res) => {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('dsh-nerv-bridge')
    })
    this.wss = new WebSocketServer({ noServer: true })

    this.httpServer.on('upgrade', (req, socket, head) => {
      if (this.authorize(req) === false) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        const connection = new BridgeConnection({ server: this, ws: ws, dsh: this.dsh, logger: this.logger })
        this.connections.add(connection)
        connection.start()
      })
    })

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        this.httpServer.removeListener('listening', onListening)
        reject(error)
      }
      const onListening = () => {
        this.httpServer.removeListener('error', onError)
        resolve()
      }
      this.httpServer.once('error', onError)
      this.httpServer.once('listening', onListening)
      this.httpServer.listen(this.config.port, this.config.host)
    })

    this.logger.info('listening on ' + this.config.host + ':' + String(this.config.port))
    this.heartbeatTimer = setInterval(() => this.sweep(), this.config.heartbeatSeconds * 1000)
    return this
  }

  address() {
    if (this.httpServer === null) return null
    const address = this.httpServer.address()
    if (address && typeof address === 'object') return address
    return null
  }

  sweep() {
    const now = Date.now()
    const staleAfter = this.config.heartbeatSeconds * 2500
    for (const connection of Array.from(this.connections)) {
      if (now - connection.lastSeen > staleAfter) connection.terminate()
      else connection.ping()
    }
  }

  findConnectionForSession(sessionId) {
    for (const connection of this.connections) {
      if (connection.activeSessionId === sessionId) return connection
    }
    return null
  }

  async handleApproval(request, next) {
    const agent = request ? request.agent : undefined
    const session = agent ? agent.session : undefined
    const sessionId = session ? String(session.id) : ''
    if (sessionId.length === 0) return next()
    const connection = this.findConnectionForSession(sessionId)
    if (connection === null) return next()
    return connection.requestApproval(request)
  }

  close() {
    if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer)
    for (const connection of Array.from(this.connections)) connection.dispose('server closed')
    if (this.wss !== null) this.wss.close()
    if (this.httpServer !== null) this.httpServer.close()
  }
}

export class BridgeConnection {
  constructor(options) {
    this.server = options.server
    this.config = options.server.config
    this.ws = options.ws
    this.dsh = options.dsh
    this.logger = options.logger
    this.workspaceId = null
    this.activeSessionId = null
    this.followAbort = null
    this.followTask = null
    this.pendingApprovals = new Map()
    this.toolNames = new Map()
    this.throughSeq = -1
    this.lastSeen = Date.now()
    this.disposed = false
  }

  start() {
    this.ws.on('message', (data) => this.onMessage(data))
    this.ws.on('close', () => this.dispose('client closed'))
    this.ws.on('error', (error) => this.logger.warn('websocket error: ' + String(error)))
    this.send({
      type: 'server_hello',
      protocolVersion: this.config.protocolVersion,
      server: { name: 'dsh-nerv-bridge', version: '0.1.0' },
      capabilities: { workspaces: true, sessions: true, history: true, streaming: true, approval: true, images: true },
    })
    this.send({ type: 'connection_update', connected: true })
  }

  isOpen() {
    return this.ws.readyState === 1
  }

  ping() {
    this.send({ type: 'ping', ts: Date.now() })
  }

  terminate() {
    try {
      this.ws.terminate()
    } catch (error) {
      this.logger.warn('terminate failed: ' + String(error))
    }
  }

  send(frame) {
    if (this.isOpen() === false) return
    this.logger.frame('<-', frame)
    this.ws.send(encode(frame))
  }

  async onMessage(raw) {
    this.lastSeen = Date.now()
    const parsed = parseFrame(raw)
    if (parsed.ok === false) {
      this.send(errorFrame(parsed.reason))
      return
    }
    this.logger.frame('->', parsed.frame)
    try {
      await this.handleFrame(parsed.frame)
    } catch (error) {
      this.send(errorFrame(error && error.message ? error.message : String(error), parsed.frame.requestId))
    }
  }

  async handleFrame(frame) {
    if (frame.type === 'ping') {
      this.send({ type: 'pong', ts: frame.ts === undefined ? Date.now() : frame.ts })
      return
    }
    if (frame.type === 'pong') return
    if (frame.type === 'client_hello') {
      await this.sendWorkspaces()
      return
    }
    if (frame.type === 'list_workspaces') {
      await this.sendWorkspaces()
      return
    }
    if (frame.type === 'select_workspace') {
      await this.sendSessions(frame.workspaceId)
      return
    }
    if (frame.type === 'list_sessions') {
      await this.sendSessions(frame.workspaceId === undefined ? this.workspaceId : frame.workspaceId)
      return
    }
    if (frame.type === 'create_session') {
      await this.createAndOpen(frame.workspaceId === undefined ? this.workspaceId : frame.workspaceId)
      return
    }
    if (frame.type === 'open_session') {
      await this.openSession(frame.sessionId)
      return
    }
    if (frame.type === 'load_older') {
      await this.loadOlder(frame)
      return
    }
    if (frame.type === 'user_message') {
      await this.prompt(frame)
      return
    }
    if (frame.type === 'cancel_turn') {
      await this.cancel(frame.sessionId)
      return
    }
    if (frame.type === 'approval_response') {
      this.resolveApproval(frame)
      return
    }
    if (frame.type === 'rename_session') {
      await this.rename(frame.sessionId, frame.title)
      return
    }
    this.send(errorFrame('unknown frame type: ' + String(frame.type), frame.requestId))
  }

  async sendWorkspaces() {
    const items = await this.dsh.listWorkspaces()
    this.send({ type: 'workspace_list', items: items })
  }

  async sendSessions(workspaceId) {
    if (workspaceId === undefined || workspaceId === null || String(workspaceId).length === 0) {
      this.send(errorFrame('workspaceId is required'))
      return
    }
    this.workspaceId = String(workspaceId)
    const items = await this.dsh.listSessions(this.workspaceId)
    this.send({ type: 'session_list', workspaceId: this.workspaceId, items: items })
  }

  async createAndOpen(workspaceId) {
    if (workspaceId === undefined || workspaceId === null || String(workspaceId).length === 0) {
      this.send(errorFrame('workspaceId is required'))
      return
    }
    if (this.config.workspaceAllowCreate === false) {
      const workspace = await this.dsh.listWorkspaces().then((items) => items.find((item) => item.id === String(workspaceId)))
      if (workspace === undefined) {
        this.send(errorFrame('workspace not found: ' + String(workspaceId)))
        return
      }
    }
    const sessionId = await this.dsh.createSession(String(workspaceId))
    this.send({ type: 'session_created', workspaceId: String(workspaceId), sessionId: sessionId })
    await this.openSession(sessionId)
  }

  async openSession(sessionId) {
    const id = String(sessionId)
    if (this.followAbort) this.followAbort.abort()
    this.activeSessionId = id
    this.throughSeq = -1
    this.toolNames = new Map()
    const controller = new AbortController()
    this.followAbort = controller
    const generator = this.dsh.follow(id, controller.signal, this.config.historyLimit)
    this.followTask = (async () => {
      try {
        for await (const frame of generator) {
          if (controller.signal.aborted) break
          this.onFollowFrame(frame)
        }
      } catch (error) {
        if (controller.signal.aborted === false) {
          this.send(errorFrame('follow failed: ' + String(error && error.message ? error.message : error)))
        }
      }
    })()
  }

  onFollowFrame(frame) {
    if (frame.type === 'snapshot') {
      this.throughSeq = Number(frame.cursor === undefined ? -1 : frame.cursor)
      const title = extractTitle(frame.projections, frame.records)
      this.send({
        type: 'session_opened',
        sessionId: this.activeSessionId,
        session: { id: this.activeSessionId, title: title },
        messages: recordsToWireMessages(frame.records),
        hasOlder: Boolean(frame.hasMore),
        throughSeq: this.throughSeq,
      })
      return
    }
    if (frame.type === 'event') {
      this.handleSessionEvent(frame.event)
      return
    }
    if (frame.type === 'assistant-stream') {
      this.handleAssistantStream(frame.frame)
    }
  }

  handleSessionEvent(event) {
    if (event.type === 'session/title') {
      this.send({ type: 'session_update', sessionId: this.activeSessionId, title: event.data ? event.data.title : null })
      return
    }
    if (event.type === 'turn/start') {
      this.send({ type: 'status', sessionId: this.activeSessionId, running: true })
      return
    }
    if (event.type === 'turn/end') {
      this.send({ type: 'status', sessionId: this.activeSessionId, running: false })
      return
    }
    const messages = eventToWireMessages(event, this.toolNames)
    for (const message of messages) {
      if (message.role === 'tool') {
        this.send({ type: 'tool_progress', sessionId: this.activeSessionId, message: message })
      } else {
        this.send({ type: 'message', sessionId: this.activeSessionId, message: message })
      }
    }
    if (event.type === 'assistant/message' && messages.length > 0) {
      this.send({ type: 'assistant_end', sessionId: this.activeSessionId, messageId: messages[0].id, completed: true })
    }
  }

  handleAssistantStream(frame) {
    if (frame.type === 'start') {
      this.activeAssistantId = String(frame.attemptId)
      this.send({ type: 'assistant_start', sessionId: this.activeSessionId, messageId: this.activeAssistantId })
      return
    }
    if (frame.type === 'chunk' && frame.chunk && frame.chunk.type === 'text-delta') {
      this.send({ type: 'assistant_delta', sessionId: this.activeSessionId, messageId: this.activeAssistantId, delta: frame.chunk.text })
      return
    }
    if (frame.type === 'end') {
      this.send({
        type: 'assistant_end',
        sessionId: this.activeSessionId,
        messageId: this.activeAssistantId,
        completed: frame.outcome && frame.outcome.kind === 'committed',
      })
    }
  }

  async loadOlder(frame) {
    const sessionId = frame.sessionId === undefined ? this.activeSessionId : String(frame.sessionId)
    if (sessionId === null || sessionId.length === 0) {
      this.send(errorFrame('active session is required'))
      return
    }
    const throughSeq = frame.throughSeq === undefined ? this.throughSeq : Number(frame.throughSeq)
    const beforeSeq = frame.beforeSeq === undefined ? undefined : Number(frame.beforeSeq)
    const page = await this.dsh.page(sessionId, throughSeq, beforeSeq, this.config.historyLimit, undefined)
    const records = page && Array.isArray(page.records) ? page.records : []
    this.send({
      type: 'history_page',
      sessionId: sessionId,
      messages: recordsToWireMessages(records),
      hasMore: Boolean(page && page.hasMore),
      beforeSeq: beforeSeq === undefined ? null : beforeSeq,
    })
  }

  async prompt(frame) {
    const sessionId = frame.sessionId === undefined ? this.activeSessionId : String(frame.sessionId)
    if (sessionId === null || sessionId.length === 0) {
      this.send(errorFrame('active session is required'))
      return
    }
    if (sessionId !== this.activeSessionId) await this.openSession(sessionId)
    const requestId = frame.requestId === undefined ? crypto.randomUUID() : String(frame.requestId)
    await this.dsh.prompt(sessionId, { text: frame.text, images: frame.images }, { requestId: requestId })
    this.send({ type: 'ack', requestId: requestId, sessionId: sessionId, accepted: true })
  }

  async cancel(sessionId) {
    const id = sessionId === undefined ? this.activeSessionId : String(sessionId)
    if (id === null || id.length === 0) {
      this.send(errorFrame('active session is required'))
      return
    }
    await this.dsh.cancel(id)
    this.send({ type: 'ack', sessionId: id, accepted: true })
  }

  async rename(sessionId, title) {
    const id = sessionId === undefined ? this.activeSessionId : String(sessionId)
    const nextTitle = String(title || '').trim()
    if (id === null || id.length === 0 || nextTitle.length === 0) {
      this.send(errorFrame('sessionId and title are required'))
      return
    }
    const accepted = await this.dsh.renameSession(id, nextTitle)
    this.send({ type: 'session_update', sessionId: id, title: accepted })
  }

  requestApproval(request) {
    const requestId = crypto.randomUUID()
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(requestId)
        this.send({ type: 'approval_timeout', requestId: requestId })
        resolve('cancelled')
      }, this.config.approvalTimeoutSeconds * 1000)
      this.pendingApprovals.set(requestId, { resolve: resolve, timer: timer })
      this.send({
        type: 'approval_request',
        sessionId: this.activeSessionId,
        requestId: requestId,
        toolName: String(request && request.toolName ? request.toolName : 'tool'),
        reason: String(request && request.reason ? request.reason : ''),
        callId: request && request.callId !== undefined ? String(request.callId) : null,
        options: [
          { id: 'allow-once', label: '批准一次' },
          { id: 'reject-once', label: '拒绝' },
        ],
      })
    })
  }

  resolveApproval(frame) {
    const requestId = String(frame.requestId || '')
    const entry = this.pendingApprovals.get(requestId)
    if (entry === undefined) return
    clearTimeout(entry.timer)
    this.pendingApprovals.delete(requestId)
    const raw = String(frame.outcome || '')
    let outcome = 'cancelled'
    if (raw === 'allow-once' || raw === 'allowed-once') outcome = 'allowed-once'
    else if (raw === 'reject-once' || raw === 'rejected') outcome = 'rejected'
    entry.resolve(outcome)
  }

  dispose(reason) {
    if (this.disposed) return
    this.disposed = true
    if (this.followAbort) this.followAbort.abort()
    for (const entry of this.pendingApprovals.values()) {
      clearTimeout(entry.timer)
      entry.resolve('cancelled')
    }
    this.pendingApprovals.clear()
    this.server.connections.delete(this)
    try {
      this.ws.close()
    } catch (error) {
      this.logger.warn('close failed: ' + String(error))
    }
  }
}
