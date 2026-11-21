// Mock for @opentelemetry/sdk-trace-base
export class BasicTracerProvider {
  constructor(_opts?: any) {}
  spanProcessor: any = null
  forceFlush = async () => {}
  shutdown = async () => {}
}

export class BatchSpanProcessor {
  constructor(_exporter: any, _opts?: any) {}
  forceFlush = async () => {}
  shutdown = async () => {}
}
