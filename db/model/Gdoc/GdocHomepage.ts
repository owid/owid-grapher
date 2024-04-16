import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocHomepageContent,
    OwidGdocHomepageInterface,
    OwidGdocMinimalPostInterface,
    OwidGdocType,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"
import * as db from "../../db.js"
import {
    OwidGdocBaseInterface,
    OwidGdocHomepageMetadata,
} from "@ourworldindata/types"
import { UNIQUE_TOPIC_COUNT } from "../../../site/SiteNavigation.js"
export class GdocHomepage
    extends GdocBase
    implements OwidGdocHomepageInterface
{
    content!: OwidGdocHomepageContent

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
    }

    static create(obj: OwidGdocBaseInterface): GdocHomepage {
        const gdoc = new GdocHomepage()
        Object.assign(gdoc, obj)
        return gdoc
    }

    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    homepageMetadata: OwidGdocHomepageMetadata = {}

    _validateSubclass = async (
        knex: db.KnexReadonlyTransaction
    ): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []
        const otherPublishedHomepages = await db.knexRaw<{ id: string }>(
            knex,
            `
            SELECT
                id
            FROM posts_gdocs
            WHERE content->>"$.type" = "${OwidGdocType.Homepage}"
            AND published = TRUE
            AND id != ?`,
            [this.id]
        )
        if (otherPublishedHomepages.length > 0) {
            errors.push({
                property: "published",
                message: `There can only be one published homepage. There is a homepage with the ID ${otherPublishedHomepages[0].id} that is already published.`,
                type: OwidGdocErrorMessageType.Error,
            })
        }
        return errors
    }

    _loadSubclassAttachments = async (
        knex: db.KnexReadonlyTransaction
    ): Promise<void> => {
        const grapherCount = await db.getTotalNumberOfCharts(knex)
        const nonGrapherExplorerViewCount =
            await db.getNonGrapherExplorerViewCount(knex)

        this.homepageMetadata = {
            chartCount: grapherCount + nonGrapherExplorerViewCount,
            topicCount: UNIQUE_TOPIC_COUNT,
        }

        // TODO: refactor these classes to properly use knex - not going to start it now
        this.latestDataInsights = await db.getPublishedDataInsights(knex, 4)
    }
}
