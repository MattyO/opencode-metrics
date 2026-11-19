import { Span } from "@opentelemetry/api"

export interface TracingOptions {
  endpoint?: string
  username?: string
  password?: string
  enabled?: boolean
  serviceName?: string
  sampleRate?: number
  maxQueueSize?: number
  maxExportBatchSize?: number
  exportTimeoutMillis?: number
  exportIntervalMillis?: number
}

export interface StepInfo {
  span: Span
  started: number
}

export interface ExecutionInfo {
  span: Span
  steps: Map<string, StepInfo>
  toolsProcessed: Set<string>
  _toolSpans: Map<string, Span>
}
