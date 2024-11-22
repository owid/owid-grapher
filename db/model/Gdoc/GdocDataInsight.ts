import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocDataInsightContent,
    OwidGdocDataInsightInterface,
    OwidGdocMinimalPostInterface,
    OwidGdocBaseInterface,
    excludeNullish,
    LatestDataInsight,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"
import * as db from "../../../db/db.js"
import {
    getAndLoadPublishedDataInsightsPage,
    getLatestDataInsights,
} from "./GdocFactory.js"

export class GdocDataInsight
    extends GdocBase
    implements OwidGdocDataInsightInterface
{
    content!: OwidGdocDataInsightContent

    constructor(id?: string) {
        super(id)
    }

    static create(obj: OwidGdocBaseInterface): GdocDataInsight {
        const gdoc = new GdocDataInsight(undefined)
        Object.assign(gdoc, obj)
        return gdoc
    }

    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    latestDataInsights: LatestDataInsight[] = []
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
        const { dataInsights, imageMetadata } =
            await getLatestDataInsights(knex)
        this.latestDataInsights = dataInsights
        this.imageMetadata = Object.assign(this.imageMetadata, imageMetadata)
    }

    static async getPublishedDataInsights(
        knex: db.KnexReadonlyTransaction,
        page?: number
    ): Promise<GdocDataInsight[]> {
        return getAndLoadPublishedDataInsightsPage(knex, page)
    }
}
