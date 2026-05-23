/**
 * Minimal persistence functions for HAPI CLI
 *
 * Plan 10-03: parameterized by explicit file paths — no `@/configuration`
 * singleton imports. Callers pass `config.settingsFile` / `config.runnerStateFile`
 * / `config.runnerLockFile` / `config.privateKeyFile` derived from `loadConfig()`.
 */

import { FileHandle } from 'node:fs/promises'
import { readFile, writeFile, mkdir, open, unlink, rename, stat } from 'node:fs/promises'
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import { isProcessAlive } from '@/utils/process';

export interface Settings {
  // This ID is used as the actual database ID on the server
  // All machine operations use this ID
  machineId?: string
  machineIdConfirmedByServer?: boolean
  runnerAutoStartWhenRunningHappy?: boolean
  cliApiToken?: string
  // API URL for hub connections (priority: env HAPI_API_URL > this > default)
  apiUrl?: string
}

const defaultSettings: Settings = {}

/**
 * Runner state persisted locally (different from API RunnerState)
 * This is written to disk by the runner to track its local process state
 */
export interface RunnerLocallyPersistedState {
  pid: number;
  httpPort: number;
  startTime: string;
  startedWithCliVersion: string;
  startedWithCliMtimeMs?: number;
  startedWithApiUrl?: string;
  startedWithMachineId?: string;
  startedWithCliApiTokenHash?: string;
  lastHeartbeat?: string;
  runnerLogPath?: string;
}

export async function readSettings(settingsFile: string): Promise<Settings> {
  if (!existsSync(settingsFile)) {
    return { ...defaultSettings }
  }

  let content: string
  try {
    content = await readFile(settingsFile, 'utf8')
  } catch {
    throw new Error(
      `Cannot read ${settingsFile}. Please fix or remove the file and restart.`
    )
  }

  try {
    return JSON.parse(content)
  } catch {
    throw new Error(
      `Cannot parse ${settingsFile}: invalid JSON. Please fix or remove the file and restart.`
    )
  }
}

export async function writeSettings(settingsFile: string, settings: Settings): Promise<void> {
  const dir = dirname(settingsFile)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  await writeFile(settingsFile, JSON.stringify(settings, null, 2))
}

/**
 * Atomically update settings with multi-process safety via file locking
 * @param settingsFile The settings file path (from `config.settingsFile`)
 * @param updater Function that takes current settings and returns updated settings
 * @returns The updated settings
 */
export async function updateSettings(
  settingsFile: string,
  updater: (current: Settings) => Settings | Promise<Settings>
): Promise<Settings> {
  // Timing constants
  const LOCK_RETRY_INTERVAL_MS = 100;  // How long to wait between lock attempts
  const MAX_LOCK_ATTEMPTS = 50;        // Maximum number of attempts (5 seconds total)
  const STALE_LOCK_TIMEOUT_MS = 10000; // Consider lock stale after 10 seconds

  const dir = dirname(settingsFile)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const lockFile = settingsFile + '.lock';
  const tmpFile = settingsFile + '.tmp';
  let fileHandle;
  let attempts = 0;

  // Acquire exclusive lock with retries
  while (attempts < MAX_LOCK_ATTEMPTS) {
    try {
      // 'wx' = create exclusively, fail if exists (cross-platform compatible)
      fileHandle = await open(lockFile, 'wx');
      break;
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        // Lock file exists, wait and retry
        attempts++;
        await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));

        // Check for stale lock
        try {
          const stats = await stat(lockFile);
          if (Date.now() - stats.mtimeMs > STALE_LOCK_TIMEOUT_MS) {
            await unlink(lockFile).catch(() => { });
          }
        } catch { }
      } else {
        throw err;
      }
    }
  }

  if (!fileHandle) {
    throw new Error(`Failed to acquire settings lock after ${MAX_LOCK_ATTEMPTS * LOCK_RETRY_INTERVAL_MS / 1000} seconds`);
  }

  try {
    // Read current settings with defaults
    const current = await readSettings(settingsFile) || { ...defaultSettings };

    // Apply update
    const updated = await updater(current);

    // Write atomically using rename
    await writeFile(tmpFile, JSON.stringify(updated, null, 2));
    await rename(tmpFile, settingsFile); // Atomic on POSIX

    return updated;
  } finally {
    // Release lock
    await fileHandle.close();
    await unlink(lockFile).catch(() => { }); // Remove lock file
  }
}

