import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany} from "typeorm"
import { Chart } from './Chart'
import { Dataset } from './Dataset'
import { ChartLog } from "./ChartLog"
const hashers = require('node-django-hashers')

@Entity("users")
export default class User extends BaseEntity {
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

    @OneToMany(type => Chart, chart => chart.lastEditedByUser)
    lastEditedCharts!: Chart[]

    @OneToMany(type => Chart, chart => chart.publishedByUser)
    publishedCharts!: Chart[]

    @OneToMany(type => ChartLog, log => log.user)
    editedCharts!: ChartLog[]

    @OneToMany(type => Dataset, dataset => dataset.createdByUser)
    createdDatasets!: Dataset[]

    async setPassword(password: string) {
        const h = new hashers.BCryptPasswordHasher()
        this.password = await h.encode(password)
    }
}