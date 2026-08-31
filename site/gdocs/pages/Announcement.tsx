import {
    AnnouncementLatestType,
    LATEST_TYPE_LABELS,
    OwidGdocAnnouncementInterface,
} from "@ourworldindata/types"
import {
    deriveAnnouncementLatestType,
    formatAuthors,
    OwidGdocType,
} from "@ourworldindata/utils"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import { useContext } from "react"
import * as React from "react"
import { AttachmentsContext } from "../AttachmentsContext.js"
import LatestBreadcrumb from "../components/LatestBreadcrumb.js"
import LatestCarouselSection from "../components/LatestCarouselSection.js"
import CopyLinkButton from "../components/CopyLinkButton.js"
import RelatedTopicsList from "../components/RelatedTopicsList.js"
import StandalonePostBody, {
    STANDALONE_POST_GRID_CLASSES,
} from "../components/StandalonePostBody.js"
import { announcementsToCarouselItems } from "../components/latestCarouselItems.js"
import { CopySocialButton } from "../components/CopySocialButton.js"
import { buildSocialText } from "../socialText.js"
import {
    buildLatestPagePath,
    latestTypeLabelPlural,
} from "../../latest/latestUtils.js"

// Announcements posted on social media are data and topic updates; the other
// kinds (website upgrades, general announcements) aren't, so they don't get
// the button.
const SOCIAL_LATEST_TYPES: readonly AnnouncementLatestType[] = [
    "data-update",
    "topic-update",
]

type AnnouncementProps = {
    className?: string
} & Omit<
    OwidGdocAnnouncementInterface,
    "contentMd5" | "markdown" | "publicationContext" | "revisionId"
>

function buildAuthorsNote(
    latestType: AnnouncementLatestType,
    authors: string[]
): string | undefined {
    if (authors.length === 0) return undefined
    const kicker = LATEST_TYPE_LABELS[latestType].toLowerCase()
    return `This ${kicker} was led by ${formatAuthors(authors)}.`
}

export const AnnouncementPage = ({
    content,
    publishedAt,
    slug,
    tags,
}: AnnouncementProps): React.ReactElement => {
    const { linkedDocuments, latestAnnouncements } =
        useContext(AttachmentsContext)
    const latestType = deriveAnnouncementLatestType(content.kicker)
    const shouldShowCopySocialButton =
        SOCIAL_LATEST_TYPES.includes(latestType) && content.body.length > 0
    const path = getPrefixedGdocPath("", {
        slug,
        content: { type: OwidGdocType.Announcement },
    })
    // The carousel is fed announcements of this page's own kind, so the one
    // we're looking at has to come out of it.
    const otherAnnouncements =
        latestAnnouncements?.filter(
            (announcement) => announcement.slug !== slug
        ) ?? []

    return (
        <div className="grid grid-cols-12-full-width standalone-post-page">
            <LatestBreadcrumb
                className={STANDALONE_POST_GRID_CLASSES}
                latestType={latestType}
                title={content.title}
            />
            <StandalonePostBody
                title={content.title}
                authors={content.authors}
                body={content.body}
                publishedAt={publishedAt}
                footer={
                    <>
                        <RelatedTopicsList tags={tags ?? undefined} />
                        <CopyLinkButton
                            path={path}
                            trackNote="announcement_copy_link"
                        />
                        {shouldShowCopySocialButton && (
                            <CopySocialButton
                                className="copy-link-button"
                                text={buildSocialText({
                                    title: content.title,
                                    body: content.body,
                                    authorsNote: buildAuthorsNote(
                                        latestType,
                                        content.authors
                                    ),
                                    linkedDocuments,
                                })}
                            />
                        )}
                    </>
                }
            />
            <LatestCarouselSection
                className="span-cols-12 col-start-2"
                heading={`Our latest ${latestTypeLabelPlural(latestType).toLowerCase()}`}
                seeAllText={`See all ${latestTypeLabelPlural(latestType).toLowerCase()}`}
                seeAllHref={buildLatestPagePath(latestType)}
                items={announcementsToCarouselItems(otherAnnouncements)}
            />
        </div>
    )
}
