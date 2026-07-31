import * as _ from "lodash-es"
import {
    OwidGdoc,
    ContentGraphLinkType,
    OwidGdocType,
} from "@ourworldindata/types"
import {
    spansToUnformattedPlainText,
    gdocUrlRegex,
    Span,
    Url,
    detailOnDemandRegex,
    guidedChartRegex,
    excludeUndefined,
} from "@ourworldindata/utils"
import urlSlug from "url-slug"
import { P, match } from "ts-pattern"

export function getLinkType(urlString: string): ContentGraphLinkType {
    const url = Url.fromURL(urlString)
    if (url.isGoogleDoc) {
        return ContentGraphLinkType.Gdoc
    }
    if (url.isGrapher) {
        return ContentGraphLinkType.Grapher
    }
    if (url.isExplorer) {
        return ContentGraphLinkType.Explorer
    }
    if (url.isDod) {
        return ContentGraphLinkType.Dod
    }
    if (url.isGuidedChart) {
        return ContentGraphLinkType.GuidedChart
    }
    return ContentGraphLinkType.Url
}

export function checkIsInternalLink(url: string): boolean {
    return ["gdoc", "grapher", "explorer"].includes(getLinkType(url))
}

export function getUrlTarget(urlString: string): string {
    const url = Url.fromURL(urlString)
    if (url.isGoogleDoc) {
        const gdocsMatch = urlString.match(gdocUrlRegex)
        if (gdocsMatch) {
            const [_, gdocId] = gdocsMatch
            return gdocId
        }
    }
    if (url.isDod) {
        const dodMatch = urlString.match(detailOnDemandRegex)
        if (dodMatch) {
            const [_, dodId] = dodMatch
            return dodId
        }
    }
    if (url.isGuidedChart) {
        const guidedChartMatch = urlString.match(guidedChartRegex)
        if (guidedChartMatch) {
            const [_, guidedChartId] = guidedChartMatch
            return guidedChartId
        }
    }
    if ((url.isGrapher || url.isExplorer) && url.slug) {
        return url.slug
    }
    return urlString
}

export function convertHeadingTextToId(headingText: Span[]): string {
    return urlSlug(spansToUnformattedPlainText(headingText))
}

export function getPrefixedGdocPath(
    prefix: string,
    gdoc: { slug: string; content: { type?: OwidGdocType } }
): string {
    return match(gdoc)
        .with(
            {
                content: { type: OwidGdocType.Homepage },
            },
            () => prefix
        )
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
            () => `${prefix}/${gdoc.slug}`
        )
        .with(
            {
                content: { type: OwidGdocType.Profile },
            },
            () => `${prefix}/profile/${gdoc.slug}`
        )
        .with(
            {
                content: { type: OwidGdocType.DataInsight },
            },
            () => `${prefix}/data-insights/${gdoc.slug}`
        )
        .with(
            {
                content: { type: OwidGdocType.Author },
            },
            () => `${prefix}/team/${gdoc.slug}`
        )
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

export const getBakePath = (
    bakedSiteDir: string,
    gdoc: { slug: string; content: { type?: OwidGdocType } }
): string => {
    return getPrefixedGdocPath(bakedSiteDir, gdoc)
}

export const getCanonicalUrl = (
    baseUrl: string,
    gdoc: { slug: string; content: { type?: OwidGdocType } }
): string => {
    return getPrefixedGdocPath(baseUrl, gdoc)
}

export const getCanonicalPath = (slug: string, type: OwidGdocType): string => {
    return getCanonicalUrl("", {
        slug,
        content: {
            type,
        },
    })
}

/**
 * Gdoc types that are baked as a reader-facing page of their own and carry
 * enough metadata for a hover preview card.
 *
 * `Fragment` and `Homepage` are excluded because they have no per-document
 * canonical path. `DataInsight` is excluded deliberately even though it does:
 * `OwidGdocDataInsightContent` has no `excerpt`, `subtitle` or
 * `featured-image` field at all, so a card for one could only ever repeat the
 * link text. Its image is the first image block in its body, which isn't part
 * of the minimal-post record we attach.
 */
export const PREVIEWABLE_GDOC_TYPES: OwidGdocType[] = [
    OwidGdocType.Article,
    OwidGdocType.TopicPage,
    OwidGdocType.LinearTopicPage,
    OwidGdocType.AboutPage,
    OwidGdocType.Announcement,
    OwidGdocType.Profile,
    OwidGdocType.Author,
]

/**
 * Path prefixes that `getCanonicalPath` puts in front of a slug. Kept in sync
 * with it by the round-trip test in GdocsUtils.test.ts, which asserts that
 * every previewable type's canonical path parses back to its slug.
 */
const CANONICAL_PATH_PREFIXES = ["profile", "team"]

