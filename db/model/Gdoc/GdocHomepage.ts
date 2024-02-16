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
            `
            SELECT 
                id
            FROM posts_gdocs
            WHERE content->>"$.type" = "${OwidGdocType.Homepage}"
            AND published = TRUE
            AND id != ?`,
            db.knexInstance(),
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
        const totalNumberOfCharts = await db
            .knexRawFirst<{ count: number }>(
                `
                SELECT COUNT(*) AS count
                FROM charts
                WHERE publishedAt IS NOT NULL`,
                db.knexInstance()
            )
            .then((res) => res?.count)

        const totalNumberOfTopics = await db
            .knexRawFirst<{ count: number }>(
                `
                SELECT COUNT(DISTINCT(tagId)) AS count
                FROM chart_tags
                WHERE chartId IN (
                SELECT id
                FROM charts
                WHERE publishedAt IS NOT NULL)`,
                db.knexInstance()
            )
            .then((res) => res?.count)

        this.homepageMetadata = {
            chartCount: totalNumberOfCharts,
            topicCount: totalNumberOfTopics,
        }
    }
}
