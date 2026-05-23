/**
 * Low-level difftastic wrapper - just arguments in, string out
 */

import { spawn } from 'child_process';
import { join, resolve } from 'path';
import { homedir, platform, arch } from 'os';
import { runtimePath } from '@/projectPath';

// RPC handlers don't have access to the loaded Config; derive happyHomeDir
// the same way `loadConfig()` does (HAPI_HOME with `~` expansion → ~/.hapi).
function happyHomeDirFromEnv(): string {
    return process.env.HAPI_HOME
        ? process.env.HAPI_HOME.replace(/^~/, homedir())
        : join(homedir(), '.hapi');
}

export interface DifftasticResult {
    exitCode: number
    stdout: string
    stderr: string
}

export interface DifftasticOptions {
    cwd?: string
}

/**
 * Get the platform-specific binary path
 */
function getBinaryPath(): string {
    const platformName = platform();
    const binaryName = platformName === 'win32' ? 'difft.exe' : 'difft';
    return resolve(join(runtimePath(happyHomeDirFromEnv()), 'tools', 'unpacked', binaryName));
}

/**
 * Run difftastic with the given arguments
 * @param args - Array of command line arguments to pass to difftastic
 * @param options - Options for difftastic execution
 * @returns Promise with exit code, stdout and stderr
 */
export function run(args: string[], options?: DifftasticOptions): Promise<DifftasticResult> {
    const binaryPath = getBinaryPath();
    
    return new Promise((resolve, reject) => {
        const child = spawn(binaryPath, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: options?.cwd,
            env: {
                ...process.env,
                // Force color output when needed
                FORCE_COLOR: '1'
            }
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            resolve({
                exitCode: code || 0,
                stdout,
                stderr
            });
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}
