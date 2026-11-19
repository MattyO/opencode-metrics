import { TracingOptions } from "../types/tracing"
import { logError } from "./logger"
import { debug } from "./plugin"

export function resolveOtlpEndpoint(options: TracingOptions): string {
  // The OTel HTTP exporter v0.200.x uses user-provided URL as-is (no auto /v1/traces suffix).
  // We must include the full OTLP traces endpoint path.
  let ep = options.endpoint ?? process.env.TEMPO_OTLP_ENDPOINT ?? "http://localhost:4317"

  debug(`[opencode-tracing] endpoint ${ep}`)
  ep = ep.replace(/\/+$/, "")
  // Ensure the path ends with /v1/traces
  //if (!ep.endsWith("/v1/traces")) ep += "/v1/traces"
  if (!ep.match(/^https?:\/\//)) ep = `http://${ep}`
  return ep
}

export function resolveAuthHeader(options: TracingOptions): string | undefined {
  const user = options.username ?? process.env.TEMPO_USERNAME
  const pass = options.password ?? process.env.TEMPO_PASSWORD
  if (user && pass) return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`
  return undefined
}

export function tsToHRTime(ts: number): [number, number] {
  const secs = Math.floor(ts)
  const nanos = Math.round((ts - secs) * 1_000_000_000)
  return [secs, nanos]
}
