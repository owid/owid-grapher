import {
    BaseEntity,
    Column,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn
} from "typeorm"
import { BCryptHasher } from "../../utils/hashers"
import { Chart } from "./Chart"
import { ChartRevision } from "./ChartRevision"
import { Dataset } from "./Dataset"

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

    @OneToMany(
        type => Chart,
        chart => chart.lastEditedByUser
    )
    lastEditedCharts!: Chart[]

    @OneToMany(
        type => Chart,
        chart => chart.publishedByUser
    )
    publishedCharts!: Chart[]

    @OneToMany(
        type => ChartRevision,
        rev => rev.user
    )
    editedCharts!: ChartRevision[]

    @OneToMany(
        type => Dataset,
        dataset => dataset.createdByUser
    )
    createdDatasets!: Dataset[]

    async setPassword(password: string) {
        const h = new BCryptHasher()
        this.password = await h.encode(password)
    }
}
