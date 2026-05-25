import { memo, ReactNode } from 'react'

interface FloatingOverlayProps {
    children: ReactNode
    maxHeight?: number
    className?: string
}

/**
 * A floating panel container with shadow and rounded corners
 * Used for autocomplete suggestions and settings panels
 */
export const FloatingOverlay = memo(function FloatingOverlay(props: FloatingOverlayProps) {
    const { children, maxHeight = 240, className = '' } = props

    return (
        <div
            className={`overflow-hidden rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] shadow-md ${className}`.trim()}
            style={{ maxHeight }}
        >
            <div className="overflow-y-auto" style={{ maxHeight }}>
                {children}
            </div>
        </div>
    )
})
