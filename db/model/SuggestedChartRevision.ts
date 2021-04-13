import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
} from "typeorm"
import { User } from "./User"

enum SuggestedChartRevisionStatus {
    pending,
    approved,
    rejected,
}

@Entity("suggested_chart_revisions")
export class SuggestedChartRevision extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() chartId!: number
    @Column({ type: "json" }) config: any
    @Column() userId!: number
    @Column({ default: "pending" }) status!: SuggestedChartRevisionStatus
    @Column({ default: "" }) createdReason!: string
    @Column({ default: "" }) decisionReason!: string

    @Column() createdAt!: Date
    @Column() updatedAt!: Date

    @ManyToOne(() => User, (user) => user.suggestedChartRevisions)
    user!: User

    suggestedConfig: any
    existingConfig: any

    static isValidStatus(status: string): boolean {
        return Object.values(SuggestedChartRevisionStatus).includes(status)
    }
}
