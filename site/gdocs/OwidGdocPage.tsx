import React from "react"
import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { CitationMeta } from "../CitationMeta.js"
import { OwidGdoc } from "./OwidGdoc.js"
import {
    getFeaturedImageFilename,
    OwidGdoc as OwidGdocUnionType,
    SiteFooterContext,
    OwidGdocType,
    spansToUnformattedPlainText,
    get,
} from "@ourworldindata/utils"
import { getCanonicalUrl, getPageTitle } from "@ourworldindata/components"
import { DebugProvider } from "./DebugContext.js"
import { match, P } from "ts-pattern"
import {
    ARCHVED_THUMBNAIL_FILENAME,
    EnrichedBlockText,
} from "@ourworldindata/types"
import { DATA_INSIGHT_ATOM_FEED_PROPS } from "../SiteConstants.js"
import { Html } from "../Html.js"
import { CLOUDFLARE_IMAGES_URL } from "../../settings/clientSettings.js"

declare global {
    interface Window {
        _OWID_GDOC_PROPS: any
    }
}

function getPageDesc(gdoc: OwidGdocUnionType): string | undefined {
    return match(gdoc)
        .with(
            {
                content: {
                    type: P.union(
                        OwidGdocType.Article,
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage,
                        OwidGdocType.AboutPage
                    ),
                },
            },
            (match) => {
                return match.content.excerpt
            }
        )
        .with({ content: { type: OwidGdocType.DataInsight } }, (match) => {
            const firstParagraph = match.content.body.find(
                (block) => block.type === "text"
            ) as EnrichedBlockText | undefined
            // different platforms truncate at different lengths, let's leave it up to them
            return firstParagraph
                ? spansToUnformattedPlainText(firstParagraph.value)
                : undefined
        })
        .with({ content: { type: OwidGdocType.Homepage } }, () => {
            return "Research and data to make progress against the world’s largest problems"
        })
        .with({ content: { type: OwidGdocType.Author } }, (gdoc) => {
            return gdoc.content.bio
                ? spansToUnformattedPlainText(
                      gdoc.content.bio.flatMap((block) => block.value)
                  )
                : undefined
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
    const { content, createdAt, updatedAt } = gdoc

    const pageDesc = getPageDesc(gdoc)
    const featuredImageFilename = getFeaturedImageFilename(gdoc)
    const canonicalUrl = getCanonicalUrl(baseUrl, gdoc)
    const pageTitle = getPageTitle(gdoc)
    const isDataInsight = gdoc.content.type === OwidGdocType.DataInsight
    const isAuthor = gdoc.content.type === OwidGdocType.Author

    let imageUrl
    if (
        gdoc.content.type === OwidGdocType.Article &&
        gdoc.content["deprecation-notice"]
    ) {
        imageUrl = `${baseUrl}/${ARCHVED_THUMBNAIL_FILENAME}`
    } else if (featuredImageFilename) {
        const cloudflareId = get(gdoc, [
            "imageMetadata",
            featuredImageFilename,
            "cloudflareId",
        ])
        if (cloudflareId) {
            // "public" is a hard-coded variant that doesn't need to know the image's width
            imageUrl = `${CLOUDFLARE_IMAGES_URL}/${cloudflareId}/public`
        }
    }

    return (
        <Html>
            <Head
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                canonicalUrl={canonicalUrl}
                imageUrl={imageUrl} // uriEncoding is taken care of inside the Head component
                atom={isDataInsight ? DATA_INSIGHT_ATOM_FEED_PROPS : undefined}
                baseUrl={baseUrl}
            >
                {!isAuthor && !isDataInsight && (
                    <CitationMeta
                        title={content.title || ""}
                        authors={content.authors}
                        date={updatedAt || createdAt}
                        canonicalUrl={canonicalUrl}
                    />
                )}

                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_GDOC_PROPS = ${JSON.stringify(
                            gdoc
                        )}`,
                    }}
                ></script>
            </Head>
            <body>
                <SiteHeader
                    baseUrl={baseUrl}
                    isOnHomepage={gdoc.content.type === OwidGdocType.Homepage}
                />
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
        </Html>
    )
}
