/**
 * Library exports for slopus package
 *
 * This file provides the main API classes and types for external consumption
 * without the CLI-specific functionality.
 *
 * Plan 10-03: the `configuration` singleton was deleted; consumers must now
 * call `loadConfig()` and thread the frozen `Config` through DI.
 */

// These exports allow me to use this package a library in dev-environment cli helper programs
export { ApiClient } from '@/api/api'
export { ApiSessionClient } from '@/api/apiSession'

export { logger, initializeLogger } from '@/ui/logger'
export { loadConfig, type Config } from '@/configuration'

export { RawJSONLinesSchema, type RawJSONLines } from '@/agent/agentLogSchema'
