import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import {
    formatAuthors,
    ImageMetadata,
    LatestDataInsight,
    LatestPageItem,
    LinkedAuthor,
    LinkedChart,
    OwidGdocAnnouncementInterface,
    OwidGdocMinimalPostInterface,
    OwidGdocType,
} from "@ourworldindata/utils"
import { Html } from "./Html.js"
import { AttachmentsContext } from "./gdocs/AttachmentsContext.js"
import { AnnouncementPageContent } from "./gdocs/pages/Announcement.js"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import Image from "./gdocs/components/Image.js"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"
import DataInsightDateline from "./gdocs/components/DataInsightDateline.js"
import cx from "classnames"
import { NewsletterWithSocials } from "./NewsletterSubscription.js"
import { Pagination } from "./Pagination.js"

const COMMON_CLASSES =
    "grid grid-cols-6 span-cols-6 col-start-5 span-md-cols-10 col-md-start-2 span-sm-cols-14 col-sm-start-1"

const LatestPageDataInsight = (props: { data: LatestDataInsight }) => {
    const href = getPrefixedGdocPath("", {
        slug: props.data.slug,
        content: { type: OwidGdocType.DataInsight },
    })
    const firstImage = props.data.content.body.find(
        (block) => block.type === "image"
    )
    const otherBlocks = props.data.content.body.filter(
        (block) => block !== firstImage
    )

    return (
        <article className={cx("latest-page__data-insight", COMMON_CLASSES)}>
            <DataInsightDateline
                publishedAt={props.data.publishedAt}
                className="latest-page__item-dateline h6-black-caps span-cols-4"
            />
            <p className="latest-page__item-type h6-black-caps span-cols-2 col-start-5">
                Data Insight
            </p>
            <a
                href={href}
                aria-label={props.data.content.title}
                className="latest-page__data-insight-link grid grid-cols-6 span-cols-6"
            >
                {firstImage && (
                    <Image
                        className="latest-page__data-insight-image span-cols-2 span-sm-cols-6"
                        filename={firstImage.filename}
                        containerType="span-5"
                        shouldLightbox={false}
                    />
                )}
                <div className="span-cols-4 col-start-3 span-sm-cols-6 col-sm-start-1">
                    <h2 className="body-1-bold">{props.data.content.title}</h2>
                    <div className="latest-page__data-insight-blocks">
                        <ArticleBlocks
                            blocks={otherBlocks}
                            shouldRenderLinks={false}
                        />
                    </div>
                </div>
            </a>
        </article>
    )
}

const LatestPageArticle = (props: { data: OwidGdocMinimalPostInterface }) => {
    const featuredImage = props.data["featured-image"]
    const href = getPrefixedGdocPath("", {
        slug: props.data.slug,
        content: { type: OwidGdocType.Article },
    })
    return (
        <article className={cx("latest-page__article", COMMON_CLASSES)}>
            <DataInsightDateline
                publishedAt={new Date(props.data.publishedAt!)}
                className="latest-page__item-dateline h6-black-caps span-cols-4"
            />
            <p className="latest-page__item-type h6-black-caps span-cols-2 col-start-5">
                Article
            </p>
            <a
                href={href}
                aria-label={props.data.title}
                className="latest-page__article-link grid grid-cols-6 span-cols-6"
            >
                {featuredImage && (
                    <Image
                        filename={featuredImage}
                        className="span-cols-1"
                        shouldLightbox={false}
                    />
                )}
                <div className="span-cols-5 col-start-2">
                    <h2>{props.data.title}</h2>
                    <p>{props.data.excerpt}</p>
                    <p className="latest-page__article-authors">
                        {formatAuthors(props.data.authors)}
                    </p>
                </div>
            </a>
        </article>
    )
}

const LatestPageAnnouncement = (props: {
    data: OwidGdocAnnouncementInterface
}) => {
    return (
        <article
            className={cx(
                "latest-page__announcement span-cols-6 col-start-5 span-md-cols-10 col-md-start-2 span-sm-cols-14 col-sm-start-1"
            )}
        >
            <AnnouncementPageContent {...props.data} />
        </article>
    )
}

export const LatestPageItemComponent = (props: { item: LatestPageItem }) => {
    switch (props.item.type) {
        case OwidGdocType.Article:
            return <LatestPageArticle data={props.item.data} />
        case OwidGdocType.DataInsight:
            return <LatestPageDataInsight data={props.item.data} />
        case OwidGdocType.Announcement:
            return <LatestPageAnnouncement data={props.item.data} />
    }
}

export const LatestPage = (props: {
    posts: LatestPageItem[]
    imageMetadata: Record<string, ImageMetadata>
    linkedAuthors: LinkedAuthor[]
    linkedCharts: Record<string, LinkedChart>
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>
    pageNum: number
    numPages: number
    baseUrl: string
}) => {
    const { pageNum, baseUrl, numPages, posts } = props
    const pageTitle = "Latest"

    const renderLatestPageItem = (item: LatestPageItem) => (
        <LatestPageItemComponent key={item.data.id} item={item} />
    )

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
            <body>
                <SiteHeader />
                <AttachmentsContext.Provider
                    value={{
                        imageMetadata: props.imageMetadata,
                        linkedAuthors: props.linkedAuthors,
                        linkedCharts: props.linkedCharts,
                        linkedDocuments: props.linkedDocuments,
                        linkedIndicators: {},
                        relatedCharts: [],
                        tags: [],
                    }}
                >
                    <main className="latest-page grid grid-cols-12-full-width grid-md-cols-12">
                        <header className="latest-page-header span-cols-14 span-md-cols-12 grid grid-cols-12-full-width grid-md-cols-12">
                            <h1 className="display-2-semibold span-cols-6 col-start-5 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                Latest
                            </h1>
                            <p className="body-1-regular span-cols-6 col-start-5 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                Our latest articles, data updates, and
                                announcements
                            </p>
                        </header>

                        {posts.slice(0, 2).map(renderLatestPageItem)}
                        <NewsletterWithSocials className="latest-page__newsletter-signup col-start-11 span-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-14" />
                        {posts.slice(2).map(renderLatestPageItem)}
                        <Pagination
                            pageNumber={pageNum}
                            totalPageCount={numPages}
                            basePath="/latest"
                            usePagePrefix={true}
                            className="span-cols-6 col-start-5 span-md-cols-10 col-md-start-2 span-sm-cols-14 col-sm-start-1"
                        />
                    </main>
                </AttachmentsContext.Provider>
                <SiteFooter />
            </body>
        </Html>
    )
}
