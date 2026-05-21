import type { Database } from 'bun:sqlite'

import type { StoredMachine, VersionedUpdateResult } from './types'
import {
    getMachine,
    getMachineByNamespace,
    getMachines,
    getMachinesByNamespace,
    getOrCreateMachine,
    updateMachineRunnerState,
    updateMachineMetadata
} from './machines'

export class MachineStore {
    private readonly db: Database

    constructor(db: Database) {
        this.db = db
    }

    getOrCreateMachine(id: string, metadata: unknown, runnerState: unknown): StoredMachine
    getOrCreateMachine(id: string, metadata: unknown, runnerState: unknown, namespace: string): StoredMachine
    getOrCreateMachine(id: string, metadata: unknown, runnerState: unknown, namespace?: string): StoredMachine {
        if (namespace === undefined) {
            return getOrCreateMachine(this.db, id, metadata, runnerState)
        }
        return getOrCreateMachine(this.db, id, metadata, runnerState, namespace)
    }

    updateMachineMetadata(
        id: string,
        metadata: unknown,
        expectedVersion: number
    ): VersionedUpdateResult<unknown | null>
    updateMachineMetadata(
        id: string,
        metadata: unknown,
        expectedVersion: number,
        namespace: string
    ): VersionedUpdateResult<unknown | null>
    updateMachineMetadata(
        id: string,
        metadata: unknown,
        expectedVersion: number,
        namespace?: string
    ): VersionedUpdateResult<unknown | null> {
        if (namespace === undefined) {
            return updateMachineMetadata(this.db, id, metadata, expectedVersion)
        }
        return updateMachineMetadata(this.db, id, metadata, expectedVersion, namespace)
    }

    updateMachineRunnerState(
        id: string,
        runnerState: unknown,
        expectedVersion: number
    ): VersionedUpdateResult<unknown | null>
    updateMachineRunnerState(
        id: string,
        runnerState: unknown,
        expectedVersion: number,
        namespace: string
    ): VersionedUpdateResult<unknown | null>
    updateMachineRunnerState(
        id: string,
        runnerState: unknown,
        expectedVersion: number,
        namespace?: string
    ): VersionedUpdateResult<unknown | null> {
        if (namespace === undefined) {
            return updateMachineRunnerState(this.db, id, runnerState, expectedVersion)
        }
        return updateMachineRunnerState(this.db, id, runnerState, expectedVersion, namespace)
    }

    getMachine(id: string): StoredMachine | null {
        return getMachine(this.db, id)
    }

    getMachineByNamespace(id: string, namespace: string): StoredMachine | null {
        return getMachineByNamespace(this.db, id, namespace)
    }

    getMachines(): StoredMachine[] {
        return getMachines(this.db)
    }

    getMachinesByNamespace(namespace: string): StoredMachine[] {
        return getMachinesByNamespace(this.db, namespace)
    }
}
