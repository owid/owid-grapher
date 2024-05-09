import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocDataInsightContent,
    OwidGdocDataInsightInterface,
    MinimalDataInsightInterface,
    OwidGdocMinimalPostInterface,
    OwidGdocBaseInterface,
    excludeNullish,
    defaults,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"
import * as db from "../../../db/db.js"
import { getAndLoadPublishedDataInsights } from "./GdocFactory.js"

export class GdocDataInsight
    extends GdocBase
    implements OwidGdocDataInsightInterface
{
    content!: OwidGdocDataInsightContent

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
    }

    static create(obj: OwidGdocBaseInterface): GdocDataInsight {
        const gdoc = new GdocDataInsight()
        defaults(gdoc, obj) // see GdocAuthor.ts for rationale
        return gdoc
    }

    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    latestDataInsights: MinimalDataInsightInterface[] = []
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
        knex: db.KnexReadonlyTransaction
    ): Promise<void> => {
        // TODO: refactor these classes to properly use knex - not going to start it now
        this.latestDataInsights = await db.getPublishedDataInsights(knex, 5)
    }

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    static async getPublishedDataInsights(
        knex: db.KnexReadWriteTransaction,
        page?: number
    ): Promise<GdocDataInsight[]> {
        return getAndLoadPublishedDataInsights(knex, page)
    }
}
