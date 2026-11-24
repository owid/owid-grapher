import rawModels from "../data/notableAiModels.json"

import { AiModel, RawAiModel } from "./constants.js"
import { getModelGroups } from "./colorSchemes.js"

export function parseModel(raw: RawAiModel): AiModel {
    const date = new Date(`${raw.date}T00:00:00Z`)
    return {
        model: raw.model,
        organization: raw.organization ?? "Unknown organization",
        groups: getModelGroups(
            raw.organization,
            raw.organizationCategory,
            raw.domain
        ),
        date,
        year: toFractionalYear(date),
        trainingComputeFlop: raw.trainingComputeFlop,
        link: raw.link ?? undefined,
        domain: raw.domain ?? undefined,
        confidence: raw.confidence ?? undefined,
    }
}

export function toFractionalYear(date: Date): number {
    const year = date.getUTCFullYear()
    const start = Date.UTC(year, 0, 1)
    const end = Date.UTC(year + 1, 0, 1)
    return year + (date.getTime() - start) / (end - start)
}

export const AI_MODELS: AiModel[] = (rawModels as RawAiModel[]).map(parseModel)
