import React from "react"

import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { CitationMeta } from "../CitationMeta.js"
import { OwidDocument } from "./OwidDocument.js"
import { get } from "lodash"

import { OwidDocumentInterface, SiteFooterContext } from "@ourworldindata/utils"
import { DebugProvider } from "./DebugContext.js"

declare global {
    interface Window {
        _OWID_DOCUMENT_PROPS: any
    }
}

export default function OwidDocumentPage({
    baseUrl,
    document,
    debug,
    isPreviewing = false,
}: {
    baseUrl: string
    document: OwidDocumentInterface
    debug?: boolean
    isPreviewing?: boolean
}) {
    const { content, slug, createdAt, updatedAt } = document

    const canonicalUrl = `${baseUrl}/${slug}`

    return (
        <html>
            <Head
                pageTitle={content.title}
                pageDesc={content.subtitle}
                canonicalUrl={canonicalUrl}
                imageUrl={get(
                    content,
                    ["featured-image", 0, "value", "src"],
                    ""
                )}
                baseUrl={baseUrl}
            >
                <CitationMeta
                    title={content.title || ""}
                    authors={
                        Array.isArray(content.byline)
                            ? content.byline
                            : content.byline
                            ? [content.byline]
                            : []
                    }
                    date={updatedAt || createdAt}
                    canonicalUrl={canonicalUrl}
                />

                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_DOCUMENT_PROPS = ${JSON.stringify(
                            document
                        )}`,
                    }}
                ></script>
            </Head>
            <body>
                <SiteHeader baseUrl={baseUrl} />
                <div id="owid-document-root">
                    <DebugProvider debug={debug}>
                        <OwidDocument
                            {...document}
                            isPreviewing={isPreviewing}
                        />
                    </DebugProvider>
                </div>
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.gdocsDocument}
                    debug={debug}
                    isPreviewing={isPreviewing}
                />
            </body>
        </html>
    )
}
