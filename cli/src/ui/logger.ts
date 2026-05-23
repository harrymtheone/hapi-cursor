/**
 * Design decisions:
 * - Logging should be done only through file for debugging, otherwise we might disturb the agent session when in interactive mode
 * - Use info for logs that are useful to the user - this is our UI
 * - File output location: ~/.handy/logs/<date time in local timezone>.log
 *
 * Plan 10-03 DI: the singleton `logger` is initialized lazily and replaced
 * by `initializeLogger(config)` at the CLI entry-point once `loadConfig()`
 * has produced a frozen Config. `listRunnerLogFiles` and `getLatestRunnerLog`
 * take explicit paths so no module-level `@/configuration` import survives.
 */

import chalk from 'chalk'
import { appendFileSync } from 'fs'
import { existsSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import type { Config } from '@/configuration'
import { readRunnerState } from '@/persistence'

/**
 * Consistent date/time formatting functions
 */
function createTimestampForFilename(date: Date = new Date()): string {
  return date.toLocaleString('sv-SE', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).replace(/[: ]/g, '-').replace(/,/g, '') + '-pid-' + process.pid
}

function createTimestampForLogEntry(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })
}

// Pre-config-load defaults so anything that touches the logger before
// initializeLogger() runs (early errors during bootstrap) still writes
// somewhere reasonable. Replaced via initializeLogger() after loadConfig().
function defaultLogsDir(): string {
  const base = process.env.HAPI_HOME
    ? process.env.HAPI_HOME.replace(/^~/, homedir())
    : join(homedir(), '.hapi')
  return join(base, 'logs')
}

function computeSessionLogPath(logsDir: string, isRunnerProcess: boolean): string {
  const timestamp = createTimestampForFilename()
  const filename = isRunnerProcess ? `${timestamp}-runner.log` : `${timestamp}.log`
  return join(logsDir, filename)
}

export class Logger {
  constructor(
    public readonly logFilePath: string,
    public readonly logsDir: string
  ) { }

  // Use local timezone for simplicity of locating the logs,
  // in practice you will not need absolute timestamps
  localTimezoneTimestamp(): string {
    return createTimestampForLogEntry()
  }

  debug(message: string, ...args: unknown[]): void {
    this.logToFile(`[${this.localTimezoneTimestamp()}]`, message, ...args)
  }

  debugLargeJson(
    message: string,
    object: unknown,
    maxStringLength: number = 100,
    maxArrayLength: number = 10,
  ): void {
    if (!process.env.DEBUG) {
      this.debug(`In production, skipping message inspection`)
      return
    }

    const truncateStrings = (obj: unknown): unknown => {
      if (typeof obj === 'string') {
        return obj.length > maxStringLength
          ? obj.substring(0, maxStringLength) + '... [truncated for logs]'
          : obj
      }

      if (Array.isArray(obj)) {
        const truncatedArray = obj.map(item => truncateStrings(item)).slice(0, maxArrayLength)
        if (obj.length > maxArrayLength) {
          truncatedArray.push(`... [truncated array for logs up to ${maxArrayLength} items]` as unknown)
        }
        return truncatedArray
      }

      if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'usage') {
            continue
          }
          result[key] = truncateStrings(value)
        }
        return result
      }

      return obj
    }

    const truncatedObject = truncateStrings(object)
    const json = JSON.stringify(truncatedObject, null, 2)
    this.logToFile(`[${this.localTimezoneTimestamp()}]`, message, '\n', json)
  }

  info(message: string, ...args: unknown[]): void {
    this.logToConsole('info', '', message, ...args)
    this.debug(message, args)
  }

  infoDeveloper(message: string, ...args: unknown[]): void {
    this.debug(message, ...args)
    if (process.env.DEBUG) {
      this.logToConsole('info', '[DEV]', message, ...args)
    }
  }

  warn(message: string, ...args: unknown[]): void {
    this.logToConsole('warn', '', message, ...args)
    this.debug(`[WARN] ${message}`, ...args)
  }

  getLogPath(): string {
    return this.logFilePath
  }

  private logToConsole(level: 'debug' | 'error' | 'info' | 'warn', prefix: string, message: string, ...args: unknown[]): void {
    switch (level) {
      case 'debug': {
        console.log(chalk.gray(prefix), message, ...args)
        break
      }

      case 'error': {
        console.error(chalk.red(prefix), message, ...args)
        break
      }

      case 'info': {
        console.log(chalk.blue(prefix), message, ...args)
        break
      }

      case 'warn': {
        console.log(chalk.yellow(prefix), message, ...args)
        break
      }

      default: {
        this.debug('Unknown log level:', level)
        console.log(chalk.blue(prefix), message, ...args)
        break
      }
    }
  }

  private logToFile(prefix: string, message: string, ...args: unknown[]): void {
    const logLine = `${prefix} ${message} ${args.map(arg =>
      typeof arg === 'string' ? arg : JSON.stringify(arg)
    ).join(' ')}\n`

    try {
      appendFileSync(this.logFilePath, logLine)
    } catch (appendError) {
      if (process.env.DEBUG) {
        console.error('[DEV MODE ONLY THROWING] Failed to append to log file:', appendError)
        throw appendError
      }
      // In production, fail silently to avoid disturbing the agent session
    }
  }
}

