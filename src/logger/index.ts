import pino from 'pino';

export function createLogger(level = 'info'): pino.Logger {
  return pino({
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
}

export const logger = createLogger(process.env['LOG_LEVEL'] || 'info');
