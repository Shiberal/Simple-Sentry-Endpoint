/**
 * Sentry Transaction Parser
 * 
 * Utility functions to extract performance data from Sentry transaction events
 * following Sentry's standard format.
 */

/**
 * Extract transaction duration from timestamps
 * Sentry uses Unix timestamps in seconds
 * @param {Object} transaction - Transaction event data
 * @returns {number} Duration in seconds, or 0 if not available
 */
export function extractDuration(transaction) {
  const data = transaction.data || transaction;
  
  if (!data.timestamp || !data.start_timestamp) {
    return 0;
  }
  
  // Sentry timestamps are in seconds (Unix timestamp)
  // Calculate duration in seconds
  const duration = data.timestamp - data.start_timestamp;
  
  // Ensure non-negative duration
  return Math.max(0, duration);
}

/**
 * Extract Web Vitals and custom measurements
 * @param {Object} transaction - Transaction event data
 * @returns {Object} Measurements object with Web Vitals and custom metrics
 */
export function extractMeasurements(transaction) {
  const data = transaction.data || transaction;
  const measurements = data.measurements || {};
  
  const result = {
    // Core Web Vitals
    fcp: null, // First Contentful Paint (ms)
    lcp: null, // Largest Contentful Paint (ms)
    fid: null, // First Input Delay (ms)
    cls: null, // Cumulative Layout Shift (score)
    ttfb: null, // Time to First Byte (ms)
    
    // Custom measurements
    custom: {}
  };
  
  // Extract Web Vitals
  if (measurements.fcp?.value !== undefined) {
    result.fcp = measurements.fcp.value;
  }
  if (measurements.lcp?.value !== undefined) {
    result.lcp = measurements.lcp.value;
  }
  if (measurements.fid?.value !== undefined) {
    result.fid = measurements.fid.value;
  }
  if (measurements.cls?.value !== undefined) {
    result.cls = measurements.cls.value;
  }
  if (measurements.ttfb?.value !== undefined) {
    result.ttfb = measurements.ttfb.value;
  }
  
  // Extract custom measurements (anything not in Web Vitals)
  const webVitals = ['fcp', 'lcp', 'fid', 'cls', 'ttfb'];
  Object.keys(measurements).forEach(key => {
    if (!webVitals.includes(key) && measurements[key]?.value !== undefined) {
      result.custom[key] = measurements[key].value;
    }
  });
  
  return result;
}

/**
 * Extract memory metrics from contexts
 * @param {Object} transaction - Transaction event data
 * @returns {Object} Memory metrics in bytes
 */
export function extractMemoryMetrics(transaction) {
  const data = transaction.data || transaction;
  const contexts = data.contexts || {};
  
  const result = {
    heapUsed: null,
    heapTotal: null,
    rss: null,
    memorySize: null,
    freeMemory: null,
    appMemory: null
  };
  
  // Extract from contexts.device
  if (contexts.device) {
    if (contexts.device.memory_size !== undefined) {
      // memory_size is typically in MB, convert to bytes
      result.memorySize = typeof contexts.device.memory_size === 'number'
        ? contexts.device.memory_size * 1024 * 1024
        : null;
    }
    if (contexts.device.free_memory !== undefined) {
      result.freeMemory = typeof contexts.device.free_memory === 'number'
        ? contexts.device.free_memory * 1024 * 1024
        : null;
    }
  }
  
  // Extract from contexts.app
  if (contexts.app) {
    if (contexts.app.app_memory !== undefined) {
      // app_memory might be in bytes or MB, check the value
      const appMemory = contexts.app.app_memory;
      if (typeof appMemory === 'number') {
        // If it's a large number (> 1GB), assume bytes, otherwise assume MB
        result.appMemory = appMemory > 1024 * 1024 * 1024
          ? appMemory
          : appMemory * 1024 * 1024;
      }
    }
  }
  
  // Fallback: Try to extract from breadcrumbs if contexts not available
  if (!result.heapUsed && !result.heapTotal && !result.rss) {
    const breadcrumbs = Array.isArray(data.breadcrumbs)
      ? data.breadcrumbs
      : data.breadcrumbs?.values || [];
    
    // Look for memory breadcrumbs
    const heapUsedMatch = breadcrumbs
      .find(b => b.message?.includes('Heap Used:'))?.message
      ?.match(/([\d.]+)\s*MB/);
    const heapTotalMatch = breadcrumbs
      .find(b => b.message?.includes('Heap Total:'))?.message
      ?.match(/([\d.]+)\s*MB/);
    const rssMatch = breadcrumbs
      .find(b => b.message?.includes('RSS:'))?.message
      ?.match(/([\d.]+)\s*MB/);
    
    if (heapUsedMatch) {
      result.heapUsed = parseFloat(heapUsedMatch[1]) * 1024 * 1024;
    }
    if (heapTotalMatch) {
      result.heapTotal = parseFloat(heapTotalMatch[1]) * 1024 * 1024;
    }
    if (rssMatch) {
      result.rss = parseFloat(rssMatch[1]) * 1024 * 1024;
    }
  }
  
  return result;
}

