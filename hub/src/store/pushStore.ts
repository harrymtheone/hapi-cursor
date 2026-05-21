import type { Database } from 'bun:sqlite'

import type { StoredPushSubscription } from './types'
import {
    getPushSubscriptions,
    removePushSubscriptionByEndpoint,
    upsertPushSubscription
} from './pushSubscriptions'

export class PushStore {
    private readonly db: Database

    constructor(db: Database) {
        this.db = db
    }

    upsertPushSubscription(subscription: { endpoint: string; p256dh: string; auth: string }): void {
        upsertPushSubscription(this.db, subscription)
    }

    removePushSubscription(endpoint: string): void
    removePushSubscription(endpoint: string): void {
        removePushSubscriptionByEndpoint(this.db, endpoint)
    }

    getPushSubscriptions(): StoredPushSubscription[] {
        return getPushSubscriptions(this.db)
    }
}
