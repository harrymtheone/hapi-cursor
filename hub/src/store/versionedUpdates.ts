import type { Database } from 'bun:sqlite'

import type { VersionedUpdateResult } from './types'

type VersionedUpdateArgs<T> = {
    db: Database
    table: string
    id: string
    namespace?: string
    field: string
    versionField: string
    expectedVersion: number
    value: T
    encode: (value: T) => string | null
    decode: (value: string | null) => T
    setClauses?: string[]
    params?: Record<string, unknown>
}

export function updateVersionedField<T>(args: VersionedUpdateArgs<T>): VersionedUpdateResult<T> {
    try {
        const namespacePredicate = args.namespace === undefined ? '' : ' AND namespace = @namespace'
        const params: Record<string, string | number | bigint | boolean | Uint8Array | null> = {
            id: args.id,
            expectedVersion: args.expectedVersion,
            field_value: args.encode(args.value)
        }
        if (args.namespace !== undefined) {
            params.namespace = args.namespace
        }
        for (const [key, value] of Object.entries(args.params ?? {})) {
            if (
                typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'bigint' ||
                typeof value === 'boolean' ||
                value === null ||
                value instanceof Uint8Array
            ) {
                params[key] = value
            }
        }
        const setClauses = [
            `${args.field} = @field_value`,
            `${args.versionField} = ${args.versionField} + 1`,
            ...(args.setClauses ?? [])
        ]

        const result = args.db.prepare(
            `UPDATE ${args.table}
             SET ${setClauses.join(', ')}
             WHERE id = @id${namespacePredicate} AND ${args.versionField} = @expectedVersion`
        ).run(params)

        if (result.changes === 1) {
            return { result: 'success', version: args.expectedVersion + 1, value: args.value }
        }

        const current = args.db.prepare(
            `SELECT ${args.field} AS field_value, ${args.versionField} AS version
             FROM ${args.table}
             WHERE id = ?${args.namespace === undefined ? '' : ' AND namespace = ?'}`
        ).get(...(args.namespace === undefined ? [args.id] : [args.id, args.namespace])) as
            | { field_value: string | null; version: number }
            | undefined

        if (!current) {
            return { result: 'error' }
        }

        return {
            result: 'version-mismatch',
            version: current.version,
            value: args.decode(current.field_value)
        }
    } catch {
        return { result: 'error' }
    }
}