function makeFallbackLogger(): Logger {
  // Try the env-derived default first; fall back to tmpdir if it fails.
  try {
    const logsDir = defaultLogsDir()
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true })
    }
    return new Logger(computeSessionLogPath(logsDir, false), logsDir)
  } catch {
    const fallback = join(tmpdir(), 'hapi-logs')
    try { mkdirSync(fallback, { recursive: true }) } catch { /* ignore */ }
    return new Logger(computeSessionLogPath(fallback, false), fallback)
  }
}

// Mutable singleton: an initial pre-config-load fallback is created so any
// imports during bootstrap (e.g. error paths inside loadConfig) still write
// somewhere. `initializeLogger(config)` replaces it after loadConfig.
export let logger: Logger = makeFallbackLogger()

/**
 * Replace the singleton logger with one derived from the frozen Config.
 * Called exactly once from runCli after loadConfig().
 */
export function initializeLogger(config: Pick<Config, 'isRunnerProcess' | 'logsDir'>): void {
  logger = new Logger(
    computeSessionLogPath(config.logsDir, config.isRunnerProcess),
    config.logsDir
  )
}

/**
 * Information about a log file on disk
 */
export type LogFileInfo = {
  file: string;
  path: string;
  modified: Date;
};

/**
 * List runner log files in descending modification time order.
 * Returns up to `limit` entries; empty array if none.
 */
export async function listRunnerLogFiles(
  logsDir: string,
  runnerStateFile: string,
  limit: number = 50
): Promise<LogFileInfo[]> {
  try {
    if (!existsSync(logsDir)) {
      return [];
    }

    const logs = readdirSync(logsDir)
      .filter(file => file.endsWith('-runner.log'))
      .map(file => {
        const fullPath = join(logsDir, file);
        const stats = statSync(fullPath);
        return { file, path: fullPath, modified: stats.mtime } as LogFileInfo;
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime());

    // Prefer the path persisted by the runner if present (return 0th element if present)
    try {
      const state = await readRunnerState(runnerStateFile);

      if (!state) {
        return logs;
      }

      if (state.runnerLogPath && existsSync(state.runnerLogPath)) {
        const stats = statSync(state.runnerLogPath);
        const persisted: LogFileInfo = {
          file: basename(state.runnerLogPath),
          path: state.runnerLogPath,
          modified: stats.mtime
        };
        const idx = logs.findIndex(l => l.path === persisted.path);
        if (idx >= 0) {
          const [found] = logs.splice(idx, 1);
          logs.unshift(found);
        } else {
          logs.unshift(persisted);
        }
      }
    } catch {
      // Ignore errors reading runner state; fall back to directory listing
    }

    return logs.slice(0, Math.max(0, limit));
  } catch {
    return [];
  }
}

/**
 * Get the most recent runner log file, or null if none exist.
 */
export async function getLatestRunnerLog(
  logsDir: string,
  runnerStateFile: string
): Promise<LogFileInfo | null> {
  const [latest] = await listRunnerLogFiles(logsDir, runnerStateFile, 1);
  return latest || null;
}
