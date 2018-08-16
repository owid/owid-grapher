import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany} from "typeorm"
import { Chart } from './Chart'
const hashers = require('node-django-hashers')

@Entity("users")
export default class User extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column({ unique: true }) name!: string
    @Column({ unique: true }) email!: string
    @Column({ name: 'password', length: 128 }) cryptedPassword!: string
    @Column({ name: 'full_name', default: "" }) fullName!: string
    @Column({ name: 'is_active', default: true }) isActive!: boolean
    @Column({ name: 'is_superuser', default: false }) isSuperuser!: boolean
    @Column() created_at!: Date
    @Column() updated_at!: Date

    @OneToMany(type => Chart, chart => chart.lastEditedByUser)
    lastEditedCharts!: Chart[]

    @OneToMany(type => Chart, chart => chart.publishedByUser)
    publishedCharts!: Chart[]

    async setPassword(password: string) {
        const h = new hashers.BCryptPasswordHasher()
        this.cryptedPassword = await h.encode(password)
    }
}