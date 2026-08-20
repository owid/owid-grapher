import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import {
    faArrowRight,
    faChartBar,
    faChartLine,
    faCircleInfo,
    faCoffee,
    faDatabase,
    faDisplay,
    faFile,
    faFolder,
    faImage,
    faLightbulb,
    faMonument,
    faPanorama,
    faTable,
    faTag,
    faUser,
} from "@fortawesome/free-solid-svg-icons"
import { FuzzySearch } from "@ourworldindata/utils"
import { PaletteItem, PaletteSection } from "./paletteTypes.js"

/**
 * Lower than the site search's 0.75: that threshold is tuned for short
 * country and topic names, whereas admin titles are long, so realistic
 * abbreviations score below it ("lifexp" scores 0.73 against "Life
 * expectancy"). 0.5 still filters out incidental letter matches.
 */
const FUZZY_OPTIONS = { threshold: 0.5 }
const MAX_PER_SOURCE = 5

/**
 * A federated search source: how to search one admin collection and how to
 * turn its rows into palette items. Data loading lives in the palette
 * component (react-query, via the shared queries module); everything here is
 * a pure mapper so it can be unit-tested without a server.
 */
export interface PaletteSource<T> {
    id: string
    label: string
    icon: IconDefinition
    /** Strings this row can be matched on */
    searchKeys: (item: T) => string[]
    toPaletteItem: (item: T, icon: IconDefinition) => PaletteItem
    /**
     * Row offered when the palette finds nothing: deep-links into an index
     * page's own (richer) search.
     */
    fallback?: (query: string) => PaletteItem
}

function nonEmpty(values: (string | null | undefined)[]): string[] {
    return values.filter((value): value is string => !!value)
}

/** Shapes below mirror the API payloads; kept structural so mappers stay testable. */
interface ChartRow {
    id: number
    title?: string
    slug?: string
    variantName?: string
    isPublished?: boolean
}
interface GdocRow {
    id: string
    slug?: string
    title?: string
    type?: string
    authors?: string[]
}
interface DataInsightRow {
    id: string
    slug?: string
    title?: string
}
interface NarrativeChartRow {
    id: number
    name: string
    title: string
}
interface MultiDimRow {
    id: number
    title: string
    slug: string | null
}
interface ExplorerRow {
    slug: string
    program?: string
}
interface DatasetRow {
    id: number
    name: string
    namespace?: string
    shortName?: string
}
interface IndicatorRow {
    id: number
    name: string
    dataset?: string
}
interface DodRow {
    id: number
    name: string
}
interface ImageRow {
    id: number
    filename: string
    defaultAlt?: string | null
}
interface FileRow {
    id: number
    filename: string
    path: string
}
interface StaticVizRow {
    id: number
    name?: string
    description?: string | null
}
interface SlideshowRow {
    id: number
    title: string
    slug: string
    authorName?: string
}
interface TagRow {
    id: number
    name: string
}
interface UserRow {
    id: number
    fullName: string
    email?: string
}
interface ChartRedirectRow {
    id: number
    slug: string
    chartSlug?: string
}
interface SiteRedirectRow {
    id: number
    source: string
    target: string
}
interface MultiDimRedirectRow {
    id: number
    source: string
    multiDimTitle?: string
}

function indexSearchFallback(
    sourceId: string,
    label: string,
    icon: IconDefinition,
    route: string,
    param: string
): (query: string) => PaletteItem {
    return (query: string) => ({
        id: `fallback:${sourceId}`,
        title: `Search ${label} for "${query}"`,
        icon,
        actions: [
            {
                label: "Search",
                to: `${route}?${param}=${encodeURIComponent(query)}`,
            },
        ],
    })
}

export const chartsSource: PaletteSource<ChartRow> = {
    id: "charts",
    label: "Charts",
    icon: faChartBar,
    searchKeys: (chart) => nonEmpty([chart.title, chart.slug, chart.variantName]),
    toPaletteItem: (chart, icon) => ({
        id: `charts:${chart.id}`,
        title: chart.title || chart.slug || `Chart ${chart.id}`,
        subtitle: chart.slug,
        icon,
        actions: [
            { label: "Edit", to: `/charts/${chart.id}/edit` },
            ...(chart.isPublished && chart.slug
                ? [
                      {
                          label: "View on site",
                          href: `/grapher/${chart.slug}`,
                          external: true,
                      },
                  ]
                : []),
        ],
    }),
    fallback: indexSearchFallback(
        "charts",
        "charts",
        faChartBar,
        "/charts",
        "chartSearch"
    ),
}

