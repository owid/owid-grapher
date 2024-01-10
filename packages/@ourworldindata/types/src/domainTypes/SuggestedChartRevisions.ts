import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"

export enum SuggestedChartRevisionStatus {
    pending = "pending",
    approved = "approved",
    rejected = "rejected",
    flagged = "flagged",
}

export interface SuggestedChartRevisionsExperimental {
    gpt?: {
        model?: string
        suggestions?: {
            title?: string
            subtitle?: string
        }[]
    }
}

export interface SuggestedChartRevision {
    canApprove?: boolean
    canFlag?: boolean
    canPending?: boolean
    canReject?: boolean
    changesInDataSummary?: string | null
    chartCreatedAt: Date
    chartId: number
    chartUpdatedAt?: Date | null
    createdAt?: Date
    createdBy: number
    createdByFullName: string | null
    decisionReason?: string | null
    existingConfig: GrapherInterface
    experimental?: SuggestedChartRevisionsExperimental | null
    id?: number
    isPendingOrFlagged?: number | null
    originalConfig: GrapherInterface
    status: SuggestedChartRevisionStatus
    suggestedConfig: GrapherInterface
    suggestedReason?: string | null
    suggestedVersion: number
    updatedAt?: Date | null
    updatedBy?: number | null
    updatedByFullName?: string | null
}
