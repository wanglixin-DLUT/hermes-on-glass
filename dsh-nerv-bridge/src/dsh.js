// DeepSeek Harness adapters for dsh-nerv-bridge.

function plainId(value) {
  if (value === undefined || value === null) return ''
  return String(value)
}

function summaryTitle(item) {
  const values = item && item.projections ? item.projections.values : undefined
  const title = values ? values.title : undefined
  if (typeof title === 'string' && title.trim()) return title.trim()
  return null
}

function normalizeSummary(item) {
  const source = item || {}
  return {
    id: plainId(source.sessionId !== undefined ? source.sessionId : source.id),
    title: summaryTitle(source),
    updatedAt: Number(source.updatedAt || 0),
    running: Boolean(source.running),
    blank: Boolean(source.blank),
    cwd: source.cwd === undefined ? null : source.cwd,
    parentSessionId: source.parentSessionId === undefined ? null : plainId(source.parentSessionId),
  }
}

export function createDshAdapter(ctx, config) {
  const registry = ctx.workspaceRegistry
  const controller = ctx.sessionController

  async function listAllSessions() {
    const raw = await controller.list({})
    const items = Array.isArray(raw) ? raw : raw && Array.isArray(raw.items) ? raw.items : []
    return items.map(normalizeSummary)
  }

  async function listWorkspaces() {
    const entities = registry.list()
    const allSessions = await listAllSessions()
    const byId = new Map(allSessions.map((session) => [session.id, session]))
    return entities.map((entity) => {
      const ids = Array.isArray(entity.sessionIds) ? entity.sessionIds : []
      const sessions = ids.map((id) => byId.get(plainId(id))).filter(Boolean)
      const updatedAt = sessions.reduce((max, session) => Math.max(max, session.updatedAt), 0)
      const runningCount = sessions.filter((session) => session.running).length
      return {
        id: plainId(entity.id),
        title: entity.title ? String(entity.title) : plainId(entity.path || entity.id),
        path: entity.path ? String(entity.path) : '',
        sessionCount: ids.length,
        runningCount: runningCount,
        updatedAt: updatedAt,
      }
    })
  }

  async function listSessions(workspaceId) {
    const entity = registry.get(workspaceId)
    if (entity === undefined) throw new Error('workspace not found: ' + String(workspaceId))
    const allSessions = await listAllSessions()
    const byId = new Map(allSessions.map((session) => [session.id, session]))
    const ids = Array.isArray(entity.sessionIds) ? entity.sessionIds : []
    const sessions = ids.map((id) => {
      const key = plainId(id)
      const known = byId.get(key)
      return known || { id: key, title: null, updatedAt: 0, running: false, blank: false, cwd: null, parentSessionId: null }
    })
    sessions.sort((left, right) => right.updatedAt - left.updatedAt)
    return sessions
  }

  async function createSession(workspaceId) {
    const result = await controller.create({ workspaceId: workspaceId })
    return plainId(result && result.sessionId)
  }

  async function prompt(sessionId, parts, options) {
    const input = parts || {}
    const content = []
    if (input.text && input.text.length > 0) content.push({ type: 'text', text: String(input.text) })
    const images = Array.isArray(input.images) ? input.images : []
    for (const image of images) {
      content.push({ type: 'image', mediaType: image.mediaType || 'image/jpeg', data: image.data })
    }
    if (content.length === 0) throw new Error('prompt content is empty')
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    await controller.prompt({
      requestId: options.requestId,
      sessionId: sessionId,
      mode: 'queue',
      content: content,
      clientTimeZone: timeZone,
    })
  }

  async function cancel(sessionId) {
    return controller.cancel({ sessionId: sessionId })
  }

  async function renameSession(sessionId, title) {
    const result = await controller.rename({ sessionId: sessionId, title: title })
    return result && result.title ? result.title : title
  }

  function follow(sessionId, signal, maxMessages) {
    return controller.follow({
      address: { kind: 'session', sessionId: sessionId },
      maxMessages: maxMessages,
      assistantStream: true,
    }, signal)
  }

  async function page(sessionId, throughSeq, beforeSeq, maxMessages, signal) {
    return controller.page({
      address: { kind: 'session', sessionId: sessionId },
      throughSeq: throughSeq,
      beforeSeq: beforeSeq,
      maxMessages: maxMessages,
    }, signal)
  }

  return {
    listWorkspaces: listWorkspaces,
    listSessions: listSessions,
    createSession: createSession,
    prompt: prompt,
    cancel: cancel,
    renameSession: renameSession,
    follow: follow,
    page: page,
  }
}
