import { describe, it, expect, rs, beforeAll, afterAll, beforeEach } from '@rstest/core'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// var is hoisted and initialized to undefined (no TDZ), so the factory
// can assign it before beforeAll/afterAll read it.
var testDir: string

// Mock the log path so debug() writes to our temp directory.
rs.mock('@plugin/constants', () => {
  testDir = path.join(os.tmpdir(), 'opencode-tracing-debug-test')
  fs.mkdirSync(testDir, { recursive: true })
  return {
    DEBUG_LOG: path.join(testDir, 'debug.log'),
    ALL_EVENTS: [] as string[],
    SHOW_FULL_DATA: new Set<string>(),
  }
})

beforeAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true })
  fs.mkdirSync(testDir, { recursive: true })
})

beforeEach(() => {
  const logFile = path.join(testDir, 'debug.log')
  fs.rmSync(logFile, { force: true })
  fs.writeFileSync(logFile, '', 'utf-8')
})

afterAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true })
})

import { debug, logError } from '@utils/log'

// ---------------------------------------------------------------------------
// debug
// ---------------------------------------------------------------------------

describe('debug', () => {
  it('writes a timestamped line to the log file', () => {
    debug('[opencode-tracing] test message')

    const lines = fs.readFileSync(path.join(testDir, 'debug.log'), 'utf-8').split('\n').filter(Boolean)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T/)
    expect(lines[0]).toContain('[opencode-tracing] test message')
  })

  it('appends a second call to the file', () => {
    debug('[opencode-tracing] first')
    debug('[opencode-tracing] second')

    const lines = fs.readFileSync(path.join(testDir, 'debug.log'), 'utf-8').split('\n').filter(Boolean)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('[opencode-tracing] first')
    expect(lines[1]).toContain('[opencode-tracing] second')
  })

  it('formats objects with inspect', () => {
    debug({ foo: 'bar', nested: { a: 1, b: [1, 2] } })

    const lines = fs.readFileSync(path.join(testDir, 'debug.log'), 'utf-8').split('\n').filter(Boolean)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T/)
    expect(lines[0]).toContain("foo: 'bar'")
    expect(lines[0]).toContain("nested: {")
  })
})

// ---------------------------------------------------------------------------
// logError
// ---------------------------------------------------------------------------

describe('logError', () => {
  it('logs Error message when stack is not available', () => {
    const err = { message: 'boom' }
    logError('test', err as unknown as Error)

    const lines = fs.readFileSync(path.join(testDir, 'debug.log'), 'utf-8').split('\n').filter(Boolean)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('[opencode-tracing] test: boom')
  })

  it('logs Error stack trace when available', () => {
    const err = new Error('stack test')
    logError('label', err)

    const content = fs.readFileSync(path.join(testDir, 'debug.log'), 'utf-8')
    const lines = content.split('\n').filter(l => l.match(/^\[\d{4}-/))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('[opencode-tracing] label:')
    expect(content).toContain('stack test')
  })

  it('falls back to String(err) for non-Error values', () => {
    logError('null check', null as unknown as Error)

    const lines = fs.readFileSync(path.join(testDir, 'debug.log'), 'utf-8').split('\n').filter(Boolean)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('[opencode-tracing] null check: null')
  })
})
