import * as _ from 'lodash'

import * as db from '../db'
import ChartConfig, { ChartConfigProps } from '../../js/charts/ChartConfig'
import {getVariableData} from './Variable'


import {Entity, PrimaryGeneratedColumn, Column, BaseEntity} from "typeorm"

@Entity("charts")
export class Chart extends BaseEntity {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: 'json' })
    config: any
}

// TODO integrate this old logic with typeorm
export default class OldChart {
    static listFields = `
        charts.id,
        JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.title")) AS title,
        JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.slug")) AS slug,
        JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.type")) AS type,
        JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.internalNotes")) AS internalNotes,
        JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.isPublished")) AS isPublished,
        JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.tab")) AS tab,
        JSON_EXTRACT(charts.config, "$.hasChartTab") = true AS hasChartTab,
        JSON_EXTRACT(charts.config, "$.hasMapTab") = true AS hasMapTab,
        charts.starred AS isStarred,
        charts.last_edited_at AS lastEditedAt,
        charts.last_edited_by AS lastEditedBy,
        charts.published_at AS publishedAt,
        charts.published_by AS publishedBy
    `

    static async getBySlug(slug: string): Promise<OldChart> {
        const row = await db.get(`SELECT id, config FROM charts WHERE JSON_EXTRACT(config, "$.slug") = ?`, [slug])
        return new OldChart(row.id, JSON.parse(row.config))
    }

    id: number
    config: ChartConfigProps
    constructor(id: number, config: ChartConfigProps) {
        this.id = id
        this.config = config

        // XXX todo make the relationship between chart models and chart configuration more defined
        this.config.id = id
    }

    async getVariableData(): Promise<any> {
        const variableIds = _.uniq(this.config.dimensions.map(d => d.variableId))
        return getVariableData(variableIds)
    }
}