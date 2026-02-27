import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import {
    ImageMetadata,
    LatestPageItem,
    LinkedAuthor,
    LinkedChart,
    OwidGdocMinimalPostInterface,
    serializeJSONForHTML,
    SiteFooterContext,
} from "@ourworldindata/utils"
import { Html } from "./Html.js"
import {
    LatestPageContent,
    LatestPageContentProps,
    LATEST_PAGE_CONTAINER_ID,
    _OWID_LATEST_PAGE_DATA,
} from "./LatestPageContent.js"

export { LatestPageItemComponent } from "./LatestPageContent.js"

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
    const { pageNum, baseUrl } = props
    const pageTitle = "Latest"

    const contentProps: LatestPageContentProps = {
        posts: props.posts,
        imageMetadata: props.imageMetadata,
        linkedAuthors: props.linkedAuthors,
        linkedCharts: props.linkedCharts,
        linkedDocuments: props.linkedDocuments,
        pageNum: props.pageNum,
        numPages: props.numPages,
    }

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
                <main
                    id={LATEST_PAGE_CONTAINER_ID}
                    className="latest-page grid grid-cols-12-full-width grid-md-cols-12"
                >
                    <LatestPageContent {...contentProps} />
                </main>
                <SiteFooter context={SiteFooterContext.latestPage} />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window.${_OWID_LATEST_PAGE_DATA} = ${serializeJSONForHTML(contentProps)}`,
                    }}
                />
            </body>
        </Html>
    )
}
