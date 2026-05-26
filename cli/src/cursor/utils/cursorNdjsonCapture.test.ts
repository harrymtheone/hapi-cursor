import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    appendRedactedNdjsonLine,
    getCapturePathForSession,
    isNdjsonCaptureEnabled,
    redactNdjsonLine,
} from './cursorNdjsonCapture';

describe('cursorNdjsonCapture', () => {
    let tempHome: string;

    beforeEach(() => {
        tempHome = mkdtempSync(join(tmpdir(), 'hapi-capture-test-'));
        vi.stubEnv('HAPI_HOME', tempHome);
        delete process.env.HAPI_CURSOR_NDJSON_CAPTURE;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        rmSync(tempHome, { recursive: true, force: true });
    });

    describe('isNdjsonCaptureEnabled', () => {
        it('returns true when HAPI_CURSOR_NDJSON_CAPTURE is 1', () => {
            vi.stubEnv('HAPI_CURSOR_NDJSON_CAPTURE', '1');
            expect(isNdjsonCaptureEnabled()).toBe(true);
        });

        it('returns true for true/yes case-insensitively', () => {
            vi.stubEnv('HAPI_CURSOR_NDJSON_CAPTURE', ' TRUE ');
            expect(isNdjsonCaptureEnabled()).toBe(true);
            vi.stubEnv('HAPI_CURSOR_NDJSON_CAPTURE', 'Yes');
            expect(isNdjsonCaptureEnabled()).toBe(true);
        });

        it('returns false when unset', () => {
            expect(isNdjsonCaptureEnabled()).toBe(false);
        });

        it('returns false for other values', () => {
            vi.stubEnv('HAPI_CURSOR_NDJSON_CAPTURE', '0');
            expect(isNdjsonCaptureEnabled()).toBe(false);
        });
    });

    describe('redactNdjsonLine', () => {
        it('redacts Bearer tokens', () => {
            const out = redactNdjsonLine('{"token":"Bearer abc123"}');
            expect(out).not.toContain('abc123');
            expect(out).toContain('[REDACTED_TOKEN]');
        });

        it('redacts /home/user path segments', () => {
            const out = redactNdjsonLine('{"path":"/home/user/project/file.ts"}');
            expect(out).not.toContain('/home/user');
            expect(out).toContain('[REDACTED_PATH]');
        });

        it('redacts ~/.hapi paths', () => {
            const out = redactNdjsonLine('log at ~/.hapi/cursor-ndjson-capture/x.ndjsonl');
            expect(out).not.toContain('~/.hapi');
            expect(out).toContain('[REDACTED_PATH]');
        });

        it('redacts api key prefixes', () => {
            expect(redactNdjsonLine('sk_api_abc')).not.toContain('sk_api_abc');
            expect(redactNdjsonLine('ghp_abc')).not.toContain('ghp_abc');
            expect(redactNdjsonLine('xoxb-abc')).not.toContain('xoxb-abc');
        });

        it('never throws on malformed input', () => {
            expect(() => redactNdjsonLine('not json {{{')).not.toThrow();
        });
    });

    describe('appendRedactedNdjsonLine', () => {
        it('is a no-op when capture disabled', () => {
            const capturePath = join(tempHome, 'cursor-ndjson-capture', 'noop.ndjsonl');
            appendRedactedNdjsonLine(capturePath, '{"type":"assistant"}');
            expect(existsSync(capturePath)).toBe(false);
        });

        it('creates parent dir and appends newline-terminated line when enabled', () => {
            vi.stubEnv('HAPI_CURSOR_NDJSON_CAPTURE', '1');
            const capturePath = join(tempHome, 'cursor-ndjson-capture', 'session.ndjsonl');
            appendRedactedNdjsonLine(capturePath, '{"token":"Bearer secret"}');
            expect(existsSync(capturePath)).toBe(true);
            const content = readFileSync(capturePath, 'utf8');
            expect(content.endsWith('\n')).toBe(true);
            expect(content).not.toContain('secret');
            expect(content).toContain('[REDACTED_TOKEN]');
        });
    });

    describe('getCapturePathForSession', () => {
        it('places files under cursor-ndjson-capture with session key prefix', () => {
            vi.stubEnv('HAPI_CURSOR_NDJSON_CAPTURE', '1');
            const capturePath = getCapturePathForSession('sess-abc');
            expect(capturePath).toContain(join(tempHome, 'cursor-ndjson-capture'));
            expect(capturePath).toMatch(/sess-abc-.*\.ndjsonl$/);
            expect(existsSync(join(tempHome, 'cursor-ndjson-capture'))).toBe(true);
        });
    });
});
