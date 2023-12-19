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
    // TODO: support query parameters in grapher urls so we can track country selections
    _urlProperties: string[] = ["grapher-url"]

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
        this.latestDataInsights = await GdocDataInsight.loadLatestDataInsights()
    }

    static async loadLatestDataInsights(): Promise<
        MinimalDataInsightInterface[]
    > {
        const c = await getConnection()
        return (
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
        page?: number
    ): Promise<GdocDataInsight[]> {
        const isPaging = page !== undefined
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
            take: isPaging ? DATA_INSIGHTS_INDEX_PAGE_SIZE : undefined,
            skip: isPaging ? page * DATA_INSIGHTS_INDEX_PAGE_SIZE : undefined,
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

    /**
     * Returns the number of pages that will exist on the data insights index page
     * based on the number of published data insights and DATA_INSIGHTS_INDEX_PAGE_SIZE
     */
    static async getTotalPageCount(): Promise<number> {
        return (
            1 +
            Math.floor(
                (await GdocDataInsight.getPublishedDataInsightCount()) /
                    DATA_INSIGHTS_INDEX_PAGE_SIZE
            )
        )
    }
}
