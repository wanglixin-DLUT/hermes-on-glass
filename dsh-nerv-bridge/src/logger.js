// Small logger that works with a DSH context or standalone tests.

export function createLogger(ctx, config) {
  const prefix = '[dsh-nerv-bridge]'
  function emit(level, message) {
    const line = prefix + ' ' + String(message)
    const logger = ctx ? ctx.logger : undefined
    if (logger && typeof logger[level] === 'function') logger[level](line)
    else if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
  }
  return {
    info: (message) => emit('info', message),
    warn: (message) => emit('warn', message),
    error: (message) => emit('error', message),
    frame: (direction, frame) => {
      if (config && config.logFrames) emit('info', direction + ' ' + JSON.stringify(frame))
    },
  }
}
