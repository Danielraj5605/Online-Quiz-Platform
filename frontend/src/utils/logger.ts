// Frontend logging utility
const LOG_PREFIX = {
  info: '%c[INFO]',
  warn: '%c[WARN]',
  error: '%c[ERROR]',
  api: '%c[API]',
};

const LOG_STYLES = {
  info: 'color: #3b82f6; font-weight: bold',
  warn: 'color: #f59e0b; font-weight: bold',
  error: 'color: #ef4444; font-weight: bold',
  api: 'color: #8b5cf6; font-weight: bold',
};

const timestamp = () => new Date().toISOString();

export const logger = {
  info: (message: string, ...data: any[]) => {
    console.log(LOG_PREFIX.info, LOG_STYLES.info, timestamp(), message, ...data);
  },

  warn: (message: string, ...data: any[]) => {
    console.warn(LOG_PREFIX.warn, LOG_STYLES.warn, timestamp(), message, ...data);
  },

  error: (message: string, error?: any) => {
    console.error(LOG_PREFIX.error, LOG_STYLES.error, timestamp(), message, error);
  },

  api: {
    request: (method: string, url: string, data?: any) => {
      console.log(
        LOG_PREFIX.api,
        LOG_STYLES.api,
        timestamp(),
        `${method} ${url}`,
        data ? '\nPayload:' : '',
        data || ''
      );
    },
    response: (method: string, url: string, status: number, data?: any) => {
      const isError = status >= 400;
      const style = isError ? LOG_STYLES.error : LOG_STYLES.api;
      console.log(
        LOG_PREFIX.api,
        style,
        timestamp(),
        `${method} ${url}`,
        `Status: ${status}`,
        data ? '\nResponse:' : '',
        data || ''
      );
    },
    error: (method: string, url: string, error: any) => {
      console.error(
        LOG_PREFIX.api,
        LOG_STYLES.error,
        timestamp(),
        `${method} ${url} FAILED`,
        error
      );
    },
  },
};
