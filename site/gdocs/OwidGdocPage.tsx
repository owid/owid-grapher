import React from "react"
import path from "path"
import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { CitationMeta } from "../CitationMeta.js"
import { OwidGdoc } from "./OwidGdoc.js"

import {
    OwidGdocInterface,
    SiteFooterContext,
    getFilenameWithoutExtension,
} from "@ourworldindata/utils"
import { DebugProvider } from "./DebugContext.js"

declare global {
    interface Window {
        _OWID_GDOC_PROPS: any
    }
}

export default function OwidGdocPage({
    baseUrl,
    gdoc,
    debug,
    isPreviewing = false,
}: {
    baseUrl: string
    gdoc: OwidGdocInterface
    debug?: boolean
    isPreviewing?: boolean
}) {
    const { content, slug, createdAt, updatedAt } = gdoc

    const featuredImageUrl =
        content["featured-image"] &&
        path.join(
            baseUrl,
            "images",
            "published",
            `${getFilenameWithoutExtension(content["featured-image"])}.png`
        )
    const canonicalUrl = `${baseUrl}/${slug}`

    return (
        <html>
            <Head
                pageTitle={content.title}
                pageDesc={content.subtitle}
                canonicalUrl={canonicalUrl}
                imageUrl={featuredImageUrl}
                baseUrl={baseUrl}
            >
                <CitationMeta
                    title={content.title || ""}
                    authors={content.authors}
                    date={updatedAt || createdAt}
                    canonicalUrl={canonicalUrl}
                />

                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_GDOC_PROPS = ${JSON.stringify(
                            gdoc
                        )}`,
                    }}
                ></script>
            </Head>
            <body>
                <SiteHeader baseUrl={baseUrl} />
                <div id="owid-document-root">
                    <DebugProvider debug={debug}>
                        <OwidGdoc {...gdoc} isPreviewing={isPreviewing} />
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
