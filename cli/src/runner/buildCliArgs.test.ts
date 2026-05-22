import { describe, it, expect } from 'vitest'
import { buildCliArgs } from './run'

describe('buildCliArgs', () => {
    it('adds --permission-mode for valid cursor permission mode', () => {
        const args = buildCliArgs('cursor', {
            directory: '/tmp',
            permissionMode: 'plan',
        })
        expect(args).toContain('--permission-mode')
        expect(args).toContain('plan')
        expect(args).not.toContain('--yolo')
    })

    it('ignores invalid permission mode and falls back to --yolo', () => {
        const args = buildCliArgs('cursor', {
            directory: '/tmp',
            permissionMode: 'not-a-real-mode',
        }, true)
        expect(args).not.toContain('--permission-mode')
        expect(args).toContain('--yolo')
    })

    it('ignores invalid permission mode without yolo fallback', () => {
        const args = buildCliArgs('cursor', {
            directory: '/tmp',
            permissionMode: 'not-a-real-mode',
        })
        expect(args).not.toContain('--permission-mode')
        expect(args).not.toContain('--yolo')
    })

    it('prefers --permission-mode over --yolo when both present', () => {
        const args = buildCliArgs('cursor', {
            directory: '/tmp',
            permissionMode: 'yolo',
        }, true)
        expect(args).toContain('--permission-mode')
        expect(args).toContain('yolo')
        const yoloIdx = args.indexOf('--yolo')
        expect(yoloIdx).toBe(-1)
    })

    it('adds --yolo when no permissionMode and yolo is true', () => {
        const args = buildCliArgs('cursor', {
            directory: '/tmp',
        }, true)
        expect(args).toContain('--yolo')
        expect(args).not.toContain('--permission-mode')
    })

    it('passes --model through for cursor', () => {
        const args = buildCliArgs('cursor', {
            directory: '/tmp',
            model: 'sonnet',
        })
        expect(args).toContain('--model')
        expect(args).toContain('sonnet')
    })

    it('emits every valid cursor permission mode', () => {
        for (const mode of ['default', 'plan', 'ask', 'yolo']) {
            const args = buildCliArgs('cursor', {
                directory: '/tmp',
                permissionMode: mode,
            })
            expect(args).toContain('--permission-mode')
            expect(args).toContain(mode)
        }
    })

    it('spawns the cursor agent binary as the leading positional arg', () => {
        const args = buildCliArgs('cursor', { directory: '/tmp' })
        expect(args[0]).toBe('cursor')
    })
})
