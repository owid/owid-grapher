import * as _ from "lodash-es"
import type {
    Article,
    ProfilePage,
    Person,
    Organization,
    WithContext,
} from "schema-dts"
import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { CitationMeta } from "../CitationMeta.js"
import { OwidGdoc } from "./OwidGdoc.js"
import {
    checkIsAuthor,
    getFeaturedImageFilename,
    OwidGdoc as OwidGdocUnionType,
    SiteFooterContext,
    OwidGdocType,
    spansToUnformattedPlainText,
    extractGdocPageData,
    OwidGdocPageData,
} from "@ourworldindata/utils"
import { getCanonicalUrl, getPageTitle } from "@ourworldindata/components"
import { DebugProvider } from "./DebugProvider.js"
import { match, P } from "ts-pattern"
import {
    ARCHVED_THUMBNAIL_FILENAME,
    EnrichedBlockText,
    OwidGdocPostInterface,
    OwidGdocAuthorInterface,
} from "@ourworldindata/types"
import { DATA_INSIGHT_ATOM_FEED_PROPS } from "../SiteConstants.js"
import { Html } from "../Html.js"
import { CLOUDFLARE_IMAGES_URL } from "../../settings/clientSettings.js"
import { addPreferSmallFilenameToDataInsightImages } from "../gdocs/utils.js"
import { AriaAnnouncerProvider } from "../AriaAnnouncerContext.js"
import { AriaAnnouncer } from "../AriaAnnouncer.js"

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

type JsonLdAuthor = Person | Organization

function makeJsonLdAuthors(
    baseUrl: string,
    gdoc: OwidGdocPostInterface
): JsonLdAuthor[] {
    return gdoc.content.authors.map((gdocAuthor) => {
        if (gdocAuthor.toLowerCase().includes("our world in data")) {
            return {
                "@type": "Organization",
                name: "Our World in Data",
                url: baseUrl,
            } satisfies Organization
        }
        const author: Person = {
            "@type": "Person",
            name: gdocAuthor,
        }
        const linkedAuthor = gdoc.linkedAuthors?.find(
            (linkedAuthor) => linkedAuthor.name === gdocAuthor
        )
        // URLs serve as unique IDs for authors, so we don't use the team page
        // URL for authors, who don't have their own page.
        if (linkedAuthor?.slug) {
            author.url = getCanonicalUrl(baseUrl, {
                slug: linkedAuthor.slug,
                content: { type: OwidGdocType.Author },
            })
        }
        return author
    })
}

function JsonLdArticle({
    gdoc,
    baseUrl,
    imageUrl,
}: {
    gdoc: OwidGdocPostInterface
    baseUrl: string
    imageUrl?: string
}) {
    const data: WithContext<Article> = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: gdoc.content.title,
        image: imageUrl ? [imageUrl] : [],
        // NOTE: We don't set dateModified. We have gdoc.updatedAt, but that's
        // not correct because the semantics of these fields is different.
        // gdoc.updatedAt is the time the gdoc row was updated in the database,
        // even if the content hasn't changed and can be even earlier than
        // gdoc.publishedAt for articles scheduled for publication into the
        // future.
        datePublished: gdoc.publishedAt?.toISOString(),
        author: makeJsonLdAuthors(baseUrl, gdoc),
    }
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(data),
            }}
        />
    )
}

function JsonLdProfilePage({
    gdoc,
    baseUrl,
    imageUrl,
}: {
    gdoc: OwidGdocAuthorInterface
    baseUrl: string
    imageUrl?: string
}) {
    const mainAuthorId = `#${gdoc.slug}`
    const data: WithContext<ProfilePage> = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        // NOTE: We don't set dateModified. We have gdoc.updatedAt, but that's
        // not correct because the semantics of these fields is different.
        // gdoc.updatedAt is the time the gdoc row was updated in the database,
        // even if the content hasn't changed and can be even earlier than
        // gdoc.publishedAt for articles scheduled for publication into the
        // future.
        dateCreated: gdoc.publishedAt?.toISOString(),
        mainEntity: {
            "@id": mainAuthorId,
            "@type": "Person",
            name: gdoc.content.title,
            jobTitle: gdoc.content.role,
            description: gdoc.content.bio
                ?.map((block) => spansToUnformattedPlainText(block.value))
                .join(" "),
            image: imageUrl,
            url: getCanonicalUrl(baseUrl, gdoc),
        },
        hasPart: gdoc.latestWorkLinks?.slice(0, 10).map((work) => {
            return {
                "@type": "Article",
                headline: work.title,
                url: getCanonicalUrl(baseUrl, {
                    slug: work.slug,
                    content: { type: OwidGdocType.Article },
                }),
                datePublished: work.publishedAt,
                author: { "@id": mainAuthorId },
            }
        }),
    }
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(data),
            }}
        />
    )
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
    const { content, createdAt, publishedAt } = gdoc

    const pageDesc = getPageDesc(gdoc)
    const featuredImageFilename = getFeaturedImageFilename(gdoc)
    const canonicalUrl = getCanonicalUrl(baseUrl, gdoc)
    const pageTitle = getPageTitle(gdoc)
    const isDataInsight = gdoc.content.type === OwidGdocType.DataInsight
    const isAuthor = checkIsAuthor(gdoc)
    const isPost = isPostPredicate(gdoc)

    let imageUrl
    if (
        gdoc.content.type === OwidGdocType.Article &&
        gdoc.content["deprecation-notice"]
    ) {
        imageUrl = `${baseUrl}/${ARCHVED_THUMBNAIL_FILENAME}`
    } else if (featuredImageFilename) {
        const cloudflareId = _.get(gdoc, [
            "imageMetadata",
            featuredImageFilename,
            "cloudflareId",
        ])
        if (cloudflareId) {
            // "public" is a hard-coded variant that doesn't need to know the image's width
            imageUrl = `${CLOUDFLARE_IMAGES_URL}/${cloudflareId}/public`
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
                atom={isDataInsight ? DATA_INSIGHT_ATOM_FEED_PROPS : undefined}
                baseUrl={baseUrl}
            >
                {!isAuthor && !isDataInsight && (
                    <CitationMeta
                        title={content.title || ""}
                        authors={content.authors}
                        date={publishedAt || createdAt}
                        canonicalUrl={canonicalUrl}
                    />
                )}
                {isPost && (
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
                />
                <div id="owid-document-root">
                    <AriaAnnouncerProvider>
                        <DebugProvider debug={debug}>
                            <OwidGdoc {...gdoc} isPreviewing={isPreviewing} />
                        </DebugProvider>
                        <AriaAnnouncer />
                    </AriaAnnouncerProvider>
                </div>
                <SiteFooter
                    context={SiteFooterContext.gdocsDocument}
                    debug={debug}
                    isPreviewing={isPreviewing}
                />
            </body>
        </Html>
    )
}
