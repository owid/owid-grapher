import { JsonString } from "../domainTypes/Various.js"
import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"
import { parseChartConfig, serializeChartConfig } from "./Charts.js"

export interface SuggestedChartRevisionsExperimental {
    gpt: {
        model: string
        suggestions: {
            title: string
            subtitle: string
        }[]
    }
}

export const SuggestedChartRevisionsTableName = "suggested_chart_revisions"
export interface DbInsertSuggestedChartRevision {
    changesInDataSummary?: string | null
    chartId: number
    createdAt?: Date
    createdBy: number
    decisionReason?: string | null
    experimental?: JsonString | null
    id?: string
    isPendingOrFlagged?: number | null
    originalConfig: JsonString
    originalVersion: number
    status: string
    suggestedConfig: JsonString
    suggestedReason?: string | null
    suggestedVersion: number
    updatedAt?: Date | null
    updatedBy?: number | null
}
export type DbRawSuggestedChartRevision =
    Required<DbInsertSuggestedChartRevision>

export type DbEnrichedSuggestedChartRevision = Omit<
    DbRawSuggestedChartRevision,
    "originalConfig" | "suggestedConfig" | "experimental"
> & {
    originalConfig: GrapherInterface
    suggestedConfig: GrapherInterface
    experimental: SuggestedChartRevisionsExperimental | null
}

export function parseSuggestedChartRevisionsExperimental(
    experimental: JsonString | null
): SuggestedChartRevisionsExperimental | null {
    return experimental ? JSON.parse(experimental) : null
}

export function serializeSuggestedChartRevisionsExperimental(
    experimental: SuggestedChartRevisionsExperimental | null
): JsonString | null {
    return experimental ? JSON.stringify(experimental) : null
}

export function parseSuggestedChartRevisionsRow(
    row: DbRawSuggestedChartRevision
): DbEnrichedSuggestedChartRevision {
    return {
        ...row,
        originalConfig: parseChartConfig(row.originalConfig),
        suggestedConfig: parseChartConfig(row.suggestedConfig),
        experimental: parseSuggestedChartRevisionsExperimental(
            row.experimental
        ),
    }
}

export function serializeSuggestedChartRevisionsRow(
    row: DbEnrichedSuggestedChartRevision
): DbRawSuggestedChartRevision {
    return {
        ...row,
        originalConfig: serializeChartConfig(row.originalConfig),
        suggestedConfig: serializeChartConfig(row.suggestedConfig),
        experimental: serializeSuggestedChartRevisionsExperimental(
            row.experimental
        ),
    }
}
