import { useState } from "react"
import cx from "clsx"
import { useQuery } from "@tanstack/react-query"
import {
    AiSearchChartCandidate,
    AiSearchIntent,
    AiSearchLayout,
    AiSearchPageCandidate,
    ChartRecordType,
    EntityName,
    GRAPHER_PREVIEW_CLASS,
    GrapherSearchResultJson,
    GrapherTabName,
    OwidGdocType,
} from "@ourworldindata/types"
import { fetchJson, queryParamsToStr } from "@ourworldindata/utils"
import { getCanonicalPath } from "@ourworldindata/components"
import {
    GRAPHER_THUMBNAIL_HEIGHT,
    GRAPHER_THUMBNAIL_WIDTH,
} from "@ourworldindata/grapher"
import { GrapherWithFallback } from "../GrapherWithFallback.js"
import { MultiDimEmbed } from "../MultiDimEmbed.js"
import {
    constructChartUrl,
    constructPreviewUrl,
    constructSearchResultUrl,
    getPageTypeNameAndIcon,
    toGrapherQueryParams,
} from "./searchUtils.js"
import { PreviewVariant } from "./SearchChartHitRichDataTypes.js"
import { SearchChartHitDataTable } from "./SearchChartHitDataTable.js"
import { SearchAiIcon } from "./SearchAiTeaser.js"

// The countries searched most often on our site, offered as one-click
// selections on a measure's lead chart
const POPULAR_COUNTRIES = [
    "United States",
    "China",
    "Japan",
    "India",
    "Brazil",
    "Germany",
    "Nigeria",
]

const VERSIONS_HEADING: Partial<Record<AiSearchIntent, string>> = {
    family: "Other versions",
    place: "Other versions for",
    exact: "Often looked up together",
    country_topic: "More on this for",
}

/**
 * The top of the AI results for a search with one clear answer: a live chart
 * of the lead measure, its latest values for the selected countries and
 * regions, and other versions of the measure to switch to.
 */
