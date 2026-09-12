import { resolveConfig } from './config.js'
import { createLogger } from './logger.js'
import { createDshAdapter } from './dsh.js'
import { BridgeServer } from './server.js'

export const name = 'dsh-nerv-bridge'
export const inject = ['workspaceRegistry', 'sessionController']

export function apply(ctx, configInput) {
  const config = resolveConfig(configInput || {})
  const logger = createLogger(ctx, config)
  const dsh = createDshAdapter(ctx, config)
  const server = new BridgeServer({ ctx: ctx, config: config, dsh: dsh, logger: logger })

  ctx.effect(() => {
    server.start().catch((error) => logger.error('start failed: ' + String(error)))
    return () => server.close()
  })

  ctx.on('approval/request', (request, next) => server.handleApproval(request, next))
  logger.info('plugin loaded; bridge target ' + config.host + ':' + String(config.port))
  return server
}

export default { name, inject, apply }
