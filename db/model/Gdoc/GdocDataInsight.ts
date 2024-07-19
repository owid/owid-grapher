import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocDataInsightContent,
    OwidGdocDataInsightInterface,
    OwidGdocMinimalPostInterface,
    OwidGdocBaseInterface,
    excludeNullish,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"
import * as db from "../../../db/db.js"
import {
    getAndLoadPublishedDataInsights,
    getAndLoadPublishedDataInsightsPage,
} from "./GdocFactory.js"

export class GdocDataInsight
    extends GdocBase
    implements OwidGdocDataInsightInterface
{
    content!: OwidGdocDataInsightContent
    private shouldLoadLatestDataInsights: boolean

    constructor(id?: string, shouldLoadLatestDataInsights: boolean = false) {
        super(id)
        this.shouldLoadLatestDataInsights = shouldLoadLatestDataInsights
    }

    static create(
        obj: OwidGdocBaseInterface,
        shouldLoadLatestDataInsights: boolean = false
    ): GdocDataInsight {
        const gdoc = new GdocDataInsight(
            undefined,
            shouldLoadLatestDataInsights
        )
        Object.assign(gdoc, obj)
        return gdoc
    }

    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    latestDataInsights: GdocDataInsight[] = []
    // TODO: support query parameters in grapher urls so we can track country selections

    protected typeSpecificUrls(): string[] {
        return excludeNullish([this.content["grapher-url"]])
    }

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

    _loadSubclassAttachments = async (
        knex: db.KnexReadWriteTransaction
    ): Promise<void> => {
        // TODO: refactor these classes to properly use knex - not going to start it now
        if (this.shouldLoadLatestDataInsights) {
            this.latestDataInsights = await getAndLoadPublishedDataInsights(
                knex,
                {
                    limit: 7,
                }
            )
            this.imageMetadata = Object.assign(
                this.imageMetadata,
                ...this.latestDataInsights.map(
                    (insight) => insight.imageMetadata
                )
            )
        }
    }

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    static async getPublishedDataInsights(
        knex: db.KnexReadWriteTransaction,
        page?: number
    ): Promise<GdocDataInsight[]> {
        return getAndLoadPublishedDataInsightsPage(knex, page)
    }
}
