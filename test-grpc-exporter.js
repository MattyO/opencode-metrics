import { trace, SpanStatusCode } from '@opentelemetry/api';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { createOpencodeClient } from "@opencode-ai/sdk"
import { inspect } from 'util';


const client = createOpencodeClient({
  baseUrl: "http://localhost:4096",
})

async function test() {
  console.log('Creating OTLP HTTP exporter to http://10.0.20.18:4318/v1/traces...');
  const exporter = new OTLPTraceExporter({
    url: 'http://10.0.20.18:4318/v1/traces',
  });
  console.log('Exporter created');

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'opencode-tracing-test',
  });

  const provider = new BasicTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(exporter, {
        maxQueueSize: 100,
        maxExportBatchSize: 10,
        exportIntervalMillis: 1000,
        exportTimeoutMillis: 5000,
      }),
    ],
  });

  trace.setGlobalTracerProvider(provider);
  const testTracer = trace.getTracer('test', '0.0.1');

  console.log('Creating test span...');
  const span = testTracer.startSpan('test-span');
  span.setAttribute('test.attribute', 'test-value');
  span.end();

  console.log('Span ended, waiting for export...');
  // Don't use shutdown — test if forceFlush alone sends the spans
  // await provider.shutdown();
  // console.log('Shutdown complete');

  // Force flush and wait for it to succeed
  await provider.forceFlush();
  console.log('Flush succeeded — waiting 2 minutes to see if Tempo receives the span...');
  await new Promise(resolve => setTimeout(resolve, 60_000));
  console.log('2 minute wait done, exiting...');
}
async function test2(){
  const sessions = await client.session.list()
  const result = await client.session.get({
  path: { id: "ses_e1ee7b002ffeWnjxdvzBcX3w6M" },
  })
  const first_session = sessions[0]
  const children = await client.session.children({
    path: { id: "ses_e1ee7b002ffeWnjxdvzBcX3w6M" },
  })
  const messages = await client.session.messages({
    path: { id: "ses_e1ee7b002ffeWnjxdvzBcX3w6M" },
  })

  //console.log(`sessions:\n${inspect(sessions, { depth: 5, colors: true })}`)
  console.log(`result time:\n${inspect(result.time, { depth: 5, colors: true })}`)
  //console.log(`children:\n${inspect(children, { depth: 5, colors: true })}`)
  //console.log(`messages:\n${inspect(messages, { depth: 5, colors: true })}`)
  //console.log(`messages:\n${inspect(result.messages, { depth: 5, colors: true })}`)
  //console.log(`children:\n${inspect(result.children(), { depth: 5, colors: true })}`)
}

//test2().catch(err => {
//  console.error('Test failed:', err);
//  process.exit(1);
//});
//
test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
