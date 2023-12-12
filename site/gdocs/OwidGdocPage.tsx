import React from "react"
import path from "path"
import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { CitationMeta } from "../CitationMeta.js"
import { OwidGdoc } from "./OwidGdoc.js"

import {
    OwidGdoc as OwidGdocUnionType,
    SiteFooterContext,
    getFilenameAsPng,
    IMAGES_DIRECTORY,
    OwidGdocType,
} from "@ourworldindata/utils"
import { DebugProvider } from "./DebugContext.js"
import { match, P } from "ts-pattern"

declare global {
    interface Window {
        _OWID_GDOC_PROPS: any
    }
}

function getFeaturedImageUrl(
    gdoc: OwidGdocUnionType,
    baseUrl: string
): string | undefined {
    return match(gdoc)
        .with(
            {
                content: {
                    type: P.union(
                        OwidGdocType.Article,
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage
                    ),
                },
            },
            (match) => {
                const featuredImageSlug = match.content["featured-image"]
                if (!featuredImageSlug) return "default-thumbnail.jpg"
                // Social media platforms don't support SVG's for og:image
                // So no matter what, we use the png fallback that the baker generates
                return new URL(
                    path.join(
                        IMAGES_DIRECTORY,
                        getFilenameAsPng(featuredImageSlug)
                    ),
                    baseUrl
                ).href
            }
        )
        .with({ content: { type: OwidGdocType.DataInsight } }, () => {
            // TODO: get the right image, at the right size
            return "default-thumbnail.jpg"
        })
        .with(
            { content: { type: P.union(OwidGdocType.Fragment, undefined) } },
            () => {
                return undefined
            }
        )
        .exhaustive()
}

function getPageDesc(gdoc: OwidGdocUnionType): string | undefined {
    return match(gdoc)
        .with(
            {
                content: {
                    type: P.union(
                        OwidGdocType.Article,
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage
                    ),
                },
            },
            (match) => {
                return match.content.excerpt
            }
        )
        .with({ content: { type: OwidGdocType.DataInsight } }, () => {
            // TODO: what do we put here?
            return undefined
        })
        .with(
            { content: { type: P.union(OwidGdocType.Fragment, undefined) } },
            () => {
                return ""
            }
        )
        .exhaustive()
}

export default function OwidGdocPage({
    baseUrl,
    gdoc,
    debug,
    isPreviewing = false,
}: {
    baseUrl: string
    gdoc: OwidGdocUnionType
    debug?: boolean
    isPreviewing?: boolean
}) {
    const { content, slug, createdAt, updatedAt } = gdoc

    const pageDesc = getPageDesc(gdoc)
    const featuredImageUrl = getFeaturedImageUrl(gdoc, baseUrl)
    const canonicalUrl = `${baseUrl}/${slug}`

    return (
        <html>
            <Head
                pageTitle={content.title}
                pageDesc={pageDesc}
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
