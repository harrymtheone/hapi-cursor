// Thin re-export facade — sole external entry point for the message-window store.
// All implementation lives in the colocated messageWindow* sub-modules; the
// public API surface is preserved verbatim so callers never need to change imports.

export type { MessageWindowState } from './messageWindowState'
export {
    VISIBLE_WINDOW_SIZE,
    PENDING_WINDOW_SIZE,
    getMessageWindowState,
    setAtBottom,
} from './messageWindowState'
export {
    fetchLatestMessages,
    fetchOlderMessages,
} from './messageWindowPaginationService'
export {
    ingestIncomingMessages,
    appendOptimisticMessage,
    updateMessageStatus,
    removeOptimisticMessage,
    markMessagesConsumed,
    flushPendingMessages,
} from './messageWindowMergeService'
export {
    subscribeMessageWindow,
    clearMessageWindow,
    seedMessageWindowFromSession,
} from './messageWindowSubscriptions'
