import type { AttachmentMetadata } from '@/api/types'

/**
 * Formats attachments for the agent by converting them to @path references.
 * The agent understands the @path format for file references.
 */
export function formatAttachmentsForAgent(attachments: AttachmentMetadata[] | undefined): string {
    if (!attachments || attachments.length === 0) {
        return ''
    }
    return attachments.map(a => `@${a.path}`).join(' ')
}

/**
 * Combines text and formatted attachments into a single prompt string.
 * Attachments are formatted as @path references and prepended to the text.
 */
export function formatMessageWithAttachments(
    text: string,
    attachments: AttachmentMetadata[] | undefined
): string {
    const attachmentText = formatAttachmentsForAgent(attachments)
    if (!attachmentText) {
        return text
    }
    if (!text) {
        return attachmentText
    }
    return `${attachmentText}\n\n${text}`
}
