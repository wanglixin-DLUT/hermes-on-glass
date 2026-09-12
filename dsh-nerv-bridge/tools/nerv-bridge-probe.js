import WebSocket from 'ws'

function parseArgs(argv) {
  const args = { url: 'ws://127.0.0.1:3090/glasses', token: '', send: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--url') args.url = argv[index + 1]
    else if (value === '--token') args.token = argv[index + 1]
    else if (value === '--send') args.send.push(argv[index + 1])
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const separator = args.url.indexOf('?') >= 0 ? '&' : '?'
const url = args.url + separator + 'token=' + encodeURIComponent(args.token)
const socket = new WebSocket(url)

socket.on('open', () => {
  console.log('connected')
  socket.send(JSON.stringify({ type: 'client_hello', client: { name: 'nerv-bridge-probe', version: '0.1.0' } }))
  for (const payload of args.send) socket.send(payload)
})

socket.on('message', (data) => {
  try {
    console.log(JSON.stringify(JSON.parse(data.toString()), null, 2))
  } catch (error) {
    console.log(data.toString())
  }
})

socket.on('error', (error) => {
  console.error('probe error', error)
  process.exitCode = 1
})

socket.on('close', () => {
  console.log('closed')
})
