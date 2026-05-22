import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteFooterContext, TagGraphRoot } from "@ourworldindata/utils"
import { Html } from "./Html.js"

declare global {
    interface Window {
        _OWID_TOPIC_TAG_GRAPH: TagGraphRoot
    }
}

export const LatestPage = (props: {
    baseUrl: string
    topicTagGraph: TagGraphRoot
}) => {
    const { baseUrl, topicTagGraph } = props

    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/latest`}
                pageTitle="Latest"
                baseUrl={baseUrl}
            >
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_TOPIC_TAG_GRAPH = ${JSON.stringify(topicTagGraph)}`,
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
