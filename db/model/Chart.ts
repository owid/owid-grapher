import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    OneToMany,
    Relation,
} from "typeorm"
import * as lodash from "lodash"
import * as db from "../db.js"
import { getVariableData } from "./Variable.js"
import { User } from "./User.js"
import { ChartRevision } from "./ChartRevision.js"

// XXX hardcoded filtering to public parent tags
const PUBLIC_TAG_PARENT_IDS = [
    1515, 1507, 1513, 1504, 1502, 1509, 1506, 1501, 1514, 1511, 1500, 1503,
    1505, 1508, 1512, 1510,
]

@Entity("charts")
export class Chart extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column({ type: "json" }) config: any
    @Column() lastEditedAt!: Date
    @Column({ nullable: true }) lastEditedByUserId!: number
    @Column({ nullable: true }) publishedAt!: Date
    @Column({ nullable: true }) publishedByUserId!: number
    @Column() createdAt!: Date
    @Column() updatedAt!: Date
    @Column() isExplorable!: boolean

    @ManyToOne(() => User, (user) => user.lastEditedCharts)
    lastEditedByUser!: Relation<User>
    @ManyToOne(() => User, (user) => user.publishedCharts)
    publishedByUser!: Relation<User>
    @OneToMany(() => ChartRevision, (rev) => rev.chart)
    logs!: Relation<ChartRevision[]>

    static table: string = "charts"

    // Only considers published charts, because only in that case the mapping slug -> id is unique
    static async mapSlugsToIds(): Promise<{ [slug: string]: number }> {
        const redirects = await db.queryMysql(
            `SELECT chart_id, slug FROM chart_slug_redirects`
        )
        const rows = await db.queryMysql(`
            SELECT
                id,
                JSON_UNQUOTE(JSON_EXTRACT(config, "$.slug")) AS slug
            FROM charts
            WHERE JSON_EXTRACT(config, "$.isPublished") IS TRUE
        `)

        const slugToId: { [slug: string]: number } = {}
        for (const row of redirects) {
            slugToId[row.slug] = row.chart_id
        }
        for (const row of rows) {
            slugToId[row.slug] = row.id
        }
        return slugToId
    }

    static async getBySlug(slug: string): Promise<Chart | undefined> {
        const slugsById = await this.mapSlugsToIds()
        return await Chart.findOne({ id: slugsById[slug] })
    }

    static async getById(id: number): Promise<Chart | undefined> {
        return await Chart.findOne({ id })
    }

    static async setTags(chartId: number, tagIds: number[]): Promise<void> {
        await db.transaction(async (t) => {
            const tagRows = tagIds.map((tagId) => [tagId, chartId])
            await t.execute(`DELETE FROM chart_tags WHERE chartId=?`, [chartId])
            if (tagRows.length)
                await t.execute(
                    `INSERT INTO chart_tags (tagId, chartId) VALUES ?`,
                    [tagRows]
                )

            const tags = tagIds.length
                ? ((await t.query("select parentId from tags where id in (?)", [
                      tagIds,
                  ])) as { parentId: number }[])
                : []
            const isIndexable = tags.some((t) =>
                PUBLIC_TAG_PARENT_IDS.includes(t.parentId)
            )

            await t.execute("update charts set is_indexable = ? where id = ?", [
                isIndexable,
                chartId,
            ])
        })
    }

    static async assignTagsForCharts(
        charts: { id: number; tags: any[] }[]
    ): Promise<void> {
        const chartTags = await db.queryMysql(`
            SELECT ct.chartId, ct.tagId, t.name as tagName FROM chart_tags ct
            JOIN charts c ON c.id=ct.chartId
            JOIN tags t ON t.id=ct.tagId
        `)

        for (const chart of charts) {
            chart.tags = []
        }

        const chartsById = lodash.keyBy(charts, (c) => c.id)

        for (const ct of chartTags) {
            const chart = chartsById[ct.chartId]
            if (chart) chart.tags.push({ id: ct.tagId, name: ct.tagName })
        }
    }

    static async all(): Promise<ChartRow[]> {
        const rows = await db.knexTable(Chart.table)

        for (const row of rows) {
            row.config = JSON.parse(row.config)
        }

        return rows as ChartRow[] // This cast might be a lie?
    }
}

interface ChartRow {
    id: number
    config: any
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
        charts.lastEditedAt,
        charts.lastEditedByUserId,
        lastEditedByUser.fullName AS lastEditedBy,
        charts.publishedAt,
        charts.publishedByUserId,
        publishedByUser.fullName AS publishedBy,
        charts.isExplorable AS isExplorable
    `

    static async getBySlug(slug: string): Promise<OldChart> {
        const row = await db.mysqlFirst(
            `SELECT id, config FROM charts WHERE JSON_EXTRACT(config, "$.slug") = ?`,
            [slug]
        )

        return new OldChart(row.id, JSON.parse(row.config))
    }

    id: number
    config: any
    constructor(id: number, config: any) {
        this.id = id
        this.config = config

        // XXX todo make the relationship between chart models and chart configuration more defined
        this.config.id = id
    }

    async getVariableData(): Promise<any> {
        const variableIds = lodash.uniq(
            this.config.dimensions!.map((d: any) => d.variableId)
        )
        return getVariableData(variableIds as number[])
    }
}

export const getGrapherById = async (grapherId: number): Promise<any> => {
    const grapher = (
        await db.queryMysql(`SELECT id, config FROM charts WHERE id=?`, [
            grapherId,
        ])
    )[0]

    if (!grapher) return undefined

    const config = JSON.parse(grapher.config)
    config.id = grapher.id
    return config
}
