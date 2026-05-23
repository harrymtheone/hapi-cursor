import { describe, expect, it } from 'bun:test'
import { classifySessionActivity } from './sessionActivity'

describe('classifySessionActivity', () => {
    it('classifies role-wrapped agent ready events as turn completion activity', () => {
        const activity = classifySessionActivity({
            role: 'agent',
            content: {
                type: 'event',
                data: { type: 'ready' }
            }
        })

        expect(activity).toEqual({ kind: 'turn-completed' })
    })

    it('does not classify arbitrary event strings as turn completion activity', () => {
        const activity = classifySessionActivity({
            role: 'agent',
            content: 'ready'
        })

        expect(activity).toBeNull()
    })
})
