/**
 * KeepaliveScheduler — central owner for recurring / delayed timers in hub/src/.
 *
 * All `setInterval` / `setTimeout` call sites inside hub/src/{sse,sync,socket,notifications}/
 * route through this scheduler so SIGINT/SIGTERM shutdown can deterministically cancel
 * every outstanding handle before subsystem stops.
 *
 * Exempt: the two short promise-sleep retries inside syncEngineSession.ts'
 * waitForSessionActive / waitForSessionInactive (whitelisted by ripgrep guard in Plan 08-04).
 */

export type SchedulerHandle = {
    readonly name: string
    cancel(): void
}

type InternalHandle = SchedulerHandle & {
    _kind: 'interval' | 'timeout'
}

export class KeepaliveScheduler {
    private readonly handles: Set<InternalHandle> = new Set()
    private readonly seenNames: Set<string> = new Set()
    private isShutdown = false

    /**
     * Register a recurring timer. Returns a handle whose `cancel()` clears the interval
     * and removes it from the active set.
     */
    everyMs(name: string, ms: number, fn: () => void): SchedulerHandle {
        this.warnOnDuplicate(name)

        let timer: ReturnType<typeof setInterval> | null = setInterval(() => {
            if (timer === null) {
                return
            }
            fn()
        }, ms)

        const handle: InternalHandle = {
            name,
            _kind: 'interval',
            cancel: () => {
                if (timer !== null) {
                    clearInterval(timer)
                    timer = null
                }
                this.handles.delete(handle)
            }
        }
        this.handles.add(handle)
        return handle
    }

    /**
     * Register a one-shot timer. The callback removes the handle from the active set
     * before firing so `activeCount` reflects truth. `cancel()` before firing prevents
     * the callback entirely.
     */
    afterMs(name: string, ms: number, fn: () => void): SchedulerHandle {
        this.warnOnDuplicate(name)

        let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
            if (timer === null) {
                return
            }
            timer = null
            this.handles.delete(handle)
            fn()
        }, ms)

        const handle: InternalHandle = {
            name,
            _kind: 'timeout',
            cancel: () => {
                if (timer !== null) {
                    clearTimeout(timer)
                    timer = null
                }
                this.handles.delete(handle)
            }
        }
        this.handles.add(handle)
        return handle
    }

    /**
     * Cancel every outstanding handle. Idempotent — calling twice is safe.
     * After shutdown, registered callbacks MUST NOT fire.
     */
    shutdown(): void {
        if (this.isShutdown) {
            return
        }
        this.isShutdown = true
        const snapshot = Array.from(this.handles)
        for (const handle of snapshot) {
            handle.cancel()
        }
    }

    get activeCount(): number {
        return this.handles.size
    }

    private warnOnDuplicate(name: string): void {
        if (this.seenNames.has(name) && process.env.NODE_ENV !== 'production') {
            console.debug(`[KeepaliveScheduler] duplicate handle name registered: ${name}`)
        }
        this.seenNames.add(name)
    }
}
