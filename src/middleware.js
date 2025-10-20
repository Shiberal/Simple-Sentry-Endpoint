import { NextResponse } from 'next/server';

export function middleware(request) {
  const startTime = Date.now();
  const { pathname, search } = request.nextUrl;
  const method = request.method;
  const fullUrl = pathname + search;
  const contentType = request.headers.get('content-type') || 'none';
  const contentEncoding = request.headers.get('content-encoding') || 'none';
  const userAgent = request.headers.get('user-agent') || 'unknown';

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
  console.log(`🔸 Endpoint:         ${fullUrl}`);
  console.log(`🔸 Time:             ${new Date().toISOString()}`);
  console.log(`🔸 Content-Type:     ${contentType}`);
  console.log(`🔸 Content-Encoding: ${contentEncoding}`);
  console.log(`🔸 User-Agent:       ${userAgent.substring(0, 80)}`);
  
  // Log important headers for debugging
  const origin = request.headers.get('origin');
  if (origin) {
    console.log(`🔸 Origin:           ${origin}`);
  }

  const response = NextResponse.next();

  // Log response info
  const duration = Date.now() - startTime;
  console.log(`\n✅ RESPONSE SENT:`);
  console.log(`   Status: ${response.status}`);
  console.log(`   Duration: ${duration}ms`);
  console.log('='.repeat(80) + '\n');

  return response;
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