export const gdocsSource: PaletteSource<GdocRow> = {
    id: "gdocs",
    label: "Google Docs",
    icon: faFile,
    searchKeys: (gdoc) =>
        nonEmpty([gdoc.title, gdoc.slug, ...(gdoc.authors ?? [])]),
    toPaletteItem: (gdoc, icon) => ({
        id: `gdocs:${gdoc.id}`,
        title: gdoc.title || gdoc.slug || gdoc.id,
        subtitle: nonEmpty([gdoc.type, gdoc.slug]).join(" · "),
        icon,
        actions: [{ label: "Open", to: `/gdocs/${gdoc.id}/preview` }],
    }),
}

export const dataInsightsSource: PaletteSource<DataInsightRow> = {
    id: "dataInsights",
    label: "Data insights",
    icon: faLightbulb,
    searchKeys: (insight) => nonEmpty([insight.title, insight.slug]),
    toPaletteItem: (insight, icon) => ({
        id: `dataInsights:${insight.id}`,
        title: insight.title || insight.slug || insight.id,
        subtitle: insight.slug,
        icon,
        actions: [{ label: "Open", to: `/gdocs/${insight.id}/preview` }],
    }),
}

export const narrativeChartsSource: PaletteSource<NarrativeChartRow> = {
    id: "narrativeCharts",
    label: "Narrative charts",
    icon: faPanorama,
    searchKeys: (chart) => nonEmpty([chart.title, chart.name]),
    toPaletteItem: (chart, icon) => ({
        id: `narrativeCharts:${chart.id}`,
        title: chart.title || chart.name,
        subtitle: chart.name,
        icon,
        actions: [{ label: "Edit", to: `/narrative-charts/${chart.id}/edit` }],
    }),
}

export const multiDimsSource: PaletteSource<MultiDimRow> = {
    id: "multiDims",
    label: "Multi-dims",
    icon: faChartLine,
    searchKeys: (mdim) => nonEmpty([mdim.title, mdim.slug]),
    toPaletteItem: (mdim, icon) => ({
        id: `multiDims:${mdim.id}`,
        title: mdim.title,
        subtitle: mdim.slug ?? undefined,
        icon,
        actions: [
            { label: "Open", to: `/multi-dims/${mdim.id}` },
            ...(mdim.slug
                ? [
                      {
                          label: "View on site",
                          href: `/grapher/${mdim.slug}`,
                          external: true,
                      },
                  ]
                : []),
        ],
    }),
}

export const explorersSource: PaletteSource<ExplorerRow> = {
    id: "explorers",
    label: "Explorers",
    icon: faCoffee,
    searchKeys: (explorer) => [explorer.slug],
    toPaletteItem: (explorer, icon) => ({
        id: `explorers:${explorer.slug}`,
        title: explorer.slug,
        icon,
        actions: [{ label: "Edit", to: `/explorers/${explorer.slug}` }],
    }),
}

export const datasetsSource: PaletteSource<DatasetRow> = {
    id: "datasets",
    label: "Datasets",
    icon: faTable,
    searchKeys: (dataset) =>
        nonEmpty([dataset.name, dataset.shortName, dataset.namespace]),
    toPaletteItem: (dataset, icon) => ({
        id: `datasets:${dataset.id}`,
        title: dataset.name,
        subtitle: dataset.namespace,
        icon,
        actions: [{ label: "Open", to: `/datasets/${dataset.id}` }],
    }),
}

export const indicatorsSource: PaletteSource<IndicatorRow> = {
    id: "indicators",
    label: "Indicators",
    icon: faDatabase,
    // matching happens server-side
    searchKeys: (indicator) => [indicator.name],
    toPaletteItem: (indicator, icon) => ({
        id: `indicators:${indicator.id}`,
        title: indicator.name,
        subtitle: indicator.dataset,
        icon,
        actions: [{ label: "Open", to: `/variables/${indicator.id}` }],
    }),
    fallback: indexSearchFallback(
        "indicators",
        "indicators",
        faDatabase,
        "/variables",
        "search"
    ),
}

export const dodsSource: PaletteSource<DodRow> = {
    id: "dods",
    label: "DoDs",
    icon: faCircleInfo,
    searchKeys: (dod) => [dod.name],
    toPaletteItem: (dod, icon) => ({
        id: `dods:${dod.id}`,
        title: dod.name,
        icon,
        actions: [{ label: "Open DoDs", to: "/dods" }],
    }),
}

