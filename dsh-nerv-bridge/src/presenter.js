// Converts DeepSeek Harness session wires into glasses-friendly messages.

export function extractText(content) {
  if (content === null || content === undefined) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(extractText).filter(Boolean).join('')
  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text
    if (content.type === 'text') return String(content.text || '')
    if (content.type === 'tool-result') return extractText(content.content)
    if (Array.isArray(content.content)) return extractText(content.content)
  }
  return ''
}

export function unwrapEvent(recordOrEvent) {
  if (recordOrEvent && recordOrEvent.type === 'event' && recordOrEvent.event) return recordOrEvent.event
  return recordOrEvent
}

function eventData(event) {
  if (event && typeof event === 'object') return event.data
  return undefined
}

function wireMessage(event, fields) {
  const message = {
    id: String(fields.id),
    role: fields.role,
    text: fields.text || '',
    time: Number(event.time || 0),
    seq: Number(event.seq === undefined ? -1 : event.seq),
  }
  if (fields.toolName) message.toolName = fields.toolName
  if (fields.phase) message.phase = fields.phase
  if (fields.isError !== undefined) message.isError = Boolean(fields.isError)
  return message
}

export function eventToWireMessages(recordOrEvent, toolNames) {
  const names = toolNames || new Map()
  const event = unwrapEvent(recordOrEvent)
  if (event === null || event === undefined) return []
  if (typeof event.type !== 'string') return []
  const data = eventData(event)

  if (event.type === 'user/message') {
    if (data && data.source && data.source.kind === 'user') {
      const text = extractText(data.content)
      if (text.length > 0) {
        const id = data.id === undefined ? 'user-' + String(event.seq) : data.id
        return [wireMessage(event, { id: id, role: 'user', text: text })]
      }
    }
    return []
  }

  if (event.type === 'assistant/message') {
    const message = data ? data.message : undefined
    const text = extractText(message ? message.content : undefined)
    if (text.length > 0) {
      const id = message && message.id !== undefined ? message.id : 'assistant-' + String(event.seq)
      return [wireMessage(event, { id: id, role: 'assistant', text: text })]
    }
    return []
  }

  if (event.type === 'tool/call') {
    const callId = String(data && data.callId !== undefined ? data.callId : 'tool-' + String(event.seq))
    const name = String(data && data.name ? data.name : 'tool')
    names.set(callId, name)
    return [wireMessage(event, { id: callId, role: 'tool', text: name, toolName: name, phase: 'started' })]
  }

  if (event.type === 'tool/result') {
    const message = data ? data.message : undefined
    const block = message && Array.isArray(message.content) ? message.content[0] : undefined
    const sourceCallId = message && message.source ? message.source.callId : undefined
    const blockCallId = block ? block.toolCallId : undefined
    const fallback = 'tool-' + String(event.seq)
    const callId = String(sourceCallId !== undefined ? sourceCallId : blockCallId !== undefined ? blockCallId : fallback)
    const name = names.get(callId) || String(data && data.meta && data.meta.toolName ? data.meta.toolName : 'tool')
    const resultText = extractText(block ? block.content || block : undefined)
    const isError = Boolean(data && data.error) || Boolean(block && block.isError)
    return [wireMessage(event, {
      id: callId,
      role: 'tool',
      text: resultText || (isError ? 'failed' : 'done'),
      toolName: name,
      phase: 'finished',
      isError: isError,
    })]
  }

  return []
}

export function recordsToWireMessages(records) {
  const toolNames = new Map()
  const messages = []
  const input = Array.isArray(records) ? records : []
  for (const record of input) messages.push(...eventToWireMessages(record, toolNames))
  messages.sort((left, right) => left.seq - right.seq)
  return messages
}

export function extractTitle(projections, records) {
  const projected = projections && projections.values ? projections.values.title : undefined
  if (typeof projected === 'string' && projected.trim()) return projected.trim()
  const input = Array.isArray(records) ? records : []
  for (let index = input.length - 1; index >= 0; index -= 1) {
    const event = unwrapEvent(input[index])
    if (event && event.type === 'session/title' && event.data && typeof event.data.title === 'string') {
      const title = event.data.title.trim()
      if (title) return title
    }
  }
  return null
}
