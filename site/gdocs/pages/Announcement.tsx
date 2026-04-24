import { OwidGdocAnnouncementInterface } from "@ourworldindata/types"
import * as React from "react"
import { AnnouncementContent } from "../../latest/AnnouncementContent.js"
import { deriveAnnouncementLatestType } from "../../latest/latestUtils.js"

type AnnouncementProps = {
    className?: string
} & Omit<
    OwidGdocAnnouncementInterface,
    "contentMd5" | "markdown" | "publicationContext" | "revisionId" | "source"
>

export const AnnouncementPage = ({
    content,
    publishedAt,
    slug,
    tags,
}: AnnouncementProps): React.ReactElement => {
    const latestType = deriveAnnouncementLatestType(content.kicker)
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
                    excerpt={content.excerpt}
                    body={content.body}
                    cta={content.cta}
                    isStandalone
                />
            </div>
        </div>
    )
}
