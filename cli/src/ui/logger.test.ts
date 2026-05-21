import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Logger } from './logger'

const removedRemoteLogEnv = ['DANGEROUSLY', 'LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING'].join('_')
const originalApiUrl = process.env.HAPI_API_URL
const originalRemovedRemoteLogging = process.env[removedRemoteLogEnv]
const originalDebug = process.env.DEBUG
const originalFetch = globalThis.fetch

describe('Logger local-only logging', () => {
  let tempDir: string
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'hapi-logger-test-'))
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    process.env.HAPI_API_URL = 'https://hapi.example.com'
    process.env[removedRemoteLogEnv] = '1'
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    globalThis.fetch = originalFetch

    if (originalApiUrl === undefined) {
      delete process.env.HAPI_API_URL
    } else {
      process.env.HAPI_API_URL = originalApiUrl
    }

    if (originalRemovedRemoteLogging === undefined) {
      delete process.env[removedRemoteLogEnv]
    } else {
      process.env[removedRemoteLogEnv] = originalRemovedRemoteLogging
    }

    if (originalDebug === undefined) {
      delete process.env.DEBUG
    } else {
      process.env.DEBUG = originalDebug
    }

    vi.restoreAllMocks()
  })

  it('writes local log entries without uploading when remote-log env is set', () => {
    const logPath = join(tempDir, 'session.log')
    const logger = new Logger(logPath)

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      logger.debug('debug entry', { ok: true })
      logger.info('info entry', 'visible')
      logger.warn('warn entry')
    } finally {
      logSpy.mockRestore()
    }

    const logContent = readFileSync(logPath, 'utf8')
    expect(logContent).toContain('debug entry')
    expect(logContent).toContain('info entry')
    expect(logContent).toContain('warn entry')
    expect(logContent.trim().length).toBeGreaterThan(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not inspect large payloads outside DEBUG mode', () => {
    delete process.env.DEBUG
    const logPath = join(tempDir, 'session.log')
    const logger = new Logger(logPath)

    logger.debugLargeJson('payload', { secret: 'do-not-write' })

    const logContent = readFileSync(logPath, 'utf8')
    expect(logContent).toContain('In production, skipping message inspection')
    expect(logContent).not.toContain('payload')
    expect(logContent).not.toContain('do-not-write')
  })
})
