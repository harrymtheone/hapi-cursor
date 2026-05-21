export type VisibilityState = 'visible' | 'hidden'

export class VisibilityTracker {
    private readonly trackedConnections = new Set<string>()
    private readonly visibleConnections = new Set<string>()

    registerConnection(subscriptionId: string, state: VisibilityState): void {
        this.removeConnection(subscriptionId)
        this.trackedConnections.add(subscriptionId)
        if (state === 'visible') {
            this.visibleConnections.add(subscriptionId)
        }
    }

    setVisibility(subscriptionId: string, state: VisibilityState): boolean {
        if (!this.trackedConnections.has(subscriptionId)) {
            return false
        }

        if (state === 'visible') {
            this.visibleConnections.add(subscriptionId)
            return true
        }

        this.visibleConnections.delete(subscriptionId)
        return true
    }

    removeConnection(subscriptionId: string): void {
        this.trackedConnections.delete(subscriptionId)
        this.visibleConnections.delete(subscriptionId)
    }

    hasVisibleConnection(): boolean {
        return this.visibleConnections.size > 0
    }

    isVisibleConnection(subscriptionId: string): boolean {
        return this.visibleConnections.has(subscriptionId)
    }
}
