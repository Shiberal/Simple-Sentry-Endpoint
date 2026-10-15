import { NextResponse } from 'next/server';

export function proxy(request) {
  const { pathname } = request.nextUrl;
  console.log(`${request.method} ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip static assets and the favicon.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
