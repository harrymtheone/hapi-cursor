import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n-context'
import { groupModelsIntoFamilies } from '@/lib/cursorModelFamilies'
import { RESEARCH_MODEL_FIXTURES } from '@/lib/cursorModelFamilies.test'
import { ModelPickerOverlay } from './ModelPickerOverlay'

const families = groupModelsIntoFamilies(
    RESEARCH_MODEL_FIXTURES.filter((model) => model.id !== 'auto')
)

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => vi.fn(),
}))

function renderOverlay(props: Partial<Parameters<typeof ModelPickerOverlay>[0]> = {}) {
    return render(
        <I18nProvider>
            <ModelPickerOverlay
                families={families}
                currentModelId={null}
                onModelChange={vi.fn()}
                controlsDisabled={false}
                t={(key) => key}
                {...props}
            />
        </I18nProvider>
    )
}

describe('ModelPickerOverlay', () => {
    afterEach(() => cleanup())

    it('lists Auto and discovered families', () => {
        renderOverlay()
        expect(screen.getByText('composer.modelPicker.auto')).toBeInTheDocument()
        expect(screen.getByText('Composer 2')).toBeInTheDocument()
        expect(screen.getByText('Opus 4.7')).toBeInTheDocument()
    })

    it('calls onModelChange with composed raw id from options apply', () => {
        const onModelChange = vi.fn()
        renderOverlay({ onModelChange })

        const codexRow = screen.getByText('Codex 5.3').parentElement?.parentElement
        expect(codexRow).toBeTruthy()
        fireEvent.click(
            Array.from(codexRow!.querySelectorAll('button')).find((button) =>
                button.textContent?.includes('composer.modelPicker.edit')
            )!
        )
        fireEvent.click(screen.getByRole('button', { name: 'composer.modelPicker.effort.high' }))
        const fastCheckbox = screen.getByText('composer.modelPicker.option.fast').closest('label')?.querySelector('input')
        expect(fastCheckbox).toBeTruthy()
        fireEvent.click(fastCheckbox!)
        fireEvent.click(screen.getByRole('button', { name: 'composer.modelPicker.apply' }))

        expect(onModelChange).toHaveBeenCalledWith('gpt-5.3-codex-high-fast')
    })

    it('shows manage visible models navigation control', () => {
        renderOverlay()
        expect(screen.getByText('composer.modelPicker.manageVisible')).toBeInTheDocument()
    })
})
