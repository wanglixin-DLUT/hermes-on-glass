// Configuration defaults and validation for dsh-nerv-bridge.

export const DEFAULT_CONFIG = Object.freeze({
  host: '127.0.0.1',
  port: 3090,
  sharedSecret: '',
  allowAnonymous: false,
  historyLimit: 50,
  approvalTimeoutSeconds: 120,
  heartbeatSeconds: 30,
  logFrames: false,
  workspaceAllowCreate: false,
  protocolVersion: 1,
})

export function resolveConfig(input = {}) {
  const config = { ...DEFAULT_CONFIG, ...input }

  if (!config.sharedSecret && process.env.DSH_NERV_BRIDGE_SECRET) {
    config.sharedSecret = process.env.DSH_NERV_BRIDGE_SECRET
  }
  if (!Number.isInteger(config.port) || config.port < 0 || config.port > 65535) {
    throw new Error(`dsh-nerv-bridge: invalid port ${String(config.port)}`)
  }
  if (!Number.isInteger(config.historyLimit) || config.historyLimit < 1) {
    throw new Error('dsh-nerv-bridge: historyLimit must be a positive integer')
  }
  if (!Number.isInteger(config.approvalTimeoutSeconds) || config.approvalTimeoutSeconds < 1) {
    throw new Error('dsh-nerv-bridge: approvalTimeoutSeconds must be a positive integer')
  }
  if (!Number.isInteger(config.heartbeatSeconds) || config.heartbeatSeconds < 1) {
    throw new Error('dsh-nerv-bridge: heartbeatSeconds must be a positive integer')
  }
  if (!config.allowAnonymous && !config.sharedSecret) {
    throw new Error(
      'dsh-nerv-bridge: sharedSecret is required. Set it in cordis.patch.yml, ' +
      'or set DSH_NERV_BRIDGE_SECRET, or set allowAnonymous: true for local-only development.',
    )
  }
  if (config.sharedSecret === 'change-me') {
    // Do not print the secret. This warning is intentionally visible.
    // eslint-disable-next-line no-console
    console.warn('[dsh-nerv-bridge] sharedSecret is still the default "change-me"; change it before exposing the port.')
  }
  return config
}