export const SearchAiLead = ({
    layout,
    charts,
}: {
    layout: AiSearchLayout
    charts: Map<number, AiSearchChartCandidate>
}) => {
    const leadId = layout.lead?.id
    const [activeId, setActiveId] = useState(leadId)
    // On a measure with no place, a reader can pick a country to look at
    const [pickedCountry, setPickedCountry] = useState<string | undefined>()

    const lead = leadId !== undefined ? charts.get(leadId) : undefined
    if (!layout.lead || !lead) return null

    const active = (activeId !== undefined && charts.get(activeId)) || lead
    const isLeadActive = active.id === lead.id
    const entities: EntityName[] = pickedCountry
        ? [pickedCountry, "World"]
        : layout.lead.entities
    // The model picked the tab for the lead chart only
    const tab = isLeadActive ? layout.lead.tab : undefined
    const versions = [lead.id, ...layout.versions].flatMap((id) => {
        const hit = charts.get(id)
        return hit ? [hit] : []
    })
    const focus = pickedCountry ?? layout.country
    const versionsHeading = VERSIONS_HEADING[layout.intent]

    return (
        <section
            className={cx(
                "search-ai-lead",
                `search-ai-lead--${layout.intent}`
            )}
        >
            {layout.note && (
                <p className="search-ai-lead__note">
                    <SearchAiIcon />
                    {layout.note}
                </p>
            )}
            <div className="search-ai-lead__main">
                <div className="search-ai-lead__chart">
                    <SearchAiLiveChart hit={active} tab={tab} entities={entities} />
                </div>
                <aside className="search-ai-lead__side">
                    <SearchAiValues
                        hit={active}
                        entities={entities}
                        focus={focus}
                    />
                    {layout.intent === "family" && (
                        <div className="search-ai-lead__countries">
                            <span className="search-ai-lead__label">
                                See it for a country
                            </span>
                            <div className="search-ai-lead__country-list">
                                {POPULAR_COUNTRIES.map((country) => (
                                    <button
                                        key={country}
                                        type="button"
                                        className="search-ai-country-chip"
                                        aria-pressed={pickedCountry === country}
                                        onClick={() =>
                                            setPickedCountry(
                                                pickedCountry === country
                                                    ? undefined
                                                    : country
                                            )
                                        }
                                    >
                                        {country}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
            {versions.length > 1 && versionsHeading && (
                <div className="search-ai-lead__versions">
                    <span className="search-ai-lead__label">
                        {versionsHeading}
                        {layout.intent === "place" ||
                        layout.intent === "country_topic"
                            ? ` ${layout.country}`
                            : ""}
                    </span>
                    <div className="search-ai-lead__version-list">
                        {versions.map((hit) => (
                            <button
                                key={hit.id}
                                type="button"
                                className="search-ai-version"
                                aria-pressed={hit.id === active.id}
                                onClick={() => setActiveId(hit.id)}
                            >
                                <img
                                    alt=""
                                    loading="lazy"
                                    width={GRAPHER_THUMBNAIL_WIDTH}
                                    height={GRAPHER_THUMBNAIL_HEIGHT}
                                    src={constructPreviewUrl({
                                        hit,
                                        grapherParams: toGrapherQueryParams({
                                            entities,
                                        }),
                                        variant: PreviewVariant.Thumbnail,
                                    })}
                                />
                                <span className="search-ai-version__title">
                                    {hit.title}
                                    {hit.variantName && (
                                        <span className="search-ai-version__variant">
                                            {" "}
                                            {hit.variantName}
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    )
}

/**
 * An interactive chart: Grapher for charts, the multi-dimensional page's
 * view picker for its views, and a linked preview image for explorer views,
 * which can't be embedded on their own.
 */
const SearchAiLiveChart = ({
    hit,
    tab,
    entities,
}: {
    hit: AiSearchChartCandidate
    tab?: GrapherTabName
    entities: EntityName[]
}) => {
    const grapherParams = toGrapherQueryParams({ entities, tab })
    const url = constructChartUrl({ hit, grapherParams })

    if (hit.type === ChartRecordType.Chart)
        return (
            <GrapherWithFallback
                // Remount when the chart or selection changes
                key={url}
                slug={hit.slug}
                queryStr={queryParamsToStr(grapherParams)}
                className={GRAPHER_PREVIEW_CLASS}
                config={{ enableKeyboardShortcuts: false }}
                isEmbeddedInAnOwidPage={true}
                isEmbeddedInADataPage={false}
            />
        )
    if (hit.type === ChartRecordType.MultiDimView)
        return (
            <MultiDimEmbed
                key={url}
                url={url}
                chartConfig={{ enableKeyboardShortcuts: false }}
            />
        )
    return (
        <a className="search-ai-lead__image" href={url}>
            <img
                alt={hit.title}
                src={constructPreviewUrl({
                    hit,
                    grapherParams,
                    variant: PreviewVariant.Large,
                })}
            />
        </a>
    )
}

/**
 * The latest value for each selected country and region, from the same
 * endpoint the standard results use. With a country in focus, its value is
 * shown large first.
 */
const SearchAiValues = ({
    hit,
    entities,
    focus,
}: {
    hit: AiSearchChartCandidate
    entities: EntityName[]
    focus?: string
}) => {
    const url = constructSearchResultUrl({
        hit,
        params: {
            version: 1,
            variant: "large",
            entities,
            numDataTableRowsPerColumn: 10,
        },
    })
    const { data, status } = useQuery({
        queryKey: ["ai-search-values", url],
        queryFn: () =>
            url
                ? fetchJson<GrapherSearchResultJson>(url, { timeoutMs: 8000 })
                : null,
        retry: false,
        enabled: !!url,
    })

    if (status === "pending")
        return (
            <div
                className="search-ai-skeleton animate-pulse search-ai-lead__values-skeleton"
                aria-hidden="true"
            />
        )
    if (!data || !data.dataTable.rows.length) return null

    const focusRow = focus
        ? data.dataTable.rows.find((row) => row.label === focus)
        : undefined

    return (
        <div className="search-ai-lead__values">
            {focusRow?.value && (
                <div className="search-ai-lead__headline">
                    <span className="search-ai-lead__label">
                        {focusRow.label}
                        {focusRow.time && ` · ${focusRow.time}`}
                    </span>
                    <span className="search-ai-lead__headline-value">
                        {focusRow.value}
                    </span>
                    {data.unit && (
                        <span className="search-ai-lead__headline-unit">
                            {data.unit}
                        </span>
                    )}
                </div>
            )}
            <SearchChartHitDataTable
                title={data.dataTable.title}
                rows={data.dataTable.rows}
                numRowsPerColumn={10}
            />
            {data.source && (
                <p className="search-ai-lead__source">
                    <strong>Data source:</strong> {data.source}
                </p>
            )}
        </div>
    )
}

/** The topic pages a broad search should start from. */
export const SearchAiTopicPages = ({
    note,
    pages,
}: {
    note?: string
    pages: AiSearchPageCandidate[]
}) => {
    if (!pages.length && !note) return null
    return (
        <section className="search-ai-topic-pages">
            {note && (
                <p className="search-ai-lead__note">
                    <SearchAiIcon />
                    {note}
                </p>
            )}
            {pages.length > 0 && (
                <div className="search-ai-topic-pages__list">
                    {pages.map((page) => (
                        <SearchAiReadLink key={page.id} page={page} />
                    ))}
                </div>
            )}
        </section>
    )
}

export const SearchAiReadLink = ({ page }: { page: AiSearchPageCandidate }) => {
    const isTopicPage =
        page.type === OwidGdocType.TopicPage ||
        page.type === OwidGdocType.LinearTopicPage
    const author = !isTopicPage ? page.authors?.[0] : undefined
    return (
        <a
            className="search-ai-read"
            href={getCanonicalPath(page.slug, page.type)}
        >
            {page.thumbnailUrl ? (
                <img
                    className="search-ai-read__image"
                    src={page.thumbnailUrl}
                    alt=""
                    loading="lazy"
                />
            ) : (
                <span className="search-ai-read__image" />
            )}
            <span>
                <span className="search-ai-read__kind">
                    {getPageTypeNameAndIcon(page.type).name}
                    {author && ` · ${author}`}
                </span>
                <span className="search-ai-read__title">{page.title}</span>
            </span>
        </a>
    )
}
