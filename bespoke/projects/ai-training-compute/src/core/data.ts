import rawModels from "../data/aiModels.json"

import {
    AiModel,
    MAX_RANK_AT_RELEASE,
    ModelFilter,
    RawAiModel,
} from "./constants.js"
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
        rankAtRelease: raw.rankAtRelease,
    }
}

export function toFractionalYear(date: Date): number {
    const year = date.getUTCFullYear()
    const start = Date.UTC(year, 0, 1)
    const end = Date.UTC(year + 1, 0, 1)
    return year + (date.getTime() - start) / (end - start)
}

/** Every model that is notable or among the 7 largest at its release */
export const AI_MODELS: AiModel[] = (rawModels as RawAiModel[]).map(parseModel)

export const NOTABLE_MODELS = AI_MODELS.filter((m) => m.isNotable)

const MODELS_BY_RANK = new Map(
    Array.from({ length: MAX_RANK_AT_RELEASE }, (_, i) => [
        i + 1,
        AI_MODELS.filter((m) => m.rankAtRelease <= i + 1),
    ])
)

/**
 * The models a filter picks: Epoch's notable ones, or those among the N
 * largest by training compute when they came out (N clamped to 1–7)
 */
export function getModels(filter: ModelFilter): AiModel[] {
    if (filter === "notable") return NOTABLE_MODELS
    const rank = Math.min(MAX_RANK_AT_RELEASE, Math.max(1, Math.round(filter)))
    return MODELS_BY_RANK.get(rank) ?? []
}
