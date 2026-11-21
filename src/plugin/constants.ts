export const DEBUG_LOG = '/tmp/opencode-tracing-debug.log'

export const ALL_EVENTS = [
  'session.execution.started',
  'session.execution.succeeded',
  'session.execution.failed',
  'session.execution.interrupted',
  'session.inbox.delivered',
  'session.step.started',
  'session.step.ended',
  'session.step.first-token',
  'session.reasoning.started',
  'session.reasoning.ended',
  'session.tool.called',
  'session.tool.success',
  'session.tool.failed',
  'session.compaction.started',
  'session.compaction.ended',
] as const
export const SHOW_FULL_DATA= new Set([
  'session.reasoning.started',
  'session.reasoning.ended',
  'session.tool.called',
  'session.tool.success',
  'session.tool.failed',
  'session.compaction.started',
  'session.compaction.ended',
])
