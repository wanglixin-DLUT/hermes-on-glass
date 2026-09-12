import test from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import { BridgeServer } from '../src/server.js'
import { createFakeDsh } from './fake-dsh.js'
import { createLogger } from '../src/logger.js'

const SECRET = 'test-secret'

async function startBridge(overrides) {
  const fake = createFakeDsh()
  const config = Object.assign({
    host: '127.0.0.1',
    port: 0,
    sharedSecret: SECRET,
    allowAnonymous: false,
    historyLimit: 20,
    approvalTimeoutSeconds: 2,
    heartbeatSeconds: 30,
    logFrames: false,
    protocolVersion: 1,
  }, overrides || {})
  const server = new BridgeServer({ ctx: null, config: config, dsh: fake.dsh, logger: createLogger(null, config) })
  await server.start()
  return { fake: fake, server: server, port: server.address().port }
}

function connect(port, token) {
  const suffix = token === undefined ? '' : '?token=' + encodeURIComponent(token)
  const ws = new WebSocket('ws://127.0.0.1:' + String(port) + '/glasses' + suffix)
  const queue = []
  const waiters = []
  ws.on('message', (data) => {
    const frame = JSON.parse(data.toString())
    const index = waiters.findIndex((waiter) => waiter.predicate(frame))
    if (index >= 0) {
      const waiter = waiters.splice(index, 1)[0]
      clearTimeout(waiter.timer)
      waiter.resolve(frame)
    } else {
      queue.push(frame)
    }
  })
  function next(predicate, timeout) {
    const match = predicate || (() => true)
    const index = queue.findIndex(match)
    if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0])
    return new Promise((resolve, reject) => {
      const waiter = { predicate: match, resolve: resolve, reject: reject, timer: null }
      waiter.timer = setTimeout(() => {
        const position = waiters.indexOf(waiter)
        if (position >= 0) waiters.splice(position, 1)
        reject(new Error('timeout waiting for frame'))
      }, timeout || 2000)
      waiters.push(waiter)
    })
  }
  function send(frame) {
    ws.send(JSON.stringify(frame))
  }
  return { ws: ws, next: next, send: send, close: () => ws.close() }
}

function openSocket(port, token) {
  return new Promise((resolve, reject) => {
    const client = connect(port, token)
    client.ws.on('open', () => resolve(client))
    client.ws.on('error', reject)
  })
}

const USER_EVENT = {
  type: 'user/message',
  seq: 0,
  time: 1,
  data: { id: 'u1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'hello' }] },
}

const ASSISTANT_EVENT = {
  type: 'assistant/message',
  seq: 1,
  time: 2,
  data: { message: { id: 'a1', content: [{ type: 'text', text: 'world' }] } },
}

test('rejects unauthorized connections', async () => {
  const started = await startBridge()
  const result = await new Promise((resolve) => {
    const client = connect(started.port, undefined)
    client.ws.on('open', () => resolve('open'))
    client.ws.on('error', () => resolve('error'))
    setTimeout(() => resolve('timeout'), 1500)
  })
  assert.notEqual(result, 'open')
  started.server.close()
})

test('renders workspace, session and streaming conversation', async () => {
  const started = await startBridge()
  const client = await openSocket(started.port, SECRET)
  try {
    await client.next((frame) => frame.type === 'server_hello')

    client.send({ type: 'list_workspaces' })
    const workspaces = await client.next((frame) => frame.type === 'workspace_list')
    assert.equal(workspaces.items.length, 1)
    assert.equal(workspaces.items[0].id, 'w1')

    client.send({ type: 'select_workspace', workspaceId: 'w1' })
    const sessions = await client.next((frame) => frame.type === 'session_list')
    assert.equal(sessions.items[0].id, 's1')

    started.fake.state.followScripts.set('session-new', [
      {
        type: 'snapshot',
        cursor: 1,
        hasMore: false,
        projections: { values: { title: 'New session' } },
        records: [{ type: 'event', event: USER_EVENT }, { type: 'event', event: ASSISTANT_EVENT }],
      },
      { type: 'assistant-stream', frame: { type: 'start', attemptId: 'a2' } },
      { type: 'assistant-stream', frame: { type: 'chunk', attemptId: 'a2', chunk: { type: 'text-delta', text: 'stream' } } },
      { type: 'assistant-stream', frame: { type: 'end', attemptId: 'a2', outcome: { kind: 'committed' } } },
    ])

    client.send({ type: 'create_session', workspaceId: 'w1' })
    const created = await client.next((frame) => frame.type === 'session_created')
    assert.equal(created.sessionId, 'session-new')

    const opened = await client.next((frame) => frame.type === 'session_opened')
    assert.equal(opened.session.title, 'New session')
    assert.equal(opened.messages.length, 2)

    const start = await client.next((frame) => frame.type === 'assistant_start')
    assert.equal(start.messageId, 'a2')

    const delta = await client.next((frame) => frame.type === 'assistant_delta')
    assert.equal(delta.delta, 'stream')

    await client.next((frame) => frame.type === 'assistant_end')
  } finally {
    client.close()
    started.server.close()
  }
})

test('bridges approval requests and responses', async () => {
  const started = await startBridge()
  const client = await openSocket(started.port, SECRET)
  try {
    await client.next((frame) => frame.type === 'server_hello')
    started.fake.state.followScripts.set('s1', [
      { type: 'snapshot', cursor: 0, hasMore: false, projections: { values: {} }, records: [] },
    ])
    client.send({ type: 'open_session', sessionId: 's1' })
    await client.next((frame) => frame.type === 'session_opened')

    const approval = started.server.handleApproval(
      { agent: { session: { id: 's1' } }, toolName: 'bash', reason: 'run tests', callId: 'call-1' },
      () => Promise.resolve('unavailable'),
    )
    const request = await client.next((frame) => frame.type === 'approval_request')
    assert.equal(request.toolName, 'bash')
    client.send({ type: 'approval_response', requestId: request.requestId, outcome: 'allow-once' })
    assert.equal(await approval, 'allowed-once')
  } finally {
    client.close()
    started.server.close()
  }
})

test('forwards prompts to the DSH controller', async () => {
  const started = await startBridge()
  const client = await openSocket(started.port, SECRET)
  try {
    await client.next((frame) => frame.type === 'server_hello')
    started.fake.state.followScripts.set('s1', [
      { type: 'snapshot', cursor: 0, hasMore: false, projections: { values: {} }, records: [] },
    ])
    client.send({ type: 'open_session', sessionId: 's1' })
    await client.next((frame) => frame.type === 'session_opened')
    client.send({ type: 'user_message', sessionId: 's1', requestId: 'req-1', text: 'hello DSH' })
    const ack = await client.next((frame) => frame.type === 'ack')
    assert.equal(ack.accepted, true)
    assert.equal(started.fake.state.prompts.length, 1)
    assert.equal(started.fake.state.prompts[0].parts.text, 'hello DSH')
  } finally {
    client.close()
    started.server.close()
  }
})
