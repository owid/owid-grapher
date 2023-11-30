import React from "react"
import path from "path"
import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { CitationMeta } from "../CitationMeta.js"
import { OwidGdoc } from "./OwidGdoc.js"

import {
    OwidGdocPostInterface,
    SiteFooterContext,
    getFilenameAsPng,
    IMAGES_DIRECTORY,
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
    gdoc: OwidGdocPostInterface
    debug?: boolean
    isPreviewing?: boolean
}) {
    const { content, slug, createdAt, updatedAt } = gdoc

    // Social media platforms don't support SVG's for og:image
    // So no matter what, we use the png fallback that the baker generates
    const featuredImageUrl =
        content["featured-image"] &&
        new URL(
            path.join(
                IMAGES_DIRECTORY,
                getFilenameAsPng(content["featured-image"])
            ),
            baseUrl
        ).href
    const canonicalUrl = `${baseUrl}/${slug}`

    return (
        <html>
            <Head
                pageTitle={content.title}
                pageDesc={content.excerpt}
                canonicalUrl={canonicalUrl}
                imageUrl={
                    featuredImageUrl ? encodeURI(featuredImageUrl) : undefined
                }
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
