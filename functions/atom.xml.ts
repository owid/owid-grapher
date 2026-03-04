import * as Sentry from "@sentry/cloudflare"
import { OwidGdocType, SearchIndexName } from "@ourworldindata/types"
import { getCanonicalUrl } from "@ourworldindata/components"
import { Env } from "./_common/env.js"
import {
    getAlgoliaConfig,
    AlgoliaConfig,
    getIndexName,
} from "./api/search/algoliaClient.js"
import { formatTopicFacetFilters } from "./api/search/searchApi.js"

const ALLOWED_FEED_PAGE_TYPES = new Set<string>([
    OwidGdocType.Article,
    OwidGdocType.TopicPage,
    OwidGdocType.LinearTopicPage,
    OwidGdocType.DataInsight,
    OwidGdocType.AboutPage,
    OwidGdocType.Announcement,
])

const HITS_PER_FEED = 50

const FEED_ATTRIBUTES = [
    "title",
    "slug",
    "type",
    "excerpt",
    "date",
    "authors",
    "thumbnailUrl",
]

interface FeedHit {
    title: string
    slug: string
    type: string
    excerpt?: string
    date?: string
    authors?: string[]
    thumbnailUrl?: string
}

async function queryChronologicalPages(
    config: AlgoliaConfig,
    pageTypes: string[] | undefined,
    topicFacetFilters: (string | string[])[]
): Promise<FeedHit[]> {
    const indexName = getIndexName(
        SearchIndexName.PagesChronological,
        config.indexPrefix
    )

    const filters = pageTypes?.length
        ? pageTypes.map((type) => `type:${type}`).join(" OR ")
        : undefined
    const facetFilters = topicFacetFilters.length
        ? topicFacetFilters
        : undefined

    const searchParams = {
        requests: [
            {
                indexName,
                query: "",
                ...(filters && { filters }),
                ...(facetFilters && {
                    facetFilters,
                }),
                attributesToRetrieve: FEED_ATTRIBUTES,
                hitsPerPage: HITS_PER_FEED,
            },
        ],
    }

    const url = `https://${config.appId}-dsn.algolia.net/1/indexes/*/queries`

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "X-Algolia-Application-Id": config.appId,
            "X-Algolia-API-Key": config.apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(searchParams),
    })

    if (!response.ok) {
        throw new Error(`Algolia search failed: ${response.statusText}`)
    }

    const data = (await response.json()) as {
        results: [{ hits: FeedHit[] }]
    }

    return data.results[0].hits
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

function makeFeedTitle(topics: string[]): string {
    const title = topics.length
        ? `Our World in Data - ${topics.join(", ")}`
        : "Our World in Data"
    return escapeXml(title)
}

function makeFeedUpdated(dateStr?: string): string {
    const date = dateStr ? new Date(dateStr) : new Date()
    return date.toISOString()
}

function makeEntryPublished(dateStr?: string): string {
    if (!dateStr) return ""
    return `<published>${new Date(dateStr).toISOString()}</published>`
}

function makeEntryAuthors(authors: string[]): string {
    return authors
        .map((a) => `<author><name>${escapeXml(a)}</name></author>`)
        .join("")
}

function makeEntrySummary(postUrl: string, hit: FeedHit): string {
    const thumbnailImg = hit.thumbnailUrl
        ? `<br/><br/><a href="${escapeXml(postUrl)}"><img src="${escapeXml(hit.thumbnailUrl)}"/></a>`
        : ""
    if (!hit.excerpt && !thumbnailImg) return ""
    return `<summary type="html"><![CDATA[${hit.excerpt ?? ""}${thumbnailImg}]]></summary>`
}

function makeEntry(hit: FeedHit, baseUrl: string): string {
    const postUrl = getCanonicalUrl(baseUrl, {
        slug: hit.slug,
        content: { type: hit.type as OwidGdocType },
    })
    return `<entry>
    <title>${escapeXml(hit.title)}</title>
    <id>${escapeXml(postUrl)}</id>
    <link rel="alternate" href="${escapeXml(postUrl)}"/>
    ${makeEntryPublished(hit.date)}
    ${makeEntryAuthors(hit.authors ?? [])}
    ${makeEntrySummary(postUrl, hit)}
</entry>`
}

function generateAtomFeed(
    hits: FeedHit[],
    baseUrl: string,
    feedUrl: string,
    topics: string[]
): string {
    const title = makeFeedTitle(topics)
    const updated = makeFeedUpdated(hits[0]?.date)
    const entries = hits.map((hit) => makeEntry(hit, baseUrl)).join("\n")

    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>${title}</title>
<subtitle>Research and data to make progress against the world’s largest problems</subtitle>
<id>${escapeXml(baseUrl)}/</id>
<link type="text/html" rel="alternate" href="${escapeXml(baseUrl)}"/>
<link type="application/atom+xml" rel="self" href="${escapeXml(feedUrl)}"/>
<updated>${updated}</updated>
${entries}
</feed>`
}

function parseTopics(param: string | null): string[] {
    if (!param) return []
    return param
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
}

function parsePageTypes(param: string | null): string[] | undefined {
    if (!param) return undefined
    return param
        .split(",")
        .map((t) => t.trim())
        .filter((t) => ALLOWED_FEED_PAGE_TYPES.has(t))
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { request, env } = context
    const url = new URL(request.url)

    const topicsParam = url.searchParams.get("topics")
    const typeParam = url.searchParams.get("type")

    // No query params — fall through to the static baked atom.xml
    if (!topicsParam && !typeParam) {
        return context.next()
    }

    try {
        const topics = parseTopics(topicsParam)
        const pageTypes = parsePageTypes(typeParam)

        if (typeParam && pageTypes?.length === 0) {
            return new Response(
                `Invalid type parameter. Allowed types: ${[...ALLOWED_FEED_PAGE_TYPES].join(", ")}`,
                { status: 400, headers: { "Content-Type": "text/plain" } }
            )
        }

        const algoliaConfig = getAlgoliaConfig(env)
        const baseUrl = `${url.protocol}//${url.host}`
        const feedUrl = `${baseUrl}${url.pathname}${url.search}`

        const topicFacetFilters =
            topics.length > 0 ? formatTopicFacetFilters(new Set(topics)) : []

        const hits = await queryChronologicalPages(
            algoliaConfig,
            pageTypes,
            topicFacetFilters
        )

        const feed = generateAtomFeed(hits, baseUrl, feedUrl, topics)

        return new Response(feed, {
            status: 200,
            headers: {
                "Content-Type": "application/atom+xml; charset=utf-8",
                "Cache-Control": "public, max-age=600",
                "Access-Control-Allow-Origin": "*",
            },
        })
    } catch (error) {
        console.error("Atom feed error:", error)
        Sentry.captureException(error)

        return new Response(
            `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Error</title>
<subtitle>An error occurred while generating the feed</subtitle>
</feed>`,
            {
                status: 500,
                headers: {
                    "Content-Type": "application/atom+xml; charset=utf-8",
                },
            }
        )
    }
}
