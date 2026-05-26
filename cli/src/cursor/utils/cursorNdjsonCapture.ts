import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const TRUTHY_CAPTURE = new Set(['1', 'true', 'yes']);

const TOKEN_PATTERNS: RegExp[] = [
    /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
    /sk_api_[A-Za-z0-9]+/g,
    /ghp_[A-Za-z0-9]+/g,
    /xoxb-[A-Za-z0-9-]+/g,
    /sk-[A-Za-z0-9]+/g,
];

const PATH_PATTERNS: RegExp[] = [
    /~\/\.hapi(?:\/[^\s"'\\]*)?/g,
    /\/home\/[^\s"'\\]+/g,
];

/** Secret-like env assignments in NDJSON text (e.g. "API_KEY=..."). */
const ENV_SECRET_PATTERN =
    /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*)\s*=\s*([^\s"',\\]+)/gi;

export function isNdjsonCaptureEnabled(): boolean {
    const raw = process.env.HAPI_CURSOR_NDJSON_CAPTURE;
    if (raw === undefined || raw === '') {
        return false;
    }
    return TRUTHY_CAPTURE.has(raw.trim().toLowerCase());
}

function expandHome(path: string): string {
    if (path.startsWith('~/')) {
        return join(homedir(), path.slice(2));
    }
    if (path === '~') {
        return homedir();
    }
    return path.replace(/^~/, homedir());
}

export function captureBaseDir(): string {
    const base = process.env.HAPI_HOME
        ? expandHome(process.env.HAPI_HOME)
        : join(homedir(), '.hapi');
    return join(base, 'cursor-ndjson-capture');
}

function safeTimestampForFilename(date: Date = new Date()): string {
    return date.toISOString().replace(/[:.]/g, '-');
}

export function getCapturePathForSession(sessionKey: string): string {
    const dir = captureBaseDir();
    mkdirSync(dir, { recursive: true });
    const safeKey = sessionKey.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'no-session';
    return join(dir, `${safeKey}-${safeTimestampForFilename()}.ndjsonl`);
}

export function redactNdjsonLine(line: string): string {
    try {
        let out = line;
        for (const pattern of TOKEN_PATTERNS) {
            out = out.replace(pattern, '[REDACTED_TOKEN]');
        }
        for (const pattern of PATH_PATTERNS) {
            out = out.replace(pattern, '[REDACTED_PATH]');
        }
        out = out.replace(
            ENV_SECRET_PATTERN,
            (_match, key: string) => `${key}=[REDACTED_SECRET]`
        );
        return out;
    } catch {
        return line;
    }
}

export function appendRedactedNdjsonLine(capturePath: string, line: string): void {
    if (!isNdjsonCaptureEnabled()) {
        return;
    }
    try {
        mkdirSync(dirname(capturePath), { recursive: true });
        const redacted = redactNdjsonLine(line);
        appendFileSync(capturePath, `${redacted}\n`, 'utf8');
    } catch (err) {
        if (process.env.DEBUG) {
            // eslint-disable-next-line no-console
            console.debug('[cursor-ndjson-capture] write failed', err);
        }
    }
}