//
// Authentication
//

export async function writeCredentialsDataKey(
  privateKeyFile: string,
  credentials: { publicKey: Uint8Array, machineKey: Uint8Array, token: string }
): Promise<void> {
  const dir = dirname(privateKeyFile)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  await writeFile(privateKeyFile, JSON.stringify({
    encryption: { publicKey: Buffer.from(credentials.publicKey).toString('base64'), machineKey: Buffer.from(credentials.machineKey).toString('base64') },
    token: credentials.token
  }, null, 2));
}

export async function clearCredentials(privateKeyFile: string): Promise<void> {
  if (existsSync(privateKeyFile)) {
    await unlink(privateKeyFile);
  }
}

export async function clearMachineId(settingsFile: string): Promise<void> {
  await updateSettings(settingsFile, settings => ({
    ...settings,
    machineId: undefined
  }));
}

/**
 * Read runner state from local file
 */
export async function readRunnerState(runnerStateFile: string): Promise<RunnerLocallyPersistedState | null> {
  try {
    if (!existsSync(runnerStateFile)) {
      return null;
    }
    const content = await readFile(runnerStateFile, 'utf-8');
    return JSON.parse(content) as RunnerLocallyPersistedState;
  } catch (error) {
    // State corrupted somehow :(
    console.error(`[PERSISTENCE] Runner state file corrupted: ${runnerStateFile}`, error);
    return null;
  }
}

/**
 * Write runner state to local file (synchronously for atomic operation)
 */
export function writeRunnerState(runnerStateFile: string, state: RunnerLocallyPersistedState): void {
  writeFileSync(runnerStateFile, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Clean up runner state file and lock file
 */
export async function clearRunnerState(runnerStateFile: string, runnerLockFile: string): Promise<void> {
  if (existsSync(runnerStateFile)) {
    await unlink(runnerStateFile);
  }
  // Also clean up lock file if it exists (for stale cleanup)
  if (existsSync(runnerLockFile)) {
    try {
      await unlink(runnerLockFile);
    } catch {
      // Lock file might be held by running runner, ignore error
    }
  }
}

/**
 * Acquire an exclusive lock file for the runner.
 */
export async function acquireRunnerLock(
  runnerLockFile: string,
  maxAttempts: number = 5,
  delayIncrementMs: number = 200
): Promise<FileHandle | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // 'wx' ensures we only create if it doesn't exist (atomic lock acquisition)
      const fileHandle = await open(runnerLockFile, 'wx');
      // Write PID to lock file for debugging
      await fileHandle.writeFile(String(process.pid));
      return fileHandle;
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        // Lock file exists, check if process is still running
        try {
          const lockPid = readFileSync(runnerLockFile, 'utf-8').trim();
          if (lockPid && !isNaN(Number(lockPid))) {
            if (!isProcessAlive(Number(lockPid))) {
              // Process doesn't exist, remove stale lock
              unlinkSync(runnerLockFile);
              continue; // Retry acquisition
            }
          }
        } catch {
          // Can't read lock file, might be corrupted
        }
      }

      if (attempt === maxAttempts) {
        return null;
      }
      const delayMs = attempt * delayIncrementMs;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

/**
 * Release runner lock by closing handle and deleting lock file
 */
export async function releaseRunnerLock(runnerLockFile: string, lockHandle: FileHandle): Promise<void> {
  try {
    await lockHandle.close();
  } catch { }

  try {
    if (existsSync(runnerLockFile)) {
      unlinkSync(runnerLockFile);
    }
  } catch { }
}