export const imagesSource: PaletteSource<ImageRow> = {
    id: "images",
    label: "Images",
    icon: faImage,
    searchKeys: (image) => nonEmpty([image.filename, image.defaultAlt]),
    toPaletteItem: (image, icon) => ({
        id: `images:${image.id}`,
        title: image.filename,
        icon,
        actions: [{ label: "Open Images", to: "/images" }],
    }),
}

export const filesSource: PaletteSource<FileRow> = {
    id: "files",
    label: "Files",
    icon: faFolder,
    searchKeys: (file) => nonEmpty([file.filename, file.path]),
    toPaletteItem: (file, icon) => ({
        id: `files:${file.id}`,
        title: file.filename,
        subtitle: file.path,
        icon,
        actions: [
            {
                label: "Open",
                to: `/files?path=${encodeURIComponent(file.path)}`,
            },
        ],
    }),
}

export const staticVizSource: PaletteSource<StaticVizRow> = {
    id: "staticViz",
    label: "Static viz",
    icon: faMonument,
    searchKeys: (viz) => nonEmpty([viz.name, viz.description]),
    toPaletteItem: (viz, icon) => ({
        id: `staticViz:${viz.id}`,
        title: viz.name || `Static viz ${viz.id}`,
        icon,
        actions: [{ label: "Open", to: `/static-viz/${viz.id}` }],
    }),
}

export const slideshowsSource: PaletteSource<SlideshowRow> = {
    id: "slideshows",
    label: "Slideshows",
    icon: faDisplay,
    searchKeys: (slideshow) =>
        nonEmpty([slideshow.title, slideshow.slug, slideshow.authorName]),
    toPaletteItem: (slideshow, icon) => ({
        id: `slideshows:${slideshow.id}`,
        title: slideshow.title,
        subtitle: slideshow.slug,
        icon,
        actions: [{ label: "Edit", to: `/slideshows/${slideshow.id}/edit` }],
    }),
}

export const tagsSource: PaletteSource<TagRow> = {
    id: "tags",
    label: "Tags",
    icon: faTag,
    searchKeys: (tag) => [tag.name],
    toPaletteItem: (tag, icon) => ({
        id: `tags:${tag.id}`,
        title: tag.name,
        icon,
        actions: [{ label: "Open", to: `/tags/${tag.id}` }],
    }),
}

export const usersSource: PaletteSource<UserRow> = {
    id: "users",
    label: "Users",
    icon: faUser,
    searchKeys: (user) => nonEmpty([user.fullName, user.email]),
    toPaletteItem: (user, icon) => ({
        id: `users:${user.id}`,
        title: user.fullName,
        subtitle: user.email,
        icon,
        actions: [{ label: "Open", to: `/users/${user.id}` }],
    }),
}

export const chartRedirectsSource: PaletteSource<ChartRedirectRow> = {
    id: "chartRedirects",
    label: "Chart redirects",
    icon: faArrowRight,
    searchKeys: (redirect) => nonEmpty([redirect.slug, redirect.chartSlug]),
    toPaletteItem: (redirect, icon) => ({
        id: `chartRedirects:${redirect.id}`,
        title: redirect.slug,
        subtitle: redirect.chartSlug
            ? `→ ${redirect.chartSlug}`
            : undefined,
        icon,
        actions: [{ label: "Open Chart Redirects", to: "/redirects" }],
    }),
}

export const siteRedirectsSource: PaletteSource<SiteRedirectRow> = {
    id: "siteRedirects",
    label: "Site redirects",
    icon: faArrowRight,
    searchKeys: (redirect) => [redirect.source, redirect.target],
    toPaletteItem: (redirect, icon) => ({
        id: `siteRedirects:${redirect.id}`,
        title: redirect.source,
        subtitle: `→ ${redirect.target}`,
        icon,
        actions: [{ label: "Open Site Redirects", to: "/site-redirects" }],
    }),
}

export const multiDimRedirectsSource: PaletteSource<MultiDimRedirectRow> = {
    id: "multiDimRedirects",
    label: "Multi-dim redirects",
    icon: faArrowRight,
    searchKeys: (redirect) =>
        nonEmpty([redirect.source, redirect.multiDimTitle]),
    toPaletteItem: (redirect, icon) => ({
        id: `multiDimRedirects:${redirect.id}`,
        title: redirect.source,
        subtitle: redirect.multiDimTitle
            ? `→ ${redirect.multiDimTitle}`
            : undefined,
        icon,
        actions: [
            { label: "Open Multi-dim Redirects", to: "/multi-dim-redirects" },
        ],
    }),
}

