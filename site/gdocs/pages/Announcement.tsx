import {
    AnnouncementLatestType,
    LATEST_TYPE_LABELS,
    OwidGdocAnnouncementInterface,
} from "@ourworldindata/types"
import { formatAuthors } from "@ourworldindata/utils"
import { useContext } from "react"
import * as React from "react"
import { AnnouncementContent } from "../../latest/AnnouncementContent.js"
import { deriveAnnouncementLatestType } from "../../latest/latestUtils.js"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { CopySocialButton } from "../components/CopySocialButton.js"
import { buildSocialText } from "../socialText.js"

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
    const { linkedDocuments } = useContext(AttachmentsContext)
    const latestType = deriveAnnouncementLatestType(content.kicker)
    const shouldShowCopySocialButton =
        SOCIAL_LATEST_TYPES.includes(latestType) && content.body.length > 0
    return (
        <div className="announcement-page grid grid-cols-12-full-width">
            <div className="announcement-page-content span-cols-6 col-start-5 span-md-cols-8 col-md-start-4 span-sm-cols-14 col-sm-start-1">
                <AnnouncementContent
                    title={content.title}
                    latestType={latestType}
                    tags={tags?.map((t) => t.name) ?? []}
                    slug={slug}
                    publishedAt={publishedAt}
                    authors={content.authors}
                    body={content.body}
                    isStandalone
                />
                {shouldShowCopySocialButton && (
                    <div className="announcement-page-footer">
                        <CopySocialButton
                            className="announcement-page-copy-social-button"
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
                    </div>
                )}
            </div>
        </div>
    )
}
