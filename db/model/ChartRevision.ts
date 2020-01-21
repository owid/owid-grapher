import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne
} from "typeorm"
import { Chart } from "./Chart"
import { User } from "./User"

@Entity("chart_revisions")
export class ChartRevision extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() chartId!: number
    @Column({ type: "json" }) config: any
    @Column() userId!: number

    @Column() createdAt!: Date
    @Column() updatedAt!: Date

    @ManyToOne(
        type => User,
        user => user.editedCharts
    )
    user!: User

    @ManyToOne(
        type => Chart,
        chart => chart.logs
    )
    chart!: Chart
}
