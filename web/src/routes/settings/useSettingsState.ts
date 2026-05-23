import { useEffect, useRef, useState, type RefObject } from 'react'

export interface DropdownSlot {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    containerRef: RefObject<HTMLDivElement | null>
}

export interface SettingsState {
    language: DropdownSlot
    appearance: DropdownSlot
    fontScale: DropdownSlot
    terminalFontSize: DropdownSlot
    composerEnter: DropdownSlot
    terminalToolDisplay: DropdownSlot
}

function useDropdownSlot(): DropdownSlot & { _state: boolean } {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement | null>(null)
    return { isOpen, setIsOpen, containerRef, _state: isOpen }
}

/**
 * Consolidates the 6 dropdown-open flags + container refs that the settings
 * route needs, plus the cross-cutting outside-click and Escape-key handlers
 * that close every dropdown. Returns a stable shape so each section gets only
 * the slot it consumes and the orchestrator stays a thin composition layer.
 */
export function useSettingsState(): SettingsState {
    const language = useDropdownSlot()
    const appearance = useDropdownSlot()
    const fontScale = useDropdownSlot()
    const terminalFontSize = useDropdownSlot()
    const composerEnter = useDropdownSlot()
    const terminalToolDisplay = useDropdownSlot()

    const slots = [language, appearance, fontScale, terminalFontSize, composerEnter, terminalToolDisplay]
    const anyOpen = slots.some((slot) => slot.isOpen)

    useEffect(() => {
        if (!anyOpen) return

        const handleClickOutside = (event: MouseEvent) => {
            for (const slot of slots) {
                if (slot.isOpen && slot.containerRef.current && !slot.containerRef.current.contains(event.target as Node)) {
                    slot.setIsOpen(false)
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- slot refs/setters are stable; anyOpen gates the listener
    }, [anyOpen])

    useEffect(() => {
        if (!anyOpen) return

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                for (const slot of slots) slot.setIsOpen(false)
            }
        }

        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [anyOpen])

    return { language, appearance, fontScale, terminalFontSize, composerEnter, terminalToolDisplay }
}
