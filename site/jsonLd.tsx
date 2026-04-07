import {
    DataPageDataV2,
    GrapherInterface,
    OwidGdocType,
    spansToUnformattedPlainText,
} from "@ourworldindata/utils"
import {
    OwidGdocAuthorInterface,
    OwidGdocDataInsightInterface,
    OwidGdocPostInterface,
    OwidGdocProfileInterface,
} from "@ourworldindata/types"
import { getCanonicalUrl } from "@ourworldindata/components"
import type {
    Article,
    ImageObject,
    Organization,
    Person,
    ProfilePage,
    Thing,
    WebPage,
    WithContext,
} from "schema-dts"
import {
    makeJsonLdCreator,
    makeJsonLdGrapherCreditText,
} from "./jsonLdHelpers.js"

function JsonLdScript({ data }: { data: WithContext<Thing> }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(data),
            }}
        />
    )
}

type JsonLdAuthor = Person | Organization

function makeJsonLdAuthors(
    baseUrl: string,
    gdoc:
        | OwidGdocPostInterface
        | OwidGdocProfileInterface
        | OwidGdocDataInsightInterface
): JsonLdAuthor[] {
    return gdoc.content.authors.map((gdocAuthor) => {
        if (gdocAuthor.toLowerCase().includes("our world in data")) {
            return makeJsonLdCreator(baseUrl)
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

export function JsonLdDataPage({
    baseUrl,
    grapher,
    datapageData,
    canonicalUrl,
    imageUrl,
}: {
    baseUrl: string
    grapher: GrapherInterface | undefined
    datapageData?: DataPageDataV2
    canonicalUrl: string
    imageUrl?: string
}) {
    const image: ImageObject | undefined = imageUrl
        ? {
              "@type": "ImageObject",
              contentUrl: imageUrl,
              creator: makeJsonLdCreator(baseUrl),
              creditText: makeJsonLdGrapherCreditText(grapher, datapageData),
              copyrightNotice: "Our World in Data",
              license: "https://creativecommons.org/licenses/by/4.0/",
              acquireLicensePage: `${baseUrl}/faqs#can-i-reuse-or-republish-your-charts`,
          }
        : undefined

    const data: WithContext<WebPage> = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        url: canonicalUrl,
        image,
    }

    return <JsonLdScript data={data} />
}

export function JsonLdArticle({
    gdoc,
    baseUrl,
    imageUrl,
}: {
    gdoc:
        | OwidGdocPostInterface
        | OwidGdocProfileInterface
        | OwidGdocDataInsightInterface
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
    return <JsonLdScript data={data} />
}

export function JsonLdProfilePage({
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
    return <JsonLdScript data={data} />
}
