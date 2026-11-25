import { useMemo } from "react"

import { LAST_YEAR } from "./constants.js"
import { DEFAULT_VIEW_STATE, ViewState, clampYear } from "./viewState.js"
import type { AiTrainingComputeConfig } from "../index.js"

/** The `labeledModels` config as a list, most important first */
export function useLabeledModels(config: AiTrainingComputeConfig): string[] {
    return useMemo(
        () =>
            config.labeledModels
                .split(",")
                .map((name) => name.trim())
                .filter(Boolean),
        [config.labeledModels]
    )
}

/** The default view, over the time range the config asks for */
export function initialViewFromConfig(
    config: AiTrainingComputeConfig
): ViewState {
    return {
        ...DEFAULT_VIEW_STATE,
        timeRange: [
            clampYear(config.startYear),
            clampYear(config.endYear ?? LAST_YEAR),
        ],
    }
}
