import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import {
    serializeJSONForHTML,
    SiteFooterContext,
    TagGraphRoot,
} from "@ourworldindata/utils"
import { LatestNewsletter } from "@ourworldindata/types"
import { Html } from "./Html.js"

declare global {
    interface Window {
        _OWID_TOPIC_TAG_GRAPH: TagGraphRoot
        _OWID_NEWSLETTERS: LatestNewsletter[]
    }
}

export const LatestPage = (props: {
    baseUrl: string
    topicTagGraph: TagGraphRoot
    newsletters: LatestNewsletter[]
}) => {
    const { baseUrl, topicTagGraph, newsletters } = props

    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/latest`}
                pageTitle="Latest"
                pageDesc="The latest articles, insights, updates, and announcements from Our World in Data."
                imageUrl={`${baseUrl}/latest-thumbnail.png`}
                baseUrl={baseUrl}
            >
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_TOPIC_TAG_GRAPH = ${JSON.stringify(topicTagGraph)}\nwindow._OWID_NEWSLETTERS = ${serializeJSONForHTML(newsletters)}`,
                    }}
                ></script>
            </Head>
            <body>
                <SiteHeader />
                <main
                    id="latest-page-root"
                    className="latest-page grid grid-cols-12-full-width"
                >
                    {/* Latest UI is rendered client-side only */}
                </main>
                <SiteFooter context={SiteFooterContext.latestPage} />
            </body>
        </Html>
    )
}
