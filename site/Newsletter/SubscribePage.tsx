import { Head } from "../Head.js"
import { Html } from "../Html.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import {
    SiteFooterContext,
    SUBSCRIBE_PAGE_ROOT_ID,
} from "@ourworldindata/types"
import { SubscribeFlow } from "./SubscribeFlow.js"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"

declare global {
    interface Window {
        _OWID_TOPIC_AREA_NAMES: string[]
    }
}

export interface SubscribePageProps {
    baseUrl: string
    topicAreaNames: string[]
}

export const SubscribePage = ({
    baseUrl,
    topicAreaNames,
}: SubscribePageProps) => {
    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/subscribe`}
                pageTitle="Subscribe to Our World in Data"
                pageDesc="Stay up to date with our latest research and data insights by subscribing to our newsletter."
                baseUrl={baseUrl}
                imageUrl={`${BAKED_BASE_URL}/images/biweekly-newsletter.webp`}
            >
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_TOPIC_AREA_NAMES = ${JSON.stringify(topicAreaNames)}`,
                    }}
                ></script>
            </Head>
            <body className="sticky-footer-body">
                <SiteHeader />
                {/* <main> is the hydration root: SubscribeFlow renders its grid
                children directly, so the page grid needs no extra wrapper. */}
                <main
                    id={SUBSCRIBE_PAGE_ROOT_ID}
                    className="subscribe-page grid grid-cols-12-full-width"
                >
                    <SubscribeFlow topicAreaNames={topicAreaNames} />
                </main>
                <SiteFooter context={SiteFooterContext.subscribePage} />
            </body>
        </Html>
    )
}
