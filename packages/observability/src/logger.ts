export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
};

export type Logger = {
  child: (bindings: Record<string, unknown>) => Logger;
  fatal: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  info: (message: string, fields?: Record<string, unknown>) => void;
  debug: (message: string, fields?: Record<string, unknown>) => void;
  trace: (message: string, fields?: Record<string, unknown>) => void;
};

export type CreateLoggerOptions = {
  service: string;
  level?: LogLevel;
  bindings?: Record<string, unknown>;
};

function write(
  level: LogLevel,
  service: string,
  minLevel: LogLevel,
  bindings: Record<string, unknown>,
  message: string,
  fields: Record<string, unknown> = {},
): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) {
    return;
  }

  const payload = {
    level,
    time: new Date().toISOString(),
    service,
    msg: message,
    ...bindings,
    ...fields,
  };

  const line = JSON.stringify(payload);
  if (level === 'error' || level === 'fatal') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const minLevel = options.level ?? 'info';
  const bindings = options.bindings ?? {};

  const log =
    (level: LogLevel) =>
    (message: string, fields?: Record<string, unknown>): void => {
      write(level, options.service, minLevel, bindings, message, fields);
    };

  return {
    child(childBindings) {
      return createLogger({
        service: options.service,
        level: minLevel,
        bindings: { ...bindings, ...childBindings },
      });
    },
    fatal: log('fatal'),
    error: log('error'),
    warn: log('warn'),
    info: log('info'),
    debug: log('debug'),
    trace: log('trace'),
  };
}