/**
 * The slugs a canonical path could name — the inverse of `getCanonicalPath`,
 * which isn't injective: `/team/foo` is both the path of the author `foo` and
 * (in principle) of an article whose slug is literally `team/foo`. Article
 * slugs really do contain slashes, e.g. `sdgs/no-poverty`.
 *
 * Callers are expected to use this only to narrow a database lookup, and then
 * to confirm each candidate by recomputing `getCanonicalPath` — that keeps the
 * match exact, so `/sdgs` never resolves to the article `sdgs/no-poverty`.
 */
export function getSlugCandidatesForCanonicalPath(path: string): string[] {
    if (!path.startsWith("/")) return []
    const withoutLeadingSlash = path.slice(1)
    if (!withoutLeadingSlash) return []

    const candidates = new Set<string>([withoutLeadingSlash])
    for (const prefix of CANONICAL_PATH_PREFIXES) {
        if (withoutLeadingSlash.startsWith(`${prefix}/`)) {
            const rest = withoutLeadingSlash.slice(prefix.length + 1)
            if (rest) candidates.add(rest)
        }
    }
    return [...candidates]
}

/**
 * The path of a link that points at a page on our own site, e.g.
 * "https://ourworldindata.org/international-dollars?tab=chart#section" becomes
 * "/international-dollars". Returns undefined for anything that can't name one
 * of our own gdoc pages: other hosts, grapher and explorer links, gdoc links,
 * and links that are nothing but a query string or an anchor.
 *
 * `sameSiteOrigins` is passed in rather than read from settings so that this
 * stays usable from both the site and the baker. Undefined entries are ignored,
 * which lets callers pass a parsed origin that may have failed to parse.
 */
export function getSameSitePathFromUrl(
    url: string,
    sameSiteOrigins: (string | undefined)[]
): string | undefined {
    const parsedUrl = Url.fromURL(url)
    if (parsedUrl.isGoogleDoc || parsedUrl.isGrapher || parsedUrl.isExplorer) {
        return undefined
    }

    const { origin, pathname } = parsedUrl
    if (origin && !sameSiteOrigins.includes(origin)) return undefined

    // Must be an absolute path. Anything else isn't naming a page of ours —
    // "mailto:info@ourworldindata.org", for one, parses to a path with no
    // leading slash.
    if (!pathname?.startsWith("/")) return undefined
    const path = pathname.replace(/\/+$/, "")
    return path || undefined
}

/**
 * The gdoc ids that a page's inline same-site link paths resolve to, i.e. the
 * documents that need attaching for a hover preview card to render.
 *
 * Shared by the only two callers that do this — `loadDocumentsLinkedByPath` for
 * a single gdoc and `SiteBaker.getPrefetchedGdocAttachments` for a full bake —
 * because the filtering *is* the operation, and the two drifted apart once
 * already: the baker had no self-check and so attached every self-linking page's
 * own document to itself.
 *
 * Two things are dropped:
 *
 * - `selfId`, the page being rendered. A card for the page the reader is already
 *   on is pointless, and attaching it also drags in its featured image.
 * - anything in `alreadyAttachedIds`, which is what resolved by gdoc id. Those
 *   records are attached already and are the same shape, so re-resolving them by
 *   path would be redundant.
 *
 * `idsByPath` is expected to be pre-filtered to published, previewable
 * documents; see `getPreviewableGdocIdsByCanonicalPath`.
 */
export function resolvePathsToPreviewableGdocIds({
    paths,
    idsByPath,
    selfId,
    alreadyAttachedIds,
}: {
    paths: string[]
    idsByPath: ReadonlyMap<string, string>
    selfId: string
    alreadyAttachedIds: Iterable<string>
}): string[] {
    const alreadyAttached = new Set(alreadyAttachedIds)
    return _.uniq(
        excludeUndefined(paths.map((path) => idsByPath.get(path)))
    ).filter((id) => id !== selfId && !alreadyAttached.has(id))
}

export function getPageTitle(gdoc: OwidGdoc) {
    return match(gdoc)
        .with(
            {
                content: {
                    type: OwidGdocType.Homepage,
                },
            },
            // <Head> uses the default title of "Our World in Data" when pageTitle is undefined
            // Otherwise we'd get " - Our World in Data" appended to whatever title we return here
            () => undefined
        )
        .with(
            {
                content: {
                    type: P.union(
                        OwidGdocType.Article,
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage,
                        OwidGdocType.AboutPage,
                        OwidGdocType.DataInsight,
                        OwidGdocType.Author,
                        OwidGdocType.Announcement
                    ),
                },
            },
            (match) => match.content.title
        )
        .with(
            {
                content: { type: OwidGdocType.Profile },
            },
            (match) => {
                const entityName = match.content.instantiatedEntity?.name
                const isCountry = match.content.instantiatedEntity?.isCountry
                const profileType = isCountry ? "Country" : "Region"
                // e.g. "Energy Country Profile"
                const profileTitle = `${match.content.title} ${profileType} Profile`

                return entityName
                    ? `${entityName} - ${profileTitle}`
                    : ` ${profileTitle}`
            }
        )
        .with(
            {
                content: {
                    type: P.optional(P.union(OwidGdocType.Fragment, undefined)),
                },
            },
            () => undefined
        )
        .exhaustive()
}
