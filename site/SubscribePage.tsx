import { Head } from "./Head.js"
import { Html } from "./Html.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import {
    NewsletterExampleUrls,
    SiteFooterContext,
    SUBSCRIBE_PAGE_FORM_CONTAINER_ID,
} from "@ourworldindata/types"
import { NewsletterSubscriptionForm } from "./NewsletterSubscription.js"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import { OwidSocials } from "./OwidSocials.js"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"

declare global {
    interface Window {
        _OWID_NEWSLETTER_EXAMPLES?: NewsletterExampleUrls
    }
}

export interface SubscribePageProps {
    baseUrl: string
    /** Latest edition of each newsletter, for the "see example" links. Also
     * injected as window._OWID_NEWSLETTER_EXAMPLES so client-side hydration
     * renders the same URLs as the bake. */
    newsletterExampleUrls: NewsletterExampleUrls
}

export const SubscribePage = ({
    baseUrl,
    newsletterExampleUrls,
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
                        __html: `window._OWID_NEWSLETTER_EXAMPLES = ${JSON.stringify(newsletterExampleUrls)}`,
                    }}
                ></script>
            </Head>
            <body>
                <SiteHeader />
                <main className="subscribe-page grid grid-cols-12-full-width">
                    <h1 className="subscribe-page__heading display-2-semibold span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2">
                        Subscribe to our newsletters
                    </h1>
                    <div className="span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2">
                        <div id={SUBSCRIBE_PAGE_FORM_CONTAINER_ID}>
                            <NewsletterSubscriptionForm
                                context={
                                    NewsletterSubscriptionContext.SubscribePage
                                }
                                exampleUrls={newsletterExampleUrls}
                            />
                        </div>
                        <OwidSocials
                            includeRss
                            context={
                                NewsletterSubscriptionContext.SubscribePage
                            }
                        />
                    </div>
                </main>
                <SiteFooter context={SiteFooterContext.subscribePage} />
            </body>
        </Html>
    )
}
