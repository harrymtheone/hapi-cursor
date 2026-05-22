export type ModelOption = {
    value: string | null
    label: string
}

function normalizeCurrentModel(model?: string | null): string | null {
    const trimmedModel = model?.trim()
    if (!trimmedModel || trimmedModel === 'auto' || trimmedModel === 'default') {
        return null
    }

    return trimmedModel
}

function withCurrentModelOption(options: ModelOption[], currentModel?: string | null): ModelOption[] {
    const normalizedCurrentModel = normalizeCurrentModel(currentModel)
    if (!normalizedCurrentModel || options.some((option) => option.value === normalizedCurrentModel)) {
        return options
    }

    const nextOptions = [...options]
    const autoIndex = nextOptions.findIndex((option) => option.value === null)
    nextOptions.splice(autoIndex >= 0 ? autoIndex + 1 : 0, 0, {
        value: normalizedCurrentModel,
        label: normalizedCurrentModel
    })
    return nextOptions
}

export function getModelOptionsForFlavor(
    _flavor: string | undefined | null,
    currentModel?: string | null,
    customOptions?: ModelOption[]
): ModelOption[] {
    if (customOptions && customOptions.length > 0) {
        return withCurrentModelOption(customOptions, currentModel)
    }
    return []
}

export function getNextModelForFlavor(
    flavor: string | undefined | null,
    currentModel?: string | null,
    customOptions?: ModelOption[]
): string | null {
    const options = getModelOptionsForFlavor(flavor, currentModel, customOptions)
    if (options.length === 0) {
        return null
    }
    const currentIndex = options.findIndex((option) => option.value === (normalizeCurrentModel(currentModel) ?? null))
    if (currentIndex === -1) {
        return options.find((option) => option.value !== null)?.value ?? null
    }
    return options[(currentIndex + 1) % options.length]?.value ?? null
}
