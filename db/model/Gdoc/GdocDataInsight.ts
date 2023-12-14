import { Entity, Column, LessThanOrEqual, Raw } from "typeorm"
import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocDataInsightContent,
    OwidGdocDataInsightInterface,
    OwidGdocPostInterface,
    MinimalDataInsightInterface,
    OwidGdocType,
    DATA_INSIGHTS_INDEX_PAGE_SIZE,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"
import { getConnection } from "../../../db/db.js"

@Entity("posts_gdocs")
export class GdocDataInsight
    extends GdocBase
    implements OwidGdocDataInsightInterface
{
    @Column({ default: "{}", type: "json" })
    content!: OwidGdocDataInsightContent

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
    }

    linkedDocuments: Record<string, OwidGdocPostInterface> = {}
    latestDataInsights: MinimalDataInsightInterface[] = []

    _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []
        if (!this.content["approved-by"]) {
            errors.push({
                type: OwidGdocErrorMessageType.Error,
                property: "approved-by",
                message: "Missing an approved-by field in the front-matter",
            })
        }
        return errors
    }

    _loadSubclassAttachments = async (): Promise<void> => {
        await this.loadLatestDataInsights()
    }

    async loadLatestDataInsights(): Promise<void> {
        const c = await getConnection()
        this.latestDataInsights = (
            await c.query(`
        SELECT
            content->>'$.title' AS title,
            publishedAt,
            ROW_NUMBER() OVER (ORDER BY publishedAt DESC) - 1 AS \`index\`
        FROM posts_gdocs
        WHERE content->>'$.type' = '${OwidGdocType.DataInsight}'
            AND published = TRUE
            AND publishedAt < NOW()
        ORDER BY publishedAt DESC
        LIMIT 5
        `)
        ).map((record: any) => ({
            ...record,
            index: Number(record.index),
        })) as MinimalDataInsightInterface[]
    }

    static async getPublishedDataInsights(
        page: number = 0
    ): Promise<GdocDataInsight[]> {
        return GdocDataInsight.find({
            where: {
                published: true,
                publishedAt: LessThanOrEqual(new Date()),
                content: Raw(
                    (content) =>
                        `${content}->"$.type" = '${OwidGdocType.DataInsight}'`
                ),
            },
            order: {
                publishedAt: "DESC",
            },
            take: DATA_INSIGHTS_INDEX_PAGE_SIZE,
            skip: page * DATA_INSIGHTS_INDEX_PAGE_SIZE,
            relations: ["tags"],
        })
    }

    static async getPublishedDataInsightCount(): Promise<number> {
        const c = await getConnection()
        const query = `
            SELECT COUNT(*) AS count
            FROM posts_gdocs
            WHERE content->>'$.type' = '${OwidGdocType.DataInsight}'
                AND published = TRUE
                AND publishedAt < NOW()
        `
        return (await c.query(query))[0].count
    }
}
