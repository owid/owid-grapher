import { GrapherInterface } from "@ourworldindata/types"
import { SuggestedChartRevisionStatus } from "@ourworldindata/utils"

export interface SuggestedChartRevisionSerialized {
    id: number
    chartId: number

    createdAt: string
    updatedAt?: string

    chartCreatedAt: string
    chartUpdatedAt?: string

    createdById: number
    updatedById?: number

    createdByFullName: string
    updatedByFullName?: string

    originalConfig: GrapherInterface
    suggestedConfig: GrapherInterface
    existingConfig: GrapherInterface

    status: SuggestedChartRevisionStatus
    suggestedReason?: string
    decisionReason?: string
    changesInDataSummary?: string

    canApprove?: boolean
    canReject?: boolean
    canFlag?: boolean
    canPending?: boolean

    experimental?: SuggestedChartRevisionExperimentalSerialized
}

export interface SuggestedChartRevisionExperimentalSerialized {
    gpt?: {
        model?: string
        suggestions?: GPTSuggestionsSerialized[]
    }
    [key: string]: any
}

export interface GPTSuggestionsSerialized {
    title?: string
    subtitle?: string
}
