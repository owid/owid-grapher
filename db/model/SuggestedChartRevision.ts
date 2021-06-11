import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm"

export enum SuggestedChartRevisionStatus {
    pending = "pending",
    approved = "approved",
    rejected = "rejected",
    flagged = "flagged",
}

@Entity("suggested_chart_revisions")
export class SuggestedChartRevision extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() chartId!: number
    @Column({ type: "json" }) suggestedConfig: any
    @Column({ type: "json" }) originalConfig: any
    @Column() createdBy!: number
    @Column() updatedBy!: number

    @Column({ type: "enum", default: SuggestedChartRevisionStatus.pending })
    status!: SuggestedChartRevisionStatus

    @Column({ default: "" }) suggestedReason!: string
    @Column({ default: "" }) decisionReason!: string
    @Column() createdAt!: Date
    @Column() updatedAt!: Date

    existingConfig?: any

    canApprove?: boolean
    canReject?: boolean
    canFlag?: boolean
    canPending?: boolean

    static isValidStatus(status: SuggestedChartRevisionStatus): boolean {
        return Object.values(SuggestedChartRevisionStatus).includes(status)
    }

    static checkCanApprove(
        suggestedChartRevision: SuggestedChartRevision
    ): boolean {
        // note: a suggestion can be approved if status == "rejected" |
        // "flagged" | "pending" AND the original config version equals
        // the existing config version (i.e. the existing chart has not
        // been changed since the suggestion was created).
        const status = suggestedChartRevision.status
        const originalVersion = suggestedChartRevision.originalConfig?.version
        const existingVersion = suggestedChartRevision.existingConfig?.version
        const originalVersionExists =
            originalVersion !== null && originalVersion !== undefined
        const existingVersionExists =
            existingVersion !== null && existingVersion !== undefined
        if (
            [
                SuggestedChartRevisionStatus.rejected,
                SuggestedChartRevisionStatus.flagged,
                SuggestedChartRevisionStatus.pending,
            ].indexOf(status) !== -1 &&
            originalVersionExists &&
            existingVersionExists &&
            originalVersion === existingVersion
        ) {
            return true
        }
        return false
    }

    static checkCanReject(
        suggestedChartRevision: SuggestedChartRevision
    ): boolean {
        // note: a suggestion can be rejected if: (1) status ==
        // "pending" | "flagged"; or (2) status == "approved" and the
        // suggested config version equals the existing chart version
        // (i.e. the existing chart has not changed since the suggestion
        // was approved).
        const status = suggestedChartRevision.status
        const suggestedVersion = suggestedChartRevision.suggestedConfig?.version
        const existingVersion = suggestedChartRevision.existingConfig?.version
        const suggestedVersionExists =
            suggestedVersion !== null && suggestedVersion !== undefined
        const existingVersionExists =
            existingVersion !== null && existingVersion !== undefined
        if (
            [
                SuggestedChartRevisionStatus.flagged,
                SuggestedChartRevisionStatus.pending,
            ].indexOf(status) !== -1
        ) {
            return true
        }
        if (
            status === "approved" &&
            suggestedVersionExists &&
            existingVersionExists &&
            suggestedVersion === existingVersion
        ) {
            return true
        }
        return false
    }

    static checkCanFlag(
        suggestedChartRevision: SuggestedChartRevision
    ): boolean {
        // note: a suggestion can be flagged if status == "pending" or
        // if it is already flagged. Flagging a suggestion that is
        // already flagged is a hack for updating the decisionReason
        // column in the SuggestedChartRevisionApproverPage UI without
        // changing the status column.
        const status = suggestedChartRevision.status
        if (
            [
                SuggestedChartRevisionStatus.flagged,
                SuggestedChartRevisionStatus.pending,
            ].indexOf(status) !== -1
        ) {
            return true
        }
        return false
    }

    static checkCanPending(
        suggestedChartRevision: SuggestedChartRevision
    ): boolean {
        // note: a suggestion cannot be altered to pending from another status
        return false
    }
}
