import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionListSearch } from './SessionListSearch'

afterEach(() => cleanup())

describe('SessionListSearch', () => {
    it('fires onChange with the typed value', () => {
        const onChange = vi.fn()
        render(
            <I18nProvider>
                <SessionListSearch value="" onChange={onChange} />
            </I18nProvider>
        )
        const input = screen.getByRole('searchbox')
        fireEvent.change(input, { target: { value: 'hello' } })
        expect(onChange).toHaveBeenCalledWith('hello')
    })

    it('renders the clear button only when a value is present and clears on click', () => {
        const onChange = vi.fn()
        const { rerender } = render(
            <I18nProvider>
                <SessionListSearch value="" onChange={onChange} />
            </I18nProvider>
        )
        // No clear button when empty (only the search icon, which is in a non-button div)
        const buttons = screen.queryAllByRole('button')
        expect(buttons).toHaveLength(0)

        rerender(
            <I18nProvider>
                <SessionListSearch value="abc" onChange={onChange} />
            </I18nProvider>
        )
        const clearBtn = screen.getByRole('button')
        fireEvent.click(clearBtn)
        expect(onChange).toHaveBeenLastCalledWith('')
    })
})
