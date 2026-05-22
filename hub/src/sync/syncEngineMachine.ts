/**
 * Machine-domain sub-facade of SyncEngine.
 */
import type { Machine, MachineCache } from './machineCache'

export class SyncEngineMachine {
    constructor(private readonly machineCache: MachineCache) {}

    handleMachineAlive(payload: { machineId: string; time: number }): void {
        this.machineCache.handleMachineAlive(payload)
    }

    getMachines(): Machine[] {
        return this.machineCache.getMachines()
    }

    getMachine(machineId: string): Machine | undefined {
        return this.machineCache.getMachine(machineId)
    }

    getOnlineMachines(): Machine[] {
        return this.machineCache.getOnlineMachines()
    }

    getOrCreateMachine(id: string, metadata: unknown, runnerState: unknown): Machine {
        return this.machineCache.getOrCreateMachine(id, metadata, runnerState)
    }
}
