import rawModels from "../data/aiModels.json"

import { AiModel, ModelSet, RawAiModel } from "./constants.js"
import { getModelGroups } from "./colorSchemes.js"

export function parseModel(raw: RawAiModel): AiModel {
    const date = new Date(`${raw.date}T00:00:00Z`)
    return {
        model: raw.model,
        organization: raw.organization ?? "Unknown organization",
        groups: getModelGroups(raw),
        date,
        year: toFractionalYear(date),
        trainingComputeFlop: raw.trainingComputeFlop,
        computeEstimationMethod: raw.computeEstimationMethod ?? undefined,
        link: raw.link ?? undefined,
        domain: raw.domain ?? undefined,
        confidence: raw.confidence ?? undefined,
        isNotable: raw.isNotable,
        isFrontier: raw.isFrontier,
    }
}

export function toFractionalYear(date: Date): number {
    const year = date.getUTCFullYear()
    const start = Date.UTC(year, 0, 1)
    const end = Date.UTC(year + 1, 0, 1)
    return year + (date.getTime() - start) / (end - start)
}

/** Every model in either of Epoch's sets */
export const AI_MODELS: AiModel[] = (rawModels as RawAiModel[]).map(parseModel)

export function getModelsInSet(set: ModelSet): AiModel[] {
    return set === "frontier" ? FRONTIER_MODELS : NOTABLE_MODELS
}

export const NOTABLE_MODELS = AI_MODELS.filter((m) => m.isNotable)
export const FRONTIER_MODELS = AI_MODELS.filter((m) => m.isFrontier)
