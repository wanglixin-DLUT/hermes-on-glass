// Wire protocol helpers. All frames are JSON objects with a `type` field.

export const PROTOCOL_VERSION = 1

export function encode(frame) {
  return JSON.stringify(frame)
}

export function parseFrame(raw) {
  try {
    const text = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8')
    const frame = JSON.parse(text)
    if (frame === null || typeof frame !== 'object' || Array.isArray(frame) || typeof frame.type !== 'string') {
      return { ok: false, reason: 'frame must be a JSON object with a string type' }
    }
    return { ok: true, frame }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

export function errorFrame(message, requestId) {
  return {
    type: 'error',
    ...(requestId ? { requestId } : {}),
    code: 'bridge_error',
    message: String(message),
  }
}

export function now() {
  return Date.now()
}
