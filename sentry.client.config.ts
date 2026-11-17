import * as Sentry from '@sentry/nextjs';

const sentry = Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  tracesSampleRate: 0.1,
  debug: process.env.NODE_ENV === 'development',
  beforeSend(event) {
    if (event.user?.email) {
      const email = event.user.email;
      const atIndex = email.indexOf('@');
      if (atIndex > 2) {
        event.user.email = email.substring(0, 2) + '****' + email.substring(atIndex);
      }
    }
    return event;
  },
});

export default sentry;
