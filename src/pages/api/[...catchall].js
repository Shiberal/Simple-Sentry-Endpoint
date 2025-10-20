// Catch-all route to log 404s on API routes
export default function handler(req, res) {
  const path = req.url || 'unknown';
  
  console.log('\n⚠️  404 - API ROUTE NOT FOUND');
  console.log(`   Requested path: ${path}`);
  console.log(`   Method: ${req.method}`);
  console.log(`   Available API routes:`);
  console.log(`     - /api/auth/*`);
  console.log(`     - /api/projects/*`);
  console.log(`     - /api/issues/*`);
  console.log(`     - /api/events/*`);
  console.log(`     - /api/[id]/envelope (Sentry ingestion endpoint)`);
  console.log(`     - /api/analytics/*`);
  
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `API route ${path} does not exist`,
    hint: 'Check if the endpoint path and project ID are correct'
  });
}

