/**
 * Minimal centralized logger. Avoids console.log pollution in production and
 * gives us a single place to add Sentry / Datadog forwarding later.
 */

const isProd = process.env.NODE_ENV === 'production'
const isBrowser = typeof window !== 'undefined'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function emit(level: LogLevel, scope: string, message: string, extra?: unknown) {
  const prefix = `[${scope}]`
  if (level === 'debug' && isProd) return

  const args: unknown[] = [prefix, message]
  if (extra !== undefined) args.push(extra)

  switch (level) {
    case 'debug':
      console.debug(...args)
      break
    case 'info':
      console.info(...args)
      break
    case 'warn':
      console.warn(...args)
      break
    case 'error':
      console.error(...args)
      break
  }

  // Hook for future telemetry. Example:
  // if (isProd && level === 'error' && typeof Sentry !== 'undefined') {
  //   Sentry.captureException(extra ?? new Error(message), { tags: { scope } })
  // }
  void isBrowser
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, extra?: unknown) => emit('debug', scope, msg, extra),
    info: (msg: string, extra?: unknown) => emit('info', scope, msg, extra),
    warn: (msg: string, extra?: unknown) => emit('warn', scope, msg, extra),
    error: (msg: string, extra?: unknown) => emit('error', scope, msg, extra),
  }
}
