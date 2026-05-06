import { randomBytes } from 'node:crypto';

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceState?: Record<string, string>;
  debugMode: boolean;
}

const TRACEPARENT_REGEX = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i;

export function parseTraceparent(header: string | undefined): { traceId: string; spanId: string } | undefined {
  if (!header) {
    return undefined;
  }
  const match = TRACEPARENT_REGEX.exec(header.trim());
  if (!match) {
    return undefined;
  }
  return { traceId: match[1], spanId: match[2] };
}

export function parseTracestate(header: string | undefined): Record<string, string> | undefined {
  if (!header) {
    return undefined;
  }
  const entries: [string, string][] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    if (key && value) {
      entries.push([key.trim(), value.trim()]);
    }
  }
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

export function buildTraceContext(headers: Record<string, string | string[] | undefined>): TraceContext {
  const traceparent = parseTraceparent(asString(headers['traceparent']));
  const tracestate = parseTracestate(asString(headers['tracestate']));
  const debugMode =
    asString(headers['x-debug-mode']) === 'true' || tracestate?.['debug_mode'] === 'true';

  return {
    traceId: traceparent?.traceId ?? generateTraceId(),
    spanId: traceparent?.spanId ?? generateSpanId(),
    traceState: tracestate,
    debugMode,
  };
}

function asString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
