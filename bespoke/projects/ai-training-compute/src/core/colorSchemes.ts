import { GRAY_50 } from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { AiModel, ColorBy } from "./constants.js"

interface ColorScheme {
    /** Label in the "Color by" dropdown */
    label: string
    /** Groups in legend order, with the colors the multidim uses */
    groups: { name: string; color: string }[]
    groupOf: (model: AiModel) => string | undefined
}

export const COLOR_SCHEMES: Record<ColorBy, ColorScheme> = {
    reporting: {
        label: "Reported or estimated",
        groups: [
            { name: "Reported by the developer", color: "#4C6A9C" },
            { name: "Estimated by Epoch AI", color: "#996D36" },
        ],
        groupOf: (model) => model.reporting,
    },
    developer: {
        label: "Developer",
        groups: [
            { name: "OpenAI", color: "#10A37F" },
            { name: "Google", color: "#4285F4" },
            { name: "Meta", color: "#8E44AD" },
            { name: "Anthropic", color: "#D97757" },
            { name: "xAI", color: "#1F1F1F" },
            { name: "Other", color: "#b9bdc4" },
        ],
        groupOf: (model) => model.developer,
    },
}

export function getColor(colorBy: ColorBy, model: AiModel): string {
    const group = COLOR_SCHEMES[colorBy].groupOf(model)
    return (
        COLOR_SCHEMES[colorBy].groups.find((g) => g.name === group)?.color ??
        GRAY_50
    )
}
