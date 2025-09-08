import * as _ from "lodash-es"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import {
    ImageMetadata,
    LatestDataInsight,
    LatestPageItem,
    LinkedAuthor,
    OwidGdocAnnouncementInterface,
    OwidGdocMinimalPostInterface,
    OwidGdocType,
} from "@ourworldindata/utils"
import { Html } from "./Html.js"
import { AttachmentsContext } from "./gdocs/AttachmentsContext.js"
import { AnnouncementPageContent } from "./gdocs/pages/Announcement.js"

const LatestPageDataInsight = (props: { data: LatestDataInsight }) => {
    return <article>data insight</article>
}

const LatestPageArticle = (props: { data: OwidGdocMinimalPostInterface }) => {
    return <article>article</article>
}

const LatestPageAnnouncement = (props: {
    data: OwidGdocAnnouncementInterface
}) => {
    return (
        <article>
            <AnnouncementPageContent {...props.data} />
        </article>
    )
}

const LatestPageItemComponent = (item: LatestPageItem) => {
    switch (item.type) {
        case OwidGdocType.Article:
            return <LatestPageArticle data={item.data} />
        case OwidGdocType.DataInsight:
            return <LatestPageDataInsight data={item.data} />
        case OwidGdocType.Announcement:
            return <LatestPageAnnouncement data={item.data} />
    }
}

export const LatestPage = (props: {
    posts: LatestPageItem[]
    imageMetadata: Record<string, ImageMetadata>
    linkedAuthors: LinkedAuthor[]
    pageNum: number
    numPages: number
    baseUrl: string
}) => {
    const { pageNum, numPages, baseUrl, posts } = props
    const pageTitle = "Latest"

    return (
        <Html>
            <Head
                canonicalUrl={
                    `${baseUrl}/latest` +
                    (pageNum > 1 ? `/page/${pageNum}` : "")
                }
                pageTitle={pageTitle}
                baseUrl={baseUrl}
            />
            <body className="blog">
                <SiteHeader />
                <AttachmentsContext.Provider
                    value={{
                        imageMetadata: props.imageMetadata,
                        linkedAuthors: props.linkedAuthors,
                        linkedCharts: {},
                        linkedDocuments: {},
                        linkedIndicators: {},
                        relatedCharts: [],
                        tags: [],
                    }}
                >
                    <main className="wrapper">
                        {posts.map((post) => (
                            <LatestPageItemComponent
                                key={post.data.id}
                                {...post}
                            />
                        ))}
                    </main>
                </AttachmentsContext.Provider>
                <SiteFooter />
            </body>
        </Html>
    )
}
