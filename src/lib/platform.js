/**
 * Derive a short platform slug for issue lists (e.g. js, php, node) from
 * Sentry-style event JSON: platform, sdk.name, contexts.runtime.
 */

const PLATFORM_ALIASES = {
  javascript: 'js',
  js: 'js',
  browser: 'js',
  'browser-js': 'js',
  node: 'node',
  'node.js': 'node',
  deno: 'deno',
  bun: 'bun',
  php: 'php',
  python: 'py',
  ruby: 'rb',
  go: 'go',
  golang: 'go',
  java: 'java',
  kotlin: 'kotlin',
  swift: 'swift',
  csharp: 'cs',
  'c#': 'cs',
  dotnet: 'dotnet',
  rust: 'rust',
  native: 'native',
  cocoa: 'cocoa',
  objc: 'objc',
  android: 'android',
  flutter: 'flutter',
  dart: 'dart',
  elixir: 'ex',
  erlang: 'erl',
  perl: 'perl',
  unity: 'unity',
  // Sentry sometimes sends these
  other: 'other',
};

function slugifyUnknown(raw) {
  const s = String(raw).toLowerCase().trim().replace(/\s+/g, '-');
  if (!s) return null;
  return s.length > 14 ? s.slice(0, 14) : s;
}

function fromSdkName(name) {
  if (!name || typeof name !== 'string') return null;
  const n = name.toLowerCase();
  if (n.includes('sentry.javascript') || n.includes('sentry.browser')) return 'js';
  if (n.includes('sentry.node')) return 'node';
  if (n.includes('sentry.php')) return 'php';
  if (n.includes('sentry.python')) return 'py';
  if (n.includes('sentry.ruby')) return 'rb';
  if (n.includes('sentry.java')) return 'java';
  if (n.includes('sentry.cocoa') || n.includes('sentry.apple')) return 'cocoa';
  if (n.includes('sentry.android')) return 'android';
  if (n.includes('sentry.dart') || n.includes('sentry.flutter')) return 'dart';
  if (n.includes('sentry.go')) return 'go';
  if (n.includes('sentry.dotnet') || n.includes('sentry.csharp')) return 'cs';
  if (n.includes('sentry.rust')) return 'rust';
  if (n.includes('php')) return 'php';
  if (n.includes('python')) return 'py';
  if (n.includes('ruby')) return 'rb';
  if (n.includes('node')) return 'node';
  if (n.includes('javascript') || n.includes('browser')) return 'js';
  return null;
}

function fromRuntimeName(name) {
  if (!name || typeof name !== 'string') return null;
  const n = name.toLowerCase();
  if (n.includes('php')) return 'php';
  if (n.includes('node')) return 'node';
  if (n.includes('python')) return 'py';
  if (n.includes('ruby')) return 'rb';
  if (n.includes('java ') || n === 'java') return 'java';
  if (n.includes('.net') || n.includes('mono')) return 'dotnet';
  if (n.includes('deno')) return 'deno';
  if (n.includes('bun')) return 'bun';
  return null;
}

/**
 * @param {Record<string, unknown> | null | undefined} data - event.data
 * @returns {string | null} short label for UI, e.g. "js", "php"
 */
export function platformFromEventData(data) {
  if (!data || typeof data !== 'object') return null;

  const explicit =
    typeof data.platform === 'string' ? data.platform.trim().toLowerCase() : '';
  if (explicit) {
    if (PLATFORM_ALIASES[explicit]) return PLATFORM_ALIASES[explicit];
    return slugifyUnknown(explicit);
  }

  const sdkName = data.sdk && typeof data.sdk === 'object' ? data.sdk.name : null;
  const fromSdk = fromSdkName(sdkName);
  if (fromSdk) return fromSdk;

  const rt =
    data.contexts &&
    typeof data.contexts === 'object' &&
    data.contexts.runtime &&
    typeof data.contexts.runtime === 'object'
      ? data.contexts.runtime.name
      : null;
  const fromRt = fromRuntimeName(rt);
  if (fromRt) return fromRt;

  if (data.minidump && typeof data.minidump === 'object' && data.minidump.platform) {
    const mp = String(data.minidump.platform).toLowerCase();
    return slugifyUnknown(mp);
  }

  return null;
}
