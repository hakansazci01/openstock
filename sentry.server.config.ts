import * as Sentry from '@sentry/nextjs';

const sentry = Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  tracesSampleRate: 0.1,
  debug: process.env.NODE_ENV === 'development',
  beforeSend(event) {
    if (event.request?.headers?.cookie) {
      delete event.request.headers.cookie;
    }
    return event;
  },
});

export default sentry;
