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
        // TODO: refactor these classes to properly use knex - not going to start it now
        this.latestDataInsights = await db.getPublishedDataInsights(
            db.knexInstance() as db.KnexReadonlyTransaction, // TODO: replace this with a transaction that is passed in
            5
        )
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
}
