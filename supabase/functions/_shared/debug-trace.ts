import { SupabaseClient } from "@supabase/supabase-js";

export interface TraceContext {
  trace_id: string;
  parent_event_id?: string;
  sequence_number: number;
  function_name: string;
  workspace_id?: string;
}

export type TraceStatus = 'started' | 'success' | 'error' | 'skipped' | 'blocked';
export type EventType = 'entry' | 'process' | 'exit' | 'error' | 'child_call';

interface TraceData {
  event_type?: EventType;
  input?: unknown;
  output?: unknown;
  expected?: unknown;
  error?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

// List of sensitive keys to sanitize
const SENSITIVE_KEYS = [
  'token',
  'password',
  'secret',
  'key',
  'authorization',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'credentials',
  'auth',
  'bearer',
];

/**
 * Sanitizes payload by removing sensitive data
 */
export function sanitizePayload(payload: unknown): unknown {
  if (payload === null || payload === undefined) {
    return null;
  }

  if (typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(item => sanitizePayload(item));
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains any sensitive pattern
    const isSensitive = SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Creates a new trace context for entry points (webhooks, etc.)
 */
export function createTraceContext(functionName: string, workspaceId?: string): TraceContext {
  return {
    trace_id: crypto.randomUUID(),
    sequence_number: 1,
    function_name: functionName,
    workspace_id: workspaceId,
  };
}

/**
 * Creates a child trace context from an existing context
 */
export function createChildContext(
  parentContext: TraceContext,
  functionName: string,
  parentEventId: string
): TraceContext {
  return {
    trace_id: parentContext.trace_id,
    parent_event_id: parentEventId,
    sequence_number: parentContext.sequence_number + 1,
    function_name: functionName,
    workspace_id: parentContext.workspace_id,
  };
}

/**
 * Parses trace context from request body
 */
export function parseTraceContext(body: Record<string, unknown>, functionName: string): TraceContext {
  const trace = body._trace as {
    trace_id?: string;
    parent_event_id?: string;
    sequence?: number;
    workspace_id?: string;
  } | undefined;

  if (trace?.trace_id) {
    return {
      trace_id: trace.trace_id,
      parent_event_id: trace.parent_event_id,
      sequence_number: trace.sequence || 1,
      function_name: functionName,
      workspace_id: trace.workspace_id,
    };
  }

  return createTraceContext(functionName);
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return Deno.env.get('DEBUG_MODE') === 'true';
}

/**
 * Records a debug trace event
 * Only records if DEBUG_MODE=true OR if status is 'error' (errors are always recorded)
 */
export async function debugTrace(
  supabase: SupabaseClient,
  ctx: TraceContext,
  eventName: string,
  status: TraceStatus,
  data: TraceData = {}
): Promise<string | null> {
  const debugEnabled = isDebugEnabled();

  // Always record errors, otherwise only record if debug mode is enabled
  if (!debugEnabled && status !== 'error') {
    return null;
  }

  // Determine event type
  let eventType: EventType = data.event_type || 'process';
  if (!data.event_type) {
    if (data.input && !data.output) eventType = 'entry';
    else if (data.output && !data.input) eventType = 'exit';
    else if (data.error) eventType = 'error';
  }

  const eventId = crypto.randomUUID();

  try {
    const { error } = await supabase.from('debug_traces').insert({
      id: eventId,
      trace_id: ctx.trace_id,
      parent_event_id: ctx.parent_event_id,
      sequence_number: ctx.sequence_number,
      function_name: ctx.function_name,
      event_type: eventType,
      event_name: eventName,
      status,
      input_payload: sanitizePayload(data.input),
      output_payload: sanitizePayload(data.output),
      expected_output: data.expected ? sanitizePayload(data.expected) : null,
      error_message: data.error,
      duration_ms: data.duration_ms,
      metadata: data.metadata ? sanitizePayload(data.metadata) : null,
      workspace_id: ctx.workspace_id,
    });

    if (error) {
      console.error('[debugTrace] Failed to insert trace:', error.message);
      return null;
    }

    return eventId;
  } catch (err) {
    // Fire and forget - don't block the main flow
    console.error('[debugTrace] Exception:', err);
    return null;
  }
}

/**
 * Helper to measure and record duration of an async operation
 */
export async function traceAsync<T>(
  supabase: SupabaseClient,
  ctx: TraceContext,
  eventName: string,
  operation: () => Promise<T>,
  options: {
    input?: unknown;
    expected?: unknown;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<{ result: T; eventId: string | null }> {
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    const eventId = await debugTrace(supabase, ctx, eventName, 'success', {
      input: options.input,
      output: result,
      expected: options.expected,
      duration_ms: duration,
      metadata: options.metadata,
    });

    return { result, eventId };
  } catch (error) {
    const duration = Date.now() - startTime;

    await debugTrace(supabase, ctx, eventName, 'error', {
      input: options.input,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: duration,
      metadata: options.metadata,
    });

    throw error;
  }
}

/**
 * Prepares trace context to be passed to child function calls
 */
export function prepareChildTrace(ctx: TraceContext, eventId: string): Record<string, unknown> {
  return {
    _trace: {
      trace_id: ctx.trace_id,
      parent_event_id: eventId,
      sequence: ctx.sequence_number + 1,
      workspace_id: ctx.workspace_id,
    }
  };
}
