import cx from "classnames"
import urljoin from "url-join"

import { TombstonePageData } from "@ourworldindata/types"
import { DEFAULT_TOMBSTONE_REASON } from "./SiteConstants.js"
import { Head } from "./Head"
import { Html } from "./Html"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"
import NotFoundPageIcon from "./NotFoundPageIcon"
import { ProminentLink } from "./gdocs/components/ProminentLink.js"
import { getLayout } from "./gdocs/components/layout.js"

export default function TombstonePage({
    baseUrl,
    tombstone: {
        reason,
        includeArchiveLink,
        relatedLinkUrl,
        relatedLinkTitle,
        relatedLinkDescription,
        relatedLinkThumbnail,
        slug,
    },
}: {
    baseUrl: string
    tombstone: TombstonePageData
}) {
    const canonicalUrl = urljoin(baseUrl, "deleted", slug)
    const oldUrl = urljoin(baseUrl, slug)
    return (
        <Html>
            <Head
                canonicalUrl={canonicalUrl}
                pageTitle="This page was removed"
                baseUrl={baseUrl}
            />
            <body className="NotFoundPage">
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <div className="NotFoundPage__copy">
                        <NotFoundPageIcon />
                        <h1 className="NotFoundPage__heading subtitle-1">
                            This page was removed.
                        </h1>
                        <p className="body-2-semibold">
                            We’re sorry, but the page “{oldUrl}” does not exist
                            anymore.
                        </p>
                        <p className="body-3-medium">
                            {reason || DEFAULT_TOMBSTONE_REASON}
                        </p>
                        {includeArchiveLink && (
                            <p className="body-3-medium">
                                If you’d still like to view this page, you can
                                check its archived copy via the{" "}
                                <a
                                    href={`https://web.archive.org/web/*/${oldUrl}`}
                                >
                                    Internet Archive's Wayback Machine
                                </a>
                                .
                            </p>
                        )}
                    </div>
                    {/* Needs to be outside the NotFoundPage__copy to not have
                    styles overridden. */}
                    {relatedLinkUrl && (
                        <>
                            <h2 className="NotFoundPage__prominent-link-heading">
                                You may be interested in:
                            </h2>
                            <ProminentLink
                                className={cx(
                                    getLayout("prominent-link"),
                                    "NotFoundPage__prominent-link"
                                )}
                                url={relatedLinkUrl}
                                // Use undefined to avoid overriding defaults
                                // from linked GDoc with empty strings.
                                title={relatedLinkTitle || undefined}
                                description={
                                    relatedLinkDescription || undefined
                                }
                                thumbnail={relatedLinkThumbnail || undefined}
                            />
                        </>
                    )}
                </main>
                <SiteFooter hideDonate={true} baseUrl={baseUrl} />
            </body>
        </Html>
    )
}
