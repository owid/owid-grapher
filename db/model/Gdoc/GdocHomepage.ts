import { Entity, Column } from "typeorm"
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
import { OwidGdocHomepageMetadata } from "@ourworldindata/types"
import { UNIQUE_TOPIC_COUNT } from "../../../site/SiteNavigation.js"

@Entity("posts_gdocs")
export class GdocHomepage
    extends GdocBase
    implements OwidGdocHomepageInterface
{
    @Column({ default: "{}", type: "json" })
    content!: OwidGdocHomepageContent

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
    }

    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    homepageMetadata: OwidGdocHomepageMetadata = {}
    _urlProperties: string[] = []

    _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []
        const otherPublishedHomepages = await db.knexRaw<{ id: string }>(
            db.knexInstance(),
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

    _loadSubclassAttachments = async (): Promise<void> => {
        this.homepageMetadata = {
            chartCount: await db.getTotalNumberOfCharts(),
            topicCount: UNIQUE_TOPIC_COUNT,
        }

        // TODO: refactor these classes to properly use knex - not going to start it now
        this.latestDataInsights = await db.getPublishedDataInsights(
            db.knexInstance(),
            4
        )
    }
}
