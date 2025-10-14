import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocHomepageContent,
    OwidGdocHomepageInterface,
    OwidGdocMinimalPostInterface,
    OwidGdocType,
} from "@ourworldindata/utils"
import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import {
    GdocBase,
    getMinimalGdocPostsByIds,
    loadLinkedChartsForSlugs,
} from "./GdocBase.js"
import * as db from "../../db.js"
import {
    OwidGdocBaseInterface,
    OwidGdocHomepageMetadata,
    ContentGraphLinkType,
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

        const explorerCount = await db
            .getPublishedExplorersBySlug(knex, false)
            .then((explorers) => Object.keys(explorers).length)

        this.homepageMetadata = {
            chartCount: grapherCount + nonGrapherExplorerViewCount,
            topicCount: await db.getUniqueTopicCount(knex),
            explorerCount,
            tagGraph: await db.generateTopicTagGraph(knex),
            announcements: await db.getHomepageAnnouncements(knex),
        }

        // Load linked charts/documents from announcement CTAs
        // Because of announcement CTAs, announcements can have have their own links
        // which aren't caught by the GdocBase loadLinkedDocuments/Charts methods
        // So we need to add them here
        await this.loadAnnouncementLinks(knex)

        const { dataInsights, imageMetadata } =
            await getLatestDataInsights(knex)
        this.latestDataInsights = dataInsights
        this.imageMetadata = Object.assign(this.imageMetadata, imageMetadata)
    }

    private async loadAnnouncementLinks(
        knex: db.KnexReadonlyTransaction
    ): Promise<void> {
        const announcements = this.homepageMetadata.announcements
        if (!announcements || announcements.length === 0) return

        // Extract all CTA URLs from announcements
        const ctaUrls = announcements
            .map((announcement) => announcement.cta?.url)
            .filter((url): url is string => !!url)

        if (ctaUrls.length === 0) return

        // Categorize URLs by link type
        const gdocIds: string[] = []
        const grapherSlugs: string[] = []
        const explorerSlugs: string[] = []

        for (const url of ctaUrls) {
            const linkType = getLinkType(url)
            const target = getUrlTarget(url)

            if (linkType === ContentGraphLinkType.Gdoc) {
                gdocIds.push(target)
            } else if (linkType === ContentGraphLinkType.Grapher) {
                grapherSlugs.push(target)
            } else if (linkType === ContentGraphLinkType.Explorer) {
                explorerSlugs.push(target)
            }
        }

        // Load linked documents
        if (gdocIds.length > 0) {
            const linkedDocs = await getMinimalGdocPostsByIds(knex, gdocIds)
            for (const doc of linkedDocs) {
                this.linkedDocuments[doc.id] = doc
            }
        }

        // Load linked charts using shared helper
        if (grapherSlugs.length > 0 || explorerSlugs.length > 0) {
            const linkedCharts = await loadLinkedChartsForSlugs(
                knex,
                grapherSlugs,
                explorerSlugs
            )

            for (const chart of linkedCharts) {
                this.linkedCharts[chart.originalSlug] = chart
            }
        }
    }
}
