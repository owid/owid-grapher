import { Head } from "./Head.js"
import { Html } from "./Html.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import {
    PREFERENCES_PAGE_FORM_CONTAINER_ID,
    SiteFooterContext,
    TagGraphRoot,
} from "@ourworldindata/types"

export interface EmailNotificationsPreferencesPageProps {
    baseUrl: string
    topicTagGraph: TagGraphRoot
}

/**
 * The magic-link update-preferences page. Everything interesting happens
 * client-side (EmailNotificationsPreferencesForm), driven by the token in the
 * URL fragment; this shell just bakes the topic tag graph the form needs.
 */
export const EmailNotificationsPreferencesPage = ({
    baseUrl,
    topicTagGraph,
}: EmailNotificationsPreferencesPageProps) => {
    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/subscribe/preferences`}
                pageTitle="Update your email preferences"
                pageDesc="View and update your Our World in Data email notification preferences."
                baseUrl={baseUrl}
            >
                <meta name="robots" content="noindex" />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_TOPIC_TAG_GRAPH = ${JSON.stringify(topicTagGraph)}`,
                    }}
                ></script>
            </Head>
            <body>
                <SiteHeader />
                <main className="subscribe-page grid grid-cols-12-full-width">
                    <h1 className="subscribe-page__heading display-2-semibold span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2">
                        Update your email preferences
                    </h1>
                    <div className="span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2">
                        <div id={PREFERENCES_PAGE_FORM_CONTAINER_ID}></div>
                    </div>
                </main>
                <SiteFooter context={SiteFooterContext.subscribePage} />
            </body>
        </Html>
    )
}
