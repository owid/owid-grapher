import { GrapherInterface } from "../grapher/core/GrapherInterface.js"
import { SuggestedChartRevisionStatus } from "../clientUtils/owidTypes.js"

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

    canApprove?: boolean
    canReject?: boolean
    canFlag?: boolean
    canPending?: boolean
}
