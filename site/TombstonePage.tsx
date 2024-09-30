import cx from "classnames"
import * as React from "react"
import urljoin from "url-join"

import { TombstonePageData } from "@ourworldindata/types"
import { DEFAULT_TOMBSTONE_REASON } from "./SiteConstants.js"
import { Head } from "./Head"
import { Html } from "./Html"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"
import NotFoundPageIcon from "./NotFoundPageIcon"
import { ProminentLink } from "./gdocs/components/ProminentLink.js"
import { getLayout } from "./gdocs/components/ArticleBlock.js"

export default function TombstonePage({
    baseUrl,
    tombstone: { reason, relatedLink, slug },
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
                        {!relatedLink && (
                            <p className="body-3-medium">
                                If you’d still like to view this page, you can
                                find it{" "}
                                <a
                                    href={`https://web.archive.org/web/*/${oldUrl}`}
                                >
                                    here
                                </a>
                                .
                            </p>
                        )}
                    </div>
                    {/* Needs to be outside the NotFoundPage__copy to not have
                    styles overridden. */}
                    {relatedLink && (
                        <ProminentLink
                            className={cx(
                                getLayout("prominent-link"),
                                "NotFoundPage__prominent-link"
                            )}
                            url={relatedLink}
                        />
                    )}
                </main>
                <SiteFooter hideDonate={true} baseUrl={baseUrl} />
            </body>
        </Html>
    )
}
