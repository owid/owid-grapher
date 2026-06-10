import * as _ from "lodash-es"
import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { CitationMeta } from "../CitationMeta.js"
import { OwidGdoc } from "./OwidGdoc.js"
import {
    checkIsAuthor,
    checkIsDataInsight,
    getFeaturedImageFilename,
    OwidGdoc as OwidGdocUnionType,
    SiteFooterContext,
    OwidGdocType,
    spansToUnformattedPlainText,
    extractGdocPageData,
    OwidGdocPageData,
    readFromAssetMap,
} from "@ourworldindata/utils"
import { getCanonicalUrl, getPageTitle } from "@ourworldindata/components"
import { DebugProvider } from "./DebugProvider.js"
import { match, P } from "ts-pattern"
import {
    ARCHIVED_THUMBNAIL_FILENAME,
    ArchiveContext,
    OwidGdocDataInsightInterface,
    OwidGdocPostInterface,
    OwidGdocProfileInterface,
} from "@ourworldindata/types"
import {
    DATA_INSIGHT_ATOM_FEED_PROPS,
    DEFAULT_ATOM_FEED_PROPS,
} from "../SiteConstants.js"
import { Html } from "../Html.js"
import { CLOUDFLARE_IMAGES_URL } from "../../settings/clientSettings.js"
import { addPreferSmallFilenameToDataInsightImages } from "../gdocs/utils.js"
import { AriaAnnouncerProvider } from "../AriaAnnouncerContext.js"
import { AriaAnnouncer } from "../AriaAnnouncer.js"
import { JsonLdArticle, JsonLdProfilePage } from "../jsonLd.js"

declare global {
    interface Window {
        _OWID_GDOC_PROPS: OwidGdocPageData
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
                        OwidGdocType.AboutPage,
                        OwidGdocType.Announcement
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
            )
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
        .with({ content: { type: OwidGdocType.Profile } }, (gdoc) => {
            return gdoc.content.excerpt
        })
        .with(
            {
                content: {
                    type: P.optional(P.union(OwidGdocType.Fragment)),
                },
            },
            () => ""
        )
        .exhaustive()
}

function isPostPredicate(
    gdoc: OwidGdocUnionType
): gdoc is OwidGdocPostInterface {
    return (
        gdoc.content.type === OwidGdocType.Article ||
        gdoc.content.type === OwidGdocType.TopicPage ||
        gdoc.content.type === OwidGdocType.LinearTopicPage
    )
}

function isProfilePredicate(
    gdoc: OwidGdocUnionType
): gdoc is OwidGdocProfileInterface {
    return gdoc.content.type === OwidGdocType.Profile
}

function isJsonLdArticlePredicate(
    gdoc: OwidGdocUnionType
): gdoc is
    | OwidGdocPostInterface
    | OwidGdocProfileInterface
    | OwidGdocDataInsightInterface {
    return (
        isPostPredicate(gdoc) ||
        isProfilePredicate(gdoc) ||
        checkIsDataInsight(gdoc)
    )
}

function getAtomFeedProps(gdoc: OwidGdocUnionType): {
    title: string
    href: string
} {
    if (gdoc.content.type === OwidGdocType.DataInsight)
        return DATA_INSIGHT_ATOM_FEED_PROPS

    if (
        [OwidGdocType.TopicPage, OwidGdocType.LinearTopicPage].includes(
            gdoc.content.type!
        ) &&
        gdoc.tags?.[0]
    ) {
        const topicName = gdoc.tags[0].name
        return {
            title: `Atom feed for ${topicName}`,
            href: `/atom.xml?topics=${encodeURIComponent(topicName)}`,
        }
    }

    return DEFAULT_ATOM_FEED_PROPS
}

export default function OwidGdocPage({
    baseUrl,
    gdoc,
    debug,
    isPreviewing = false,
    archiveContext,
}: {
    baseUrl: string
    gdoc: OwidGdocUnionType
    debug?: boolean
    isPreviewing?: boolean
    archiveContext?: ArchiveContext
}) {
    const { content, createdAt, publishedAt } = gdoc

    const pageDesc = getPageDesc(gdoc)
    const featuredImageFilename = getFeaturedImageFilename(gdoc)
    const canonicalUrl = getCanonicalUrl(baseUrl, gdoc)
    const pageTitle = getPageTitle(gdoc)
    const isOnArchivalPage = archiveContext?.type === "archive-page"
    const assetMaps = isOnArchivalPage ? archiveContext.assets : undefined
    const isDataInsight = checkIsDataInsight(gdoc)
    const isAuthor = checkIsAuthor(gdoc)
    const isJsonLdArticle = isJsonLdArticlePredicate(gdoc)

    let imageUrl
    if (
        gdoc.content.type === OwidGdocType.Article &&
        gdoc.content["deprecation-notice"]
    ) {
        imageUrl = `${baseUrl}/${ARCHIVED_THUMBNAIL_FILENAME}`
    } else if (featuredImageFilename) {
        const cloudflareId = _.get(gdoc, [
            "imageMetadata",
            featuredImageFilename,
            "cloudflareId",
        ])
        if (cloudflareId) {
            // "public" is a hard-coded variant that doesn't need to know the image's width
            const fallbackUrl = `${CLOUDFLARE_IMAGES_URL}/${cloudflareId}/public`
            imageUrl = readFromAssetMap(assetMaps?.runtime, {
                path: featuredImageFilename,
                fallback: fallbackUrl,
            })
        }
    }

    if (gdoc.content.type === OwidGdocType.DataInsight) {
        addPreferSmallFilenameToDataInsightImages(gdoc.content)
    }

    return (
        <Html>
            <Head
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                canonicalUrl={canonicalUrl}
                imageUrl={imageUrl} // uriEncoding is taken care of inside the Head component
                atom={getAtomFeedProps(gdoc)}
                baseUrl={baseUrl}
                staticAssetMap={assetMaps?.static}
                archiveContext={archiveContext}
            >
                {!isAuthor && !isDataInsight && (
                    <CitationMeta
                        title={content.title || ""}
                        authors={content.authors}
                        date={publishedAt || createdAt}
                        canonicalUrl={canonicalUrl}
                    />
                )}
                {isJsonLdArticle && (
                    <JsonLdArticle
                        gdoc={gdoc}
                        baseUrl={baseUrl}
                        imageUrl={imageUrl}
                    />
                )}
                {isAuthor && (
                    <JsonLdProfilePage
                        gdoc={gdoc}
                        baseUrl={baseUrl}
                        imageUrl={imageUrl}
                    />
                )}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_GDOC_PROPS = ${JSON.stringify(
                            extractGdocPageData(gdoc)
                        )}`,
                    }}
                ></script>
            </Head>
            <body>
                <SiteHeader
                    isOnHomepage={gdoc.content.type === OwidGdocType.Homepage}
                    archiveInfo={isOnArchivalPage ? archiveContext : undefined}
                    isPreviewing={isPreviewing}
                />
                <div id="owid-document-root">
                    <AriaAnnouncerProvider>
                        <DebugProvider debug={debug}>
                            <OwidGdoc
                                {...gdoc}
                                isPreviewing={isPreviewing}
                                archiveContext={archiveContext}
                            />
                        </DebugProvider>
                        <AriaAnnouncer />
                    </AriaAnnouncerProvider>
                </div>
                <SiteFooter
                    context={SiteFooterContext.gdocsDocument}
                    debug={debug}
                    isPreviewing={isPreviewing}
                    archiveContext={archiveContext}
                />
            </body>
        </Html>
    )
}
