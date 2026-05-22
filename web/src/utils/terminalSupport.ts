import type { SessionSummaryMetadata } from '@/types/api'

export function isWindowsHostOs(os: string | null | undefined): boolean {
    return typeof os === 'string' && os.toLowerCase() === 'win32'
}

export function isRemoteTerminalSupported(_metadata: SessionSummaryMetadata | null | undefined): boolean {
    return true
}
