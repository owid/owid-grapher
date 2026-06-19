import urlSlug from "url-slug"
import {
    OwidEnrichedGdocBlock,
    EnrichedBlockHeading,
    TocHeadingItem,
    TocSidebarSection,
    TocChartEntry,
    Toc,
    FEATURED_DATA_INSIGHTS_ID,
    EXPLORE_DATA_SECTION_ID,
    EXPLORE_DATA_SECTION_DEFAULT_TITLE,
} from "@ourworldindata/types"
import {
    traverseEnrichedBlock,
    spansToUnformattedPlainText,
    convertHeadingToId,
} from "./Util.js"
import { Url } from "./urls/Url.js"

/** Does `body` (recursively) contain a block of the given type? */
function bodyContainsBlockType(
    body: OwidEnrichedGdocBlock[] | undefined,
    type: OwidEnrichedGdocBlock["type"]
): boolean {
    let found = false
    body?.forEach((block) =>
        traverseEnrichedBlock(block, (node) => {
            if (node.type === type) found = true
        })
    )
    return found
}

/** Build a heading entry from a heading block, or undefined when it has no text. */
function headingItem(
    heading: EnrichedBlockHeading
): TocHeadingItem | undefined {
    const text = spansToUnformattedPlainText(heading.text)
    if (!text) return undefined
    const supertitle = heading.supertitle
        ? spansToUnformattedPlainText(heading.supertitle)
        : ""
    return {
        level: heading.level,
        text,
        // The same rule ArticleBlock uses for the rendered heading id, so TOC
        // links always resolve to a real anchor.
        slug: convertHeadingToId(heading),
        ...(supertitle ? { supertitle } : {}),
    }
}

/**
 * Build the sidebar table of contents: H1 sections (plus synthetic ones for
 * featured-data-insights and explore-data-section), each carrying the chart /
 * narrative-chart bullets that appear under it in document order, including
 * charts nested inside container blocks. Used by the topic-page / profile
 * sidebar and the `ltp-toc` "Sections" block.
 *
 * Side effect: mutates every chart / narrative-chart block with a unique,
 * namespaced `anchorId` ("chart-foo", "chart-foo-2", …) rendered as the `id`
 * on the chart wrapper. Dedup is by base slug (URL path only, query params
 * ignored) plus visibility: a chart repeated since the last heading collapses
 * to one bullet unless the duplicate is a responsive variant.
 * Charts before the first H1 have no section and produce no bullet.
 */
export function generateSidebarToc(
    body: OwidEnrichedGdocBlock[] | undefined
): TocSidebarSection[] {
    if (!body) return []

    const sections: TocSidebarSection[] = []
    const anchorCounts = new Map<string, number>()
    // Dedup key of the most recently emitted bullet; any heading resets it.
    let lastEmittedChartKey: string | undefined

    const openSection = (heading: TocHeadingItem): void => {
        lastEmittedChartKey = undefined
        sections.push({ heading, charts: [] })
    }

    const assignAnchorId = (baseSlug: string): string => {
        const namespaced = `chart-${baseSlug}`
        const count = (anchorCounts.get(namespaced) ?? 0) + 1
        anchorCounts.set(namespaced, count)
        return count === 1 ? namespaced : `${namespaced}-${count}`
    }

    const chartDedupKey = (
        baseSlug: string,
        visibility: Extract<TocChartEntry, { kind: "chart" }>["visibility"]
    ): string => `chart:${baseSlug}:${visibility ?? "all"}`

    // Add a bullet to the open section, suppressing consecutive duplicates.
    const addBulletIfUnique = (
        dedupKey: string,
        entry: TocChartEntry
    ): void => {
        if (dedupKey === lastEmittedChartKey) return
        lastEmittedChartKey = dedupKey
        sections.at(-1)?.charts.push(entry)
    }

    body.forEach((block) =>
        traverseEnrichedBlock(block, (node) => {
            if (node.type === "heading") {
                // Any heading resets dup tracking, even the sub-H1 headings
                // the sidebar doesn't surface.
                lastEmittedChartKey = undefined
                if (node.level !== 1) return
                const heading = headingItem(node)
                if (heading) openSection(heading)
                return
            }
            if (node.type === "featured-data-insights") {
                openSection({
                    level: 1,
                    text: "Data insights",
                    slug: FEATURED_DATA_INSIGHTS_ID,
                })
                return
            }
            if (node.type === "explore-data-section") {
                openSection({
                    level: 1,
                    text: node.title || EXPLORE_DATA_SECTION_DEFAULT_TITLE,
                    slug: EXPLORE_DATA_SECTION_ID,
                })
                return
            }
            if (node.type === "chart") {
                const baseSlug = Url.fromURL(node.url).slug
                if (!baseSlug) return
                node.anchorId = assignAnchorId(baseSlug)
                addBulletIfUnique(chartDedupKey(baseSlug, node.visibility), {
                    kind: "chart",
                    url: node.url,
                    anchorId: node.anchorId,
                    ...(node.visibility ? { visibility: node.visibility } : {}),
                })
                return
            }
            if (node.type === "narrative-chart") {
                const baseSlug = urlSlug(node.name)
                if (!baseSlug) return
                node.anchorId = assignAnchorId(baseSlug)
                addBulletIfUnique(`narrative-chart:${baseSlug}`, {
                    kind: "narrative-chart",
                    name: node.name,
                    anchorId: node.anchorId,
                })
                return
            }
        })
    )

    return sections
}

/**
 * Build the inline `<details>` table of contents (the `sdg-toc` block): the H2
 * and H3 headings in document order. The inline list styles exactly two levels
 * (H3 renders as a sub-item), so H4+ are not surfaced.
 */
export function generateInlineToc(
    body: OwidEnrichedGdocBlock[] | undefined
): TocHeadingItem[] {
    if (!body) return []

    const headings: TocHeadingItem[] = []
    body.forEach((block) =>
        traverseEnrichedBlock(block, (node) => {
            if (node.type !== "heading" || node.level < 2 || node.level > 3)
                return
            const heading = headingItem(node)
            if (heading) headings.push(heading)
        })
    )
    return headings
}

/**
 * Decide the single TOC a page renders (if any) and build it, tailored to that
 * consumer — the one source of truth for the gating rule, shared by the
 * enrichment paths (GdocPost, GdocProfile) and the migration:
 *
 *  - `sidebar-toc` flag OR an `ltp-toc` block → `{ kind: "sidebar", sections }`
 *  - an `sdg-toc` block                        → `{ kind: "inline", headings }`
 *  - neither                                    → `undefined` (no toc)
 *
 * Only the sidebar branch assigns chart `anchorId`s, so callers must pass a
 * body without stale ones — true of all current callers, which work on freshly
 * parsed or instantiated bodies.
 */
export function generateToc(content: {
    body?: OwidEnrichedGdocBlock[]
    "sidebar-toc"?: boolean
}): Toc | undefined {
    const { body } = content
    if (content["sidebar-toc"] || bodyContainsBlockType(body, "ltp-toc")) {
        return { kind: "sidebar", sections: generateSidebarToc(body) }
    }
    if (bodyContainsBlockType(body, "sdg-toc")) {
        return { kind: "inline", headings: generateInlineToc(body) }
    }
    return undefined
}
