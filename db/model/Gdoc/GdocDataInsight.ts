import { Entity, Column, LessThanOrEqual, Raw } from "typeorm"
import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocDataInsightContent,
    OwidGdocDataInsightInterface,
    MinimalDataInsightInterface,
    OwidGdocType,
    DATA_INSIGHTS_INDEX_PAGE_SIZE,
    OwidGdocMinimalPostInterface,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"
import * as db from "../../../db/db.js"

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

    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
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
        this.latestDataInsights = await db.getLatestDataInsights()
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

    /**
     * Returns the number of pages that will exist on the data insights index page
     * based on the number of published data insights and DATA_INSIGHTS_INDEX_PAGE_SIZE
     */
    static async getTotalPageCount(): Promise<number> {
        const count = await db.getPublishedDataInsightCount()
        return Math.ceil(count / DATA_INSIGHTS_INDEX_PAGE_SIZE)
    }
}
