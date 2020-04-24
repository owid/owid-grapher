import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    OneToMany
} from "typeorm"
import { Chart } from "./Chart"
import { Dataset } from "./Dataset"
import { ChartRevision } from "./ChartRevision"
import { BCryptHasher } from "../../utils/hashers"

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
        () => Chart,
        chart => chart.lastEditedByUser
    )
    lastEditedCharts!: Chart[]

    @OneToMany(
        () => Chart,
        chart => chart.publishedByUser
    )
    publishedCharts!: Chart[]

    @OneToMany(
        () => ChartRevision,
        rev => rev.user
    )
    editedCharts!: ChartRevision[]

    @OneToMany(
        () => Dataset,
        dataset => dataset.createdByUser
    )
    createdDatasets!: Dataset[]

    async setPassword(password: string) {
        const h = new BCryptHasher()
        this.password = await h.encode(password)
    }
}
