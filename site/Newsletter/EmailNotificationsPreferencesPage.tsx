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
}

/**
 * The magic-link update-preferences page. Everything inside <main> is rendered
 * client-side (EmailNotificationsPreferencesForm), driven by the token in the
 * URL fragment - including the page heading, which the terminal screens replace.
 */
export const EmailNotificationsPreferencesPage = ({
    baseUrl,
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
