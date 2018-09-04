import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany} from "typeorm"
import { Chart } from './Chart'
import { Dataset } from './Dataset'
const hashers = require('node-django-hashers')

@Entity("users")
export default class User extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column({ unique: true }) name!: string
    @Column({ unique: true }) email!: string
    @Column({ length: 128 }) password!: string
    @Column({ name: 'full_name', default: "" }) fullName!: string
    @Column({ name: 'is_active', default: true }) isActive!: boolean
    @Column({ name: 'is_superuser', default: false }) isSuperuser!: boolean
    @Column() createdAt!: Date
    @Column() updatedAt!: Date
    @Column({ name: 'last_login' }) lastLogin!: Date

    @OneToMany(type => Chart, chart => chart.lastEditedByUser)
    lastEditedCharts!: Chart[]

    @OneToMany(type => Chart, chart => chart.publishedByUser)
    publishedCharts!: Chart[]

    @OneToMany(type => Dataset, dataset => dataset.createdByUser)
    createdDatasets!: Dataset[]

    async setPassword(password: string) {
        const h = new hashers.BCryptPasswordHasher()
        this.password = await h.encode(password)
    }
}