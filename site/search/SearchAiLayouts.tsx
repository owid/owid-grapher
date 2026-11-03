import { useState } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowsSplitUpAndLeft,
    faAward,
    faBullseye,
    IconDefinition,
} from "@fortawesome/free-solid-svg-icons"
import { useQuery } from "@tanstack/react-query"
import {
    AiSearchChartCandidate,
    AiSearchCurated,
    AiSearchIntent,
    AiSearchLayout,
    AiSearchMode,
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
            className={cx("search-ai-lead", `search-ai-lead--${layout.intent}`)}
        >
            {layout.note && (
                <p className="search-ai-lead__note">
                    <SearchAiIcon />
                    {layout.note}
                </p>
            )}
            <div className="search-ai-lead__main">
                <div className="search-ai-lead__chart">
                    <SearchAiLiveChart
                        hit={active}
                        tab={tab}
                        entities={entities}
                    />
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
                            <SearchAiChartChoice
                                key={hit.id}
                                hit={hit}
                                entities={entities}
                                isActive={hit.id === active.id}
                                onPick={() => setActiveId(hit.id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </section>
    )
}

/** A chart to switch the live chart to. */
const SearchAiChartChoice = ({
    hit,
    entities,
    isActive,
    onPick,
}: {
    hit: AiSearchChartCandidate
    entities: EntityName[]
    isActive: boolean
    onPick: () => void
}) => (
    <button
        type="button"
        className="search-ai-version"
        aria-pressed={isActive}
        onClick={onPick}
    >
        <img
            alt=""
            loading="lazy"
            width={GRAPHER_THUMBNAIL_WIDTH}
            height={GRAPHER_THUMBNAIL_HEIGHT}
            src={constructPreviewUrl({
                hit,
                grapherParams: toGrapherQueryParams({ entities }),
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
)

const MODES: {
    mode: AiSearchMode
    label: string
    hint: string
    icon: IconDefinition
}[] = [
    {
        mode: "targeted",
        label: "Targeted",
        hint: "Our best guess, with close alternatives",
        icon: faBullseye,
    },
    {
        mode: "explore",
        label: "Explore",
        hint: "The range of what we have",
        icon: faArrowsSplitUpAndLeft,
    },
    {
        mode: "curated",
        label: "OWID recommends",
        hint: "What our researchers suggest looking at",
        icon: faAward,
    },
]

/**
 * Switches between the three shapes of results. The model's pick is marked,
 * and shapes with nothing to show are left out.
 */
export const SearchAiModeBar = ({
    mode,
    bestMode,
    available,
    onPick,
}: {
    mode: AiSearchMode
    bestMode?: AiSearchMode
    available: Record<AiSearchMode, boolean>
    onPick: (mode: AiSearchMode) => void
}) => (
    <div
        className="search-ai-modes"
        role="radiogroup"
        aria-label="Shape of the results"
    >
        {MODES.filter((m) => available[m.mode]).map((m) => (
            <button
                key={m.mode}
                type="button"
                role="radio"
                aria-checked={m.mode === mode}
                className="search-ai-mode"
                title={m.hint}
                onClick={() => onPick(m.mode)}
            >
                <FontAwesomeIcon
                    icon={m.icon}
                    className="search-ai-mode__icon"
                />
                <span className="search-ai-mode__text">
                    <span className="search-ai-mode__label">{m.label}</span>
                    <span className="search-ai-mode__hint">{m.hint}</span>
                </span>
                {m.mode === bestMode && (
                    <span className="search-ai-mode__best">Best match</span>
                )}
            </button>
        ))}
    </div>
)

/**
 * What OWID recommends for the search: the featured metrics our researchers
 * picked for each topic, as a live chart to switch between, and the
 * country's profile pages and the topic pages.
 */
export const SearchAiCurated = ({
    curated,
    country,
}: {
    curated: AiSearchCurated
    country?: string
}) => {
    const first = curated.topics[0]?.charts[0]
    const [activeId, setActiveId] = useState(first)
    const charts = new Map(curated.charts.map((chart) => [chart.id, chart]))
    const active = activeId !== undefined ? charts.get(activeId) : undefined
    const entities: EntityName[] = country ? [country, "World"] : []
    const topicNames = curated.topics.map((topic) => topic.name)

    return (
        <section className="search-ai-lead search-ai-curated">
            <p className="search-ai-lead__note">
                <FontAwesomeIcon icon={faAward} className="search-ai-icon" />
                {country
                    ? `The key metrics our researchers recommend for understanding ${country}.`
                    : `The key metrics our researchers recommend on ${topicNames.join(" and ")}.`}
            </p>
            {curated.pages.length > 0 && (
                <div className="search-ai-topic-pages__list search-ai-curated__pages">
                    {curated.pages.map((page) => (
                        <SearchAiReadLink key={page.id} page={page} />
                    ))}
                </div>
            )}
            {active && (
                <div className="search-ai-curated__chart search-ai-lead__chart">
                    <SearchAiLiveChart hit={active} entities={entities} />
                </div>
            )}
            {curated.topics.map((topic) => (
                <div key={topic.name} className="search-ai-lead__versions">
                    <span className="search-ai-lead__label">{topic.name}</span>
                    <div className="search-ai-lead__version-list">
                        {topic.charts.flatMap((id) => {
                            const hit = charts.get(id)
                            return hit
                                ? [
                                      <SearchAiChartChoice
                                          key={id}
                                          hit={hit}
                                          entities={entities}
                                          isActive={id === activeId}
                                          onPick={() => setActiveId(id)}
                                      />,
                                  ]
                                : []
                        })}
                    </div>
                </div>
            ))}
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
