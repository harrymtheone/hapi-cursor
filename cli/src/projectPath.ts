import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import packageJson from '../package.json';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Bun embeds compiled code in a virtual filesystem: /$bunfs/ (Linux/macOS) or /~BUN/ (Windows) */
const bunMain = globalThis.Bun?.main ?? '';
const isCompiled = bunMain.includes('$bunfs') || bunMain.includes('/~BUN/');

export function projectPath(): string {
    return resolve(__dirname, '..');
}

/**
 * Plan 10-03: `runtimePath` is parameterized by `happyHomeDir` (sourced from
 * the frozen Config) instead of reading the singleton configuration.
 */
export function runtimePath(happyHomeDir: string): string {
    if (!isCompiled) {
        return projectPath();
    }

    return join(happyHomeDir, 'runtime', packageJson.version);
}

export function isBunCompiled(): boolean {
    return isCompiled;
}
