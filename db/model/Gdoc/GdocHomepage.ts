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
import { getLatestDataInsights } from "./GdocFactory.js"

export class GdocHomepage
    extends GdocBase
    implements OwidGdocHomepageInterface
{
    declare content: OwidGdocHomepageContent

    constructor(id?: string) {
        super(id)
    }

    static create(obj: OwidGdocBaseInterface): GdocHomepage {
        const gdoc = new GdocHomepage()
        Object.assign(gdoc, obj)
        return gdoc
    }

    override linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    homepageMetadata: OwidGdocHomepageMetadata = {}

    override _validateSubclass = async (
        knex: db.KnexReadonlyTransaction
    ): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []
        const otherPublishedHomepages = await db.knexRaw<{ id: string }>(
            knex,
            `
            SELECT
                id
            FROM posts_gdocs
            WHERE type = "${OwidGdocType.Homepage}"
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

    override _loadSubclassAttachments = async (
        knex: db.KnexReadWriteTransaction
    ): Promise<void> => {
        const [grapherCount, nonGrapherExplorerViewCount] = await Promise.all([
            db.getTotalNumberOfCharts(knex),
            db.getNonGrapherExplorerViewCount(knex),
        ])

        this.homepageMetadata = {
            chartCount: grapherCount + nonGrapherExplorerViewCount,
            topicCount: await db.getUniqueTopicCount(knex),
            tagGraph: await db.generateTopicTagGraph(knex),
        }

        const { dataInsights, imageMetadata } =
            await getLatestDataInsights(knex)
        this.latestDataInsights = dataInsights
        this.imageMetadata = Object.assign(this.imageMetadata, imageMetadata)
    }
}
