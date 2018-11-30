import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne, JoinColumn} from "typeorm"

import * as db from '../db'
import { Chart } from './Chart'
import User from './User'

@Entity("chart_logs")
export class ChartLog extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() chartId!: number
    @Column({ type: 'json' }) config: any
    @Column() userId!: number

    @Column() createdAt!: Date
    @Column() updatedAt!: Date

    @ManyToOne(type => User, user => user.editedCharts)
    user!: User

    @ManyToOne(type => Chart, chart => chart.logs)
    chart!: Chart

}

export function createChartLog(chartId: number|undefined, userId: number, config: any) {
    if (chartId === undefined) return

    const log = new ChartLog()
    log.chartId = chartId
    log.userId = userId
    log.config = config
    // TODO: the orm needs to support this but it does not :(
    log.createdAt = new Date()
    log.updatedAt = new Date()
    log.save()
}