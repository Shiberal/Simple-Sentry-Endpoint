import { NextResponse } from 'next/server';

export function middleware(request) {
  const startTime = Date.now();
  const { pathname, search } = request.nextUrl;
  const method = request.method;
  const fullUrl = pathname + search;
  const contentType = request.headers.get('content-type') || 'none';
  const contentEncoding = request.headers.get('content-encoding') || 'none';
  const contentLength = request.headers.get('content-length') || '0';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const host = request.headers.get('host') || 'unknown';

  // Determine request type
  let requestType = '🌐 PAGE';
  if (pathname.startsWith('/api/')) {
    requestType = '🔌 API';
    
    // Special highlighting for envelope endpoint (Sentry error ingestion)
    if (pathname.includes('/envelope')) {
      requestType = '🚨 SENTRY ENVELOPE';
    }
  }

  // Log incoming request with clear formatting
  console.log('\n' + '='.repeat(80));
  console.log(`📥 ${requestType} REQUEST RECEIVED`);
  console.log('='.repeat(80));
  console.log(`🔸 Method:           ${method}`);
  console.log(`🔸 Full URL:         ${request.url}`);
  console.log(`🔸 Endpoint:         ${fullUrl}`);
  console.log(`🔸 Host:             ${host}`);
  console.log(`🔸 Time:             ${new Date().toISOString()}`);
  console.log(`🔸 Content-Type:     ${contentType}`);
  console.log(`🔸 Content-Encoding: ${contentEncoding}`);
  console.log(`🔸 Content-Length:   ${contentLength} bytes`);
  console.log(`🔸 User-Agent:       ${userAgent.substring(0, 100)}`);
  
  // Log ALL headers for deep debugging
  console.log(`🔸 All Headers:`);
  request.headers.forEach((value, key) => {
    if (!['user-agent', 'content-type', 'content-encoding', 'content-length', 'host'].includes(key)) {
      console.log(`     ${key}: ${value}`);
    }
  });

  const response = NextResponse.next();

  // Log response info
  const duration = Date.now() - startTime;
  const statusEmoji = response.status >= 400 ? '❌' : '✅';
  console.log(`\n${statusEmoji} RESPONSE:`);
  console.log(`   Status: ${response.status} ${getStatusText(response.status)}`);
  console.log(`   Duration: ${duration}ms`);
  console.log('='.repeat(80) + '\n');

  return response;
}

function getStatusText(status) {
  const statusTexts = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return statusTexts[status] || '';
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

