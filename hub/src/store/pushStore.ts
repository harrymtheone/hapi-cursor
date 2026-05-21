import type { Database } from 'bun:sqlite'

import type { StoredPushSubscription } from './types'
import {
    addPushSubscription,
    getPushSubscriptions,
    getPushSubscriptionsByNamespace,
    removePushSubscription,
    removePushSubscriptionByEndpoint,
    upsertPushSubscription
} from './pushSubscriptions'

export class PushStore {
    private readonly db: Database

    constructor(db: Database) {
        this.db = db
    }

    addPushSubscription(namespace: string, subscription: { endpoint: string; p256dh: string; auth: string }): void {
        addPushSubscription(this.db, namespace, subscription)
    }

    upsertPushSubscription(subscription: { endpoint: string; p256dh: string; auth: string }): void {
        upsertPushSubscription(this.db, subscription)
    }

    removePushSubscription(endpoint: string): void
    removePushSubscription(namespace: string, endpoint: string): void
    removePushSubscription(namespaceOrEndpoint: string, endpoint?: string): void {
        if (endpoint === undefined) {
            removePushSubscriptionByEndpoint(this.db, namespaceOrEndpoint)
            return
        }
        removePushSubscription(this.db, namespaceOrEndpoint, endpoint)
    }

    getPushSubscriptions(): StoredPushSubscription[] {
        return getPushSubscriptions(this.db)
    }

    getPushSubscriptionsByNamespace(namespace: string): StoredPushSubscription[] {
        return getPushSubscriptionsByNamespace(this.db, namespace)
    }
}