/**
 * Extract CPU usage from contexts or breadcrumbs
 * @param {Object} transaction - Transaction event data
 * @returns {number|null} CPU usage percentage, or null if not available
 */
export function extractCpuUsage(transaction) {
  const data = transaction.data || transaction;
  const contexts = data.contexts || {};
  
  // Try contexts first
  if (contexts.device?.cpu_percent !== undefined) {
    return contexts.device.cpu_percent;
  }
  if (contexts.runtime?.cpu_percent !== undefined) {
    return contexts.runtime.cpu_percent;
  }
  
  // Fallback to breadcrumbs
  const breadcrumbs = Array.isArray(data.breadcrumbs)
    ? data.breadcrumbs
    : data.breadcrumbs?.values || [];
  
  const cpuBreadcrumb = breadcrumbs.find(b =>
    b.message && b.message.includes('CPU usage')
  );
  
  if (cpuBreadcrumb) {
    const cpuMatch = cpuBreadcrumb.message.match(/([\d.]+)%/);
    if (cpuMatch) {
      return parseFloat(cpuMatch[1]);
    }
  }
  
  return null;
}

/**
 * Extract event loop lag from breadcrumbs
 * @param {Object} transaction - Transaction event data
 * @returns {number|null} Event loop lag in milliseconds, or null if not available
 */
export function extractEventLoopLag(transaction) {
  const data = transaction.data || transaction;
  const breadcrumbs = Array.isArray(data.breadcrumbs)
    ? data.breadcrumbs
    : data.breadcrumbs?.values || [];
  
  const eventLoopBreadcrumb = breadcrumbs.find(b =>
    b.message && b.message.includes('event loop lag')
  );
  
  if (eventLoopBreadcrumb) {
    const lagMatch = eventLoopBreadcrumb.message.match(/([\d.]+)\s*ms/);
    if (lagMatch) {
      return parseFloat(lagMatch[1]);
    }
  }
  
  return null;
}

/**
 * Extract span data for detailed transaction breakdown
 * @param {Object} transaction - Transaction event data
 * @returns {Array} Array of span objects with timing information
 */
export function extractSpans(transaction) {
  const data = transaction.data || transaction;
  const spans = data.spans || [];
  
  return spans.map(span => ({
    op: span.op || 'unknown',
    description: span.description || '',
    startTimestamp: span.start_timestamp || null,
    timestamp: span.timestamp || null,
    duration: span.timestamp && span.start_timestamp
      ? span.timestamp - span.start_timestamp
      : null,
    status: span.status || 'ok',
    data: span.data || {}
  }));
}

/**
 * Extract transaction metadata
 * @param {Object} transaction - Transaction event data
 * @returns {Object} Transaction info (name, status, platform, etc.)
 */
export function extractTransactionInfo(transaction) {
  const data = transaction.data || transaction;
  
  return {
    name: data.transaction || 'unnamed',
    status: data.status || 'ok',
    platform: data.platform || null,
    environment: data.environment || null,
    release: data.release || null,
    timestamp: data.timestamp || null,
    startTimestamp: data.start_timestamp || null,
    duration: extractDuration(transaction),
    transaction: data.transaction || null
  };
}

/**
 * Extract all performance metrics from a transaction
 * @param {Object} transaction - Transaction event data (from database Event model)
 * @returns {Object} Complete performance metrics
 */
export function extractAllMetrics(transaction) {
  const info = extractTransactionInfo(transaction);
  const measurements = extractMeasurements(transaction);
  const memory = extractMemoryMetrics(transaction);
  const cpu = extractCpuUsage(transaction);
  const eventLoopLag = extractEventLoopLag(transaction);
  const spans = extractSpans(transaction);
  
  return {
    ...info,
    measurements,
    memory,
    cpu,
    eventLoopLag,
    spans,
    // Legacy fields for backward compatibility
    duration: info.duration,
    timestamp: info.timestamp,
    startTimestamp: info.startTimestamp
  };
}