/**
 * Display order of the content sections. Sections are never interleaved by
 * score: fuzzysort scores from different corpora aren't comparable (and the
 * indicators source isn't scored client-side at all), and a stable order
 * keeps Enter predictable as you type.
 */
export const PALETTE_SOURCES: AnyPaletteSource[] = [
    chartsSource,
    gdocsSource,
    dataInsightsSource,
    narrativeChartsSource,
    multiDimsSource,
    explorersSource,
    datasetsSource,
    indicatorsSource,
    dodsSource,
    imagesSource,
    filesSource,
    staticVizSource,
    slideshowsSource,
    tagsSource,
    usersSource,
    chartRedirectsSource,
    siteRedirectsSource,
    multiDimRedirectsSource,
]

/**
 * A source with its row type erased. Sources are heterogeneous by nature, so
 * collections of them can't be typed on the row.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPaletteSource = PaletteSource<any>

/** Rows of one source, in the order the API returned them */
export type SourceData = Record<string, unknown[] | undefined>

interface ScoredItem {
    item: PaletteItem
    score: number
    isExact: boolean
}

function searchSource<T>(
    source: PaletteSource<T>,
    rows: T[],
    query: string
): ScoredItem[] {
    const fuzzy = FuzzySearch.withKeyArray(
        rows,
        source.searchKeys,
        undefined,
        FUZZY_OPTIONS
    )
    const seen = new Set<string>()
    const scored: ScoredItem[] = []
    for (const result of fuzzy.searchResults(query)) {
        for (const row of fuzzy.datamap[result.target] ?? []) {
            const item = source.toPaletteItem(row, source.icon)
            if (seen.has(item.id)) continue
            seen.add(item.id)
            scored.push({
                item,
                score: result.score,
                isExact:
                    result.target.toLowerCase() === query.toLowerCase() ||
                    result.target.toLowerCase().startsWith(query.toLowerCase()),
            })
            if (scored.length >= MAX_PER_SOURCE) return scored
        }
    }
    return scored
}

export interface RankResultsOptions {
    /**
     * Rows per source id. A source with no entry (still loading, or failed)
     * is simply skipped.
     */
    data: SourceData
    query: string
    /** Server-searched sources are already filtered; skip fuzzy matching. */
    preSearchedSourceIds?: string[]
    sources?: AnyPaletteSource[]
}

export interface RankedResults {
    /** A single hoisted best match, when one match is clearly exact */
    topHit?: PaletteItem
    sections: PaletteSection[]
}

/**
 * Fuzzy-match the query against every loaded source, cap each source's hits,
 * and lay the results out in fixed section order. A single unambiguous exact
 * (or prefix) match gets hoisted into a "Top hit" slot.
 */
export function rankResults({
    data,
    query,
    preSearchedSourceIds = [],
    sources = PALETTE_SOURCES,
}: RankResultsOptions): RankedResults {
    if (!query) return { sections: [] }

    const sections: PaletteSection[] = []
    const exactMatches: ScoredItem[] = []

    for (const source of sources) {
        const rows = data[source.id]
        if (!rows?.length) continue

        const scored = preSearchedSourceIds.includes(source.id)
            ? rows.slice(0, MAX_PER_SOURCE).map((row) => ({
                  item: source.toPaletteItem(row, source.icon),
                  score: 1,
                  isExact: false,
              }))
            : searchSource(source, rows, query)

        if (!scored.length) continue
        exactMatches.push(...scored.filter((s) => s.isExact))
        sections.push({
            id: source.id,
            label: source.label,
            items: scored.map((s) => s.item),
        })
    }

    // Hoist only when there is exactly one exact/prefix match: with several,
    // picking one would be arbitrary and would make Enter unpredictable.
    const topHit =
        exactMatches.length === 1 ? exactMatches[0].item : undefined
    const sectionsWithoutTopHit = topHit
        ? sections
              .map((section) => ({
                  ...section,
                  items: section.items.filter((item) => item.id !== topHit.id),
              }))
              .filter((section) => section.items.length > 0)
        : sections

    return { topHit, sections: sectionsWithoutTopHit }
}

/** Rows offered when nothing matched, deep-linking into index-page searches. */
export function fallbackSection(
    query: string,
    sources: AnyPaletteSource[] = PALETTE_SOURCES
): PaletteSection | undefined {
    if (!query) return undefined
    const items = sources
        .map((source) => source.fallback?.(query))
        .filter((item): item is PaletteItem => item !== undefined)
    if (!items.length) return undefined
    return { id: "fallbacks", label: "Search instead in", items }
}
