import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    OneToMany,
    Relation,
} from "typeorm"
import { Chart } from "./Chart.js"
import { Dataset } from "./Dataset.js"
import { ChartRevision } from "./ChartRevision.js"
import { BCryptHasher } from "../hashers.js"

@Entity("users")
export class User extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column({ unique: true }) email!: string
    @Column({ length: 128 }) password!: string
    @Column({ default: "" }) fullName!: string
    @Column({ default: true }) isActive!: boolean
    @Column({ default: false }) isSuperuser!: boolean
    @Column() createdAt!: Date
    @Column() updatedAt!: Date
    @Column() lastLogin!: Date
    @Column() lastSeen!: Date

    @OneToMany(() => Chart, (chart) => chart.lastEditedByUser)
    lastEditedCharts!: Relation<Chart[]>

    @OneToMany(() => Chart, (chart) => chart.publishedByUser)
    publishedCharts!: Relation<Chart[]>

    @OneToMany(() => ChartRevision, (rev) => rev.user)
    editedCharts!: Relation<ChartRevision[]>

    @OneToMany(() => Dataset, (dataset) => dataset.createdByUser)
    createdDatasets!: Relation<Dataset[]>

    async setPassword(password: string): Promise<void> {
        const h = new BCryptHasher()
        this.password = await h.encode(password)
    }
}
