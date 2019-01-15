import * as _ from 'lodash'
import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne, OneToMany, JoinColumn} from "typeorm"

import * as db from '../db'
import { ChartConfig, ChartConfigProps } from '../../js/charts/ChartConfig'
import {getVariableData} from './Variable'
import { User } from './User'
import { ChartRevision } from './ChartRevision'

@Entity("charts")
export class Chart extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column({ type: 'json' }) config: any
    @Column() lastEditedAt!: Date
    @Column({ nullable: true }) lastEditedByUserId!: number
    @Column({ nullable: true }) publishedAt!: Date
    @Column({ nullable: true }) publishedByUserId!: number
    @Column() createdAt!: Date
    @Column() updatedAt!: Date
    @Column() starred!: boolean

    @ManyToOne(type => User, user => user.lastEditedCharts)
    lastEditedByUser!: User
    @ManyToOne(type => User, user => user.publishedCharts)
    publishedByUser!: User
    @OneToMany(type => ChartRevision, rev => rev.chart)
    logs!: ChartRevision[]

    static async mapSlugsToIds(): Promise<{ [slug: string]: number }> {
        const redirects = await db.query(`SELECT chart_id, slug FROM chart_slug_redirects`)
        const rows = await db.query(`SELECT id, JSON_UNQUOTE(JSON_EXTRACT(config, "$.slug")) AS slug FROM charts`)

        const slugToId: {[slug: string]: number} = {}
        for (const row of redirects) {
            slugToId[row.slug] = row.chart_id
        }
        for (const row of rows) {
            slugToId[row.slug] = row.id
        }
        return slugToId
    }

    static async setTags(chartId: number, tagIds: number[]) {
        await db.transaction(async t => {
            const tagRows = tagIds.map(tagId => [tagId, chartId])
            await t.execute(`DELETE FROM chart_tags WHERE chartId=?`, [chartId])
            if (tagRows.length)
                await t.execute(`INSERT INTO chart_tags (tagId, chartId) VALUES ?`, [tagRows])
        })
    }

    static async assignTagsForCharts(charts: { id: number, tags: any[] }[]) {
        const chartTags = await db.query(`
            SELECT ct.chartId, ct.tagId, t.name as tagName FROM chart_tags ct
            JOIN charts c ON c.id=ct.chartId
            JOIN tags t ON t.id=ct.tagId
        `)

        for (const chart of charts) {
            chart.tags = []
        }

        const chartsById = _.keyBy(charts, c => c.id)

        for (const ct of chartTags) {
            const chart = chartsById[ct.chartId]
            if (chart)
                chart.tags.push({ id: ct.tagId, name: ct.tagName })
        }        
    }
}

// TODO integrate this old logic with typeorm
export class OldChart {
    static listFields = `
        charts.id,
        charts.config->>"$.title" AS title,
        charts.config->>"$.slug" AS slug,
        charts.config->>"$.type" AS type,
        charts.config->>"$.internalNotes" AS internalNotes,
        charts.config->>"$.variantName" AS variantName,
        charts.config->>"$.isPublished" AS isPublished,
        charts.config->>"$.tab" AS tab,
        JSON_EXTRACT(charts.config, "$.hasChartTab") = true AS hasChartTab,
        JSON_EXTRACT(charts.config, "$.hasMapTab") = true AS hasMapTab,
        charts.starred AS isStarred,
        charts.lastEditedAt,
        charts.lastEditedByUserId,
        lastEditedByUser.fullName AS lastEditedBy,
        charts.publishedAt,
        charts.publishedByUserId,
        publishedByUser.fullName AS publishedBy
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