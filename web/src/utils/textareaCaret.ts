// Mirror-div caret coordinate measurement for <textarea>.
// Adapted from textarea-caret-position (MIT, Jonathan Ong).
// Returns caret coordinates relative to the textarea's border-box.

const MIRROR_PROPERTIES = [
    'direction',
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderStyle',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing',
    'tabSize',
] as const

export interface CaretCoordinates {
    left: number
    top: number
    height: number
}

export function getTextareaCaretCoordinates(
    element: HTMLTextAreaElement,
    position: number,
): CaretCoordinates {
    const doc = element.ownerDocument
    const win = doc.defaultView ?? window
    const div = doc.createElement('div')
    div.setAttribute('aria-hidden', 'true')
    doc.body.appendChild(div)

    const style = div.style
    const computed = win.getComputedStyle(element)
    style.whiteSpace = 'pre-wrap'
    style.wordWrap = 'break-word'
    style.position = 'absolute'
    style.visibility = 'hidden'
    style.top = '0'
    style.left = '-9999px'

    for (const prop of MIRROR_PROPERTIES) {
        ;(style as unknown as Record<string, string>)[prop] = (
            computed as unknown as Record<string, string>
        )[prop]
    }

    div.textContent = element.value.substring(0, position)
    const span = doc.createElement('span')
    span.textContent = element.value.substring(position) || '.'
    div.appendChild(span)

    const coords: CaretCoordinates = {
        top: span.offsetTop + parseInt(computed.borderTopWidth || '0', 10),
        left: span.offsetLeft + parseInt(computed.borderLeftWidth || '0', 10),
        height: parseInt(computed.lineHeight || '0', 10) || element.clientHeight,
    }

    doc.body.removeChild(div)
    return coords
}
