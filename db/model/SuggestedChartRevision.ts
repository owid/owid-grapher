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

    suggestedConfig: any
    existingConfig: any

    static isValidStatus(status: string): boolean {
        return Object.values(SuggestedChartRevisionStatus).includes(status)
    }
}
