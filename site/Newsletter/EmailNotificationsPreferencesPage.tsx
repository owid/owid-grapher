import { Head } from "../Head.js"
import { Html } from "../Html.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import {
    PREFERENCES_PAGE_ROOT_ID,
    SiteFooterContext,
} from "@ourworldindata/types"

export interface EmailNotificationsPreferencesPageProps {
    baseUrl: string
    topicAreaNames: string[]
}

/**
 * The magic-link update-preferences page. Everything inside <main> is rendered
 * client-side (EmailNotificationsPreferencesForm), driven by the token in the
 * URL fragment - including the page heading, which the terminal screens replace.
 * This shell just bakes the topic area names the form needs.
 */
export const EmailNotificationsPreferencesPage = ({
    baseUrl,
    topicAreaNames,
}: EmailNotificationsPreferencesPageProps) => {
    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/preferences`}
                pageTitle="Update your email preferences"
                pageDesc="View and update your Our World in Data email notification preferences."
                baseUrl={baseUrl}
            >
                <meta name="robots" content="noindex" />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_TOPIC_AREA_NAMES = ${JSON.stringify(topicAreaNames)}`,
                    }}
                ></script>
            </Head>
            <body className="sticky-footer-body">
                <SiteHeader />
                <main
                    id={PREFERENCES_PAGE_ROOT_ID}
                    className="subscribe-page grid grid-cols-12-full-width"
                ></main>
                <SiteFooter context={SiteFooterContext.subscribePage} />
            </body>
        </Html>
    )
}
