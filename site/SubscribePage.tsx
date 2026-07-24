import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { Head } from "./Head.js"
import { Html } from "./Html.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import {
    SiteFooterContext,
    SUBSCRIBE_PAGE_NOTIFICATIONS_FORM_CONTAINER_ID,
    TagGraphRoot,
} from "@ourworldindata/types"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import { EmailNotificationsSubscribeForm } from "./EmailNotificationsSubscribeForm.js"
import { OwidSocials } from "./OwidSocials.js"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"

export interface SubscribePageProps {
    baseUrl: string
    topicTagGraph: TagGraphRoot
}

const CONTENT_GRID_CLASSES =
    "span-cols-6 col-start-4 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2"

export const SubscribePage = ({
    baseUrl,
    topicTagGraph,
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
                        __html: `window._OWID_TOPIC_TAG_GRAPH = ${JSON.stringify(topicTagGraph)}`,
                    }}
                ></script>
            </Head>
            <body>
                <SiteHeader />
                <main className="subscribe-page grid grid-cols-12-full-width">
                    <header className="subscribe-page__hero grid grid-cols-12-full-width span-cols-14 col-start-1">
                        <div className={CONTENT_GRID_CLASSES}>
                            <h1 className="subscribe-page__heading">
                                Subscribe to our newsletters
                            </h1>
                            <p className="subscribe-page__subheading">
                                Receive our latest work by email.
                            </p>
                        </div>
                    </header>
                    <div
                        className={`subscribe-page__content ${CONTENT_GRID_CLASSES}`}
                    >
                        <div
                            id={SUBSCRIBE_PAGE_NOTIFICATIONS_FORM_CONTAINER_ID}
                        >
                            <EmailNotificationsSubscribeForm
                                topicTagGraph={topicTagGraph}
                            />
                        </div>
                    </div>
                    <aside className="subscribe-page__aside span-cols-3 col-start-11 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2">
                        <p className="subscribe-page__aside-heading h6-black-caps">
                            Already subscribed?
                        </p>
                        <a
                            className="subscribe-page__manage-link"
                            href="/subscribe/preferences"
                        >
                            Update your preferences{" "}
                            <FontAwesomeIcon icon={faArrowRight} />
                        </a>
                    </aside>
                    <hr className="subscribe-page__divider span-cols-12 col-start-2" />
                    <div
                        className={`subscribe-page__socials ${CONTENT_GRID_CLASSES}`}
                    >
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
