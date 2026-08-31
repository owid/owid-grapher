import {
    LatestAnnouncement,
    LatestDataInsight,
    OwidGdocType,
} from "@ourworldindata/types"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import { LatestCarouselItem } from "./LatestCarousel.js"

/** Mappers onto the carousel's card shape. They live here rather than in
 * LatestCarousel so the carousel stays unaware of the content types it shows,
 * and so both data insight call sites build their items identically. */

export function dataInsightsToCarouselItems(
    dataInsights: LatestDataInsight[]
): LatestCarouselItem[] {
    return dataInsights.map((dataInsight) => ({
        id: dataInsight.id,
        title: dataInsight.content.title,
        authors: dataInsight.content.authors,
        body: dataInsight.content.body,
        publishedAt: dataInsight.publishedAt
            ? new Date(dataInsight.publishedAt)
            : undefined,
        href: `/data-insights/${dataInsight.slug}`,
    }))
}

export function announcementsToCarouselItems(
    announcements: LatestAnnouncement[]
): LatestCarouselItem[] {
    return announcements.map((announcement) => ({
        id: announcement.id,
        title: announcement.content.title,
        authors: announcement.content.authors,
        body: announcement.content.body,
        publishedAt: announcement.publishedAt
            ? new Date(announcement.publishedAt)
            : undefined,
        // Announcements bake to /<slug> today and will move under a per-kind
        // namespace later; going through getPrefixedGdocPath means this
        // follows along.
        href: getPrefixedGdocPath("", {
            slug: announcement.slug,
            content: { type: OwidGdocType.Announcement },
        }),
    }))
}
