# opencode-tracing

OpenCode plugin that instruments agent loops, model calls, tool calls, and subagent sessions as OpenTelemetry spans — exported via OTLP HTTP to a configurable [Grafana Tempo](https://grafana.com/docs/tempo/) server.

## What it traces

| OpenCode event          | OTel span name / kind              |
|-------------------------|------------------------------------|
| `session.execution.*`   | `session.execution` (root)         |
| `session.step.started`  | `session.step` (child of execution)|
| `session.tool.called`   | `tool.call` (child of step)        |
| `session.forked`        | Links child & parent execution spans |
| `session.usage.recorded`| `session.usage.<source>`           |

Each span carries semantic attributes:

- **Session**: `session.id`, `opencode.execution.kind` (`main` | `subagent`)
- **Step / Model**: `opencode.agent.id`, `opencode.model.name`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `opencode.step.ttfm_ms`
- **Tool**: `tool.name`, `tool.call.id`, `tool.output`, `error.type`, `error.message`
- **Execution**: `opencode.execution.status` (`succeeded` | `failed` | `interrupted` | `cleaned`)

## Installation

### 1. Clone / copy into your project

The plugin lives in this directory. No install into your running OpenCode environment yet — just the source files.

```
opencode-metrics/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts
└── README.md
```

### 2. Load into OpenCode

Add the local path to your `opencode.json(c)` plugins array:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "./opencode-metrics"
  ]
}
```

Or if the directory is elsewhere:

```jsonc
{
  "plugins": [
    "/absolute/path/to/opencode-metrics"
  ]
}
```

### 3. Configure Tempo (via env vars or plugin options)

**Plugin options in `opencode.json(c)` (primary method):**

```jsonc
{
  "plugins": [
    {
      "package": "./opencode-metrics",
      "options": {
        "endpoint": "http://10.0.20.18:3200"
      }
    }
  ]
}
```

To configure a different Tempo endpoint, change the `endpoint` value or use environment variables:

```bash
export TEMPO_OTLP_ENDPOINT="http://localhost:4318"   # fallback if no plugin option
```

If your Tempo requires auth, also set:

```jsonc
{
  "plugins": [
    {
      "package": "./opencode-metrics",
      "options": {
        "endpoint": "http://10.0.20.18:3200",
        "username": "tempo",
        "password": "secret",
        "enabled": true,
        "serviceName": "my-opencode-instance",
        "sampleRate": 1,
        "maxQueueSize": 1024,
        "maxExportBatchSize": 512
      }
    }
  ]
}
```

## Tempo configuration

Point your Tempo at the OTLP receiver:

```yaml
# tempo.yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: "0.0.0.0:4318"

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/traces
```

Or for Grafana Cloud Tempo, set the OTLP endpoint to:

```
https://<instance-id>.<region>.tempo.grafana.net/otlp
```

With auth:

```bash
export TEMPO_USERNAME=<tempo-otlp-write-key>
export TEMPO_PASSWORD=""
```

## Querying in Grafana

Once traces are flowing:

1. Open Grafana → Explore → Tempo datasource
2. Filter by:
   - `service.name = "opencode"`
   - `session.id` — to find a specific session
   - `opencode.agent.id` — to filter by agent
   - `tool.name` — to find tool call traces
3. Look at the flame graph or trace table to see timing, costs, and errors across agent loops, model calls, and tool usage.

## Plugin options reference

| Option              | Env var              | Default                      | Description                                    |
|---------------------|----------------------|------------------------------|------------------------------------------------|
| `endpoint`          | `TEMPO_OTLP_ENDPOINT`| `http://localhost:4318`      | OTLP HTTP endpoint (traces appended automatically) |
| `username`          | `TEMPO_USERNAME`     | —                            | Basic auth username for Tempo                  |
| `password`          | `TEMPO_PASSWORD`     | —                            | Basic auth password for Tempo                  |
| `enabled`           | —                    | `true`                       | Disable tracing without uninstalling           |
| `serviceName`       | —                    | `opencode`                   | Service name label on all spans                |
| `sampleRate`        | —                    | `1`                          | 0–1, fraction of spans to send                 |
| `maxQueueSize`      | —                    | `1024`                       | Max spans in queue before flushing             |
| `maxExportBatchSize`| —                    | `512`                        | Max spans per export batch                     |
| `exportTimeoutMillis`| —                   | `30_000`                     | Max time per export attempt                    |
| `exportIntervalMillis`| —                  | `5_000`                      | Flush interval in ms                           |

## Project structure

```
opencode-metrics/
├── package.json          # Plugin manifest + OTel deps
├── tsconfig.json         # TypeScript config
├── src/
│   └── index.ts          # Plugin entry point — OTel provider + event listeners
└── README.md
```

## Notes

- Spans are batched and exported asynchronously via `BatchSpanProcessor`
- The plugin shuts down OTel gracefully when OpenCode unloads it
- Tool call output is truncated to 8192 characters to keep traces small
- Failed executions record `error.type` and `error.message` on the execution span
