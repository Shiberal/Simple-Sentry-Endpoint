import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';

/** Capture React render / page errors into the app's own Sentry DSN. */
function CustomError({ statusCode }) {
  return <NextError statusCode={statusCode} />;
}

CustomError.getInitialProps = async (contextData) => {
  await Sentry.captureUnderscoreErrorException(contextData);
  return NextError.getInitialProps(contextData);
};

export default CustomError;
