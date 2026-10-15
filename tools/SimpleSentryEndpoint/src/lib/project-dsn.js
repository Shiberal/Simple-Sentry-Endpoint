export const normalizeBase = (value) => {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return null;
  try { return new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
};
export const hrefOf = (u) => u.href.replace(/\/$/, '');

// Works in both SSR and client-side
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // Fallback to environment variable for SSR
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://error.cool.errline5.org';
};

const getHost = () => {
  if (typeof window !== 'undefined') {
    return window.location.host;
  }
  // Fallback for SSR - extract host from base URL or use env
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://error.cool.errline5.org';
  return baseUrl.replace(/^https?:\/\//, '');
};

/**
 * The server URLs a project's DSN can point at (this site, NEXT_PUBLIC_BASE_URLS and the ones the
 * user added) and the DSN / envelope URL for the chosen one.
 */
export function resolveDsnBase({ project, baseChoice, customBase }) {
  const originBase = getBaseUrl();
  const baseOptions = [...new Set([
    originBase,
    ...String(process.env.NEXT_PUBLIC_BASE_URLS || '').split(','),
    ...customBase
  ].map((x) => normalizeBase(x)).filter(Boolean).map(hrefOf))];
  const wanted = normalizeBase(baseChoice);
  const chosen = (wanted && baseOptions.includes(hrefOf(wanted)) ? wanted : null) || normalizeBase(originBase) || normalizeBase(getHost());
  const baseUrl = hrefOf(chosen);
  const host = chosen.host + chosen.pathname.replace(/\/$/, '');
  return {
    originBase,
    baseOptions,
    baseUrl,
    envelopeUrl: `${baseUrl}/api/${project.id}/envelope`,
    dsn: `${chosen.protocol}//${project.key}@${host}/${project.id}`,
  };
}

/** Copy-paste integration snippets for the project's DSN and envelope endpoint. */
export function buildExamples({ dsn, envelopeUrl }) {
  const curlExample = `curl -X POST ${envelopeUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"event_id":"'$(date +%s)'"}
{"level":"error","message":"Test error from curl","environment":"production","platform":"node"}'`;

  const nodeExample = `// Using Official Sentry SDK (Recommended)
import * as Sentry from "@sentry/browser"; // or @sentry/node

Sentry.init({
  dsn: "${dsn}",
  tracesSampleRate: 1.0,
  environment: "production",
});

// Errors are automatically captured
try {
  // Your code
  undefinedFunction();
} catch (error) {
  Sentry.captureException(error);
}

// Or use manual envelope API
const sendError = async (error) => {
  const envelope = \`{\"event_id\":\"\${Date.now()}\"}\\n\${JSON.stringify({
    level: 'error',
    message: error.message,
    exception: {
      values: [{
        type: error.name,
        value: error.message,
        stacktrace: {
          frames: error.stack.split('\\n').slice(1, 5).map(line => ({
            filename: 'app.js',
            function: line.trim(),
            lineno: 1
          }))
        }
      }]
    },
    environment: 'production',
    platform: 'javascript',
    timestamp: new Date().toISOString()
  })}\`;

  await fetch('${envelopeUrl}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: envelope
  });
};`;

  const pythonExample = `# Using Official Sentry SDK (Recommended)
import sentry_sdk

sentry_sdk.init(
    dsn="${dsn}",
    traces_sample_rate=1.0,
    environment="production",
)

# Errors are automatically captured
try:
    # Your code
    1 / 0
except Exception as e:
    sentry_sdk.capture_exception(e)

# Or use manual envelope API
import requests
import json
import time

def send_error(message, level='error'):
    envelope = f'{{"event_id":"{int(time.time())}"}}'
    envelope += '\\n' + json.dumps({
        'level': level,
        'message': message,
        'environment': 'production',
        'platform': 'python',
        'timestamp': time.time()
    })
    
    requests.post(
        '${envelopeUrl}',
        data=envelope,
        headers={'Content-Type': 'application/json'}
    )`;

  const phpExample = `<?php
// Install: composer require sentry/sdk guzzlehttp/guzzle
require_once __DIR__ . '/vendor/autoload.php';

// Custom HTTP client to follow redirects (required for this server)
class RedirectHttpClient implements \\Sentry\\HttpClient\\HttpClientInterface {
    private $client;
    
    public function __construct() {
        $this->client = new \\GuzzleHttp\\Client([
            'allow_redirects' => true,
            'timeout' => 5,
        ]);
    }
    
    public function sendRequest(
        \\Sentry\\HttpClient\\Request $request,
        \\Sentry\\Options $options
    ): \\Sentry\\HttpClient\\Response {
        $dsn = $options->getDsn();
        $url = $dsn->getEnvelopeApiEndpointUrl();
        
        $authHeader = sprintf(
            'Sentry sentry_version=7, sentry_client=sentry.php/%s, sentry_key=%s',
            \\Sentry\\Client::SDK_VERSION,
            $dsn->getPublicKey()
        );
        
        try {
            $response = $this->client->post($url, [
                'headers' => [
                    'Content-Type' => 'application/x-sentry-envelope',
                    'X-Sentry-Auth' => $authHeader,
                ],
                'body' => $request->getStringBody(),
            ]);
            
            return new \\Sentry\\HttpClient\\Response(
                $response->getStatusCode(),
                $response->getHeaders(),
                (string) $response->getBody()
            );
        } catch (\\Exception $e) {
            return new \\Sentry\\HttpClient\\Response(500, [], '');
        }
    }
}

// Initialize Sentry
\\Sentry\\init([
    'dsn' => '${dsn}',
    'environment' => 'production',
    'sample_rate' => 1.0,
    'http_client' => new RedirectHttpClient(), // Required!
]);

// Usage examples
try {
    // Your code
    throw new Exception('Something went wrong');
} catch (Throwable $e) {
    \\Sentry\\captureException($e);
}

// Or capture messages
\\Sentry\\captureMessage('User action completed', \\Sentry\\Severity::info());

// Add user context
\\Sentry\\configureScope(function (\\Sentry\\State\\Scope $scope): void {
    $scope->setUser(['id' => 123, 'email' => 'user@example.com']);
    $scope->setTag('feature', 'checkout');
});

// Flush events before script ends
register_shutdown_function(fn() => \\Sentry\\SentrySdk::getCurrentHub()->getClient()?->flush(2));
?>`;

  return { curlExample, nodeExample, pythonExample, phpExample };
}
