import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    Relation,
} from "typeorm"
import { Chart } from "./Chart.js"
import { User } from "./User.js"

@Entity("chart_revisions")
export class ChartRevision extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() chartId!: number
    @Column({ type: "json" }) config: any
    @Column() userId!: number

    @Column() createdAt!: Date
    @Column() updatedAt!: Date

    @ManyToOne(() => User, (user) => user.editedCharts)
    user!: Relation<User>

    @ManyToOne(() => Chart, (chart) => chart.logs)
    chart!: Relation<Chart>
}
