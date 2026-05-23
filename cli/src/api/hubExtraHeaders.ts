/**
 * Plan 10-03: `buildHubRequestHeaders` and `buildSocketIoExtraHeaderOptions`
 * take `extraHeaders` as a parameter instead of reading the configuration
 * singleton.
 */

export function buildHubRequestHeaders(
    extraHeaders: Readonly<Record<string, string>>,
    baseHeaders: Record<string, string>
): Record<string, string> {
    return {
        ...extraHeaders,
        ...baseHeaders
    }
}

export function buildSocketIoExtraHeaderOptions(
    extraHeaders: Readonly<Record<string, string>>
): {
    extraHeaders?: Record<string, string>
} {
    if (Object.keys(extraHeaders).length === 0) {
        return {}
    }

    return {
        extraHeaders: { ...extraHeaders }
    }
}
