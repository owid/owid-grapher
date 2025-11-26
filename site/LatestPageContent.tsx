import {
    ImageMetadata,
    LatestPageItem,
    LinkedAuthor,
    OwidGdocAnnouncementInterface,
    OwidGdocMinimalPostInterface,
    OwidGdocType,
} from "@ourworldindata/utils"
import { AttachmentsContext } from "./gdocs/AttachmentsContext.js"
import { AnnouncementPageContent } from "./gdocs/pages/Announcement.js"

export const _OWID_LATEST_PAGE_DATA = "_OWID_LATEST_PAGE_DATA"

export interface LatestPageProps {
    posts: LatestPageItem[]
    imageMetadata: Record<string, ImageMetadata>
    linkedAuthors: LinkedAuthor[]
    linkedDocuments?: Record<string, OwidGdocMinimalPostInterface>
}

const LatestPageAnnouncement = (props: {
    data: OwidGdocAnnouncementInterface
}) => {
    return (
        <article className="latest-page__announcement span-cols-6 col-start-5 span-md-cols-10 col-md-start-2 span-sm-cols-14 col-sm-start-1">
            <AnnouncementPageContent {...props.data} />
        </article>
    )
}

export const LatestPageContent = (props: LatestPageProps) => {
    const { posts, imageMetadata, linkedAuthors, linkedDocuments = {} } = props

    // Filter only announcements that need hydration (have images with interactive elements)
    const announcements = posts.filter(
        (post): post is LatestPageItem & { type: OwidGdocType.Announcement } =>
            post.type === OwidGdocType.Announcement
    )

    return (
        <AttachmentsContext.Provider
            value={{
                imageMetadata,
                linkedAuthors,
                linkedCharts: {},
                linkedDocuments,
                linkedIndicators: {},
                relatedCharts: [],
                tags: [],
            }}
        >
            {announcements.map((announcement) => (
                <LatestPageAnnouncement
                    key={announcement.data.id}
                    data={announcement.data}
                />
            ))}
        </AttachmentsContext.Provider>
    )
}
