import { ReactNode, useEffect, useMemo, useState } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowDown,
    faArrowRight,
    faDownload,
    faFileCsv,
    faFileExcel,
    faLayerGroup,
    faMagnifyingGlass,
    faMinus,
    faPlus,
} from "@fortawesome/free-solid-svg-icons"
import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import {
    CodeSnippet,
    RadioButton,
    SimpleMarkdownText,
} from "@ourworldindata/components"
import {
    BAKED_GRAPHER_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../../settings/clientSettings.mjs"
import {
    DatasetChart,
    DatasetDownloadFormat,
    DatasetIndicator,
    DatasetIndicatorGroup,
    DatasetPageData,
    DatasetSource,
    DatasetTable,
} from "./datasetPageTypes.js"

export const DATASET_PAGE_CONTENT_ROOT_ID = "dataset-page-root"
export const DATASET_PAGE_PROPS_KEY = "_OWID_DATASET_PAGE_PROPS"

const PROCESSING_DESCRIPTION =
    "Preparing this data involves several processing steps. Depending on the data, this can include standardizing country names and world region definitions, converting units, calculating derived indicators such as per capita measures, and adding or adapting metadata such as the name or the description given to an indicator. An indicator can therefore draw on more than one source, for example when we stitch together data from different periods by different producers, or when we calculate per capita measures using population data from a second source."

const SECTION_IDS = {
    about: "about",
    indicators: "indicators",
    charts: "charts",
    sources: "sources",
    changelog: "changelog",
    reuse: "reuse",
    download: "download",
    advancedDownload: "advanced-download",
} as const

/** Lists longer than this scroll inside their card */
const MAX_UNSCROLLED_ITEMS = 10

/** An indicator lists this many of its charts, and the rest on request */
const MAX_INDICATOR_CHARTS = 5

/** The changelog shows this many of its latest entries, and the rest on request */
const MAX_CHANGELOG_ENTRIES = 5

declare global {
    interface Window {
        [DATASET_PAGE_PROPS_KEY]?: DatasetPageProps
    }
}

export interface DatasetPageProps {
    dataset: DatasetPageData
}

// ---------------------------------------------------------------------------
// Helpers

function grapherUrl(
    grapherPath: string,
    params: Record<string, string>
): string {
    const [slug, query = ""] = grapherPath.split("?")
    const searchParams = new URLSearchParams(query)
    for (const [key, value] of Object.entries(params)) {
        searchParams.set(key, value)
    }
    const queryStr = searchParams.toString()
    return `${BAKED_GRAPHER_URL}/${slug}${queryStr ? `?${queryStr}` : ""}`
}

function chartThumbnailUrl(grapherPath: string, tab: string): string {
    const [slug, query = ""] = grapherPath.split("?")
    const searchParams = new URLSearchParams(query)
    searchParams.set("tab", tab)
    searchParams.set("imType", "thumbnail")
    return `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${slug}.png?${searchParams.toString()}`
}

function matchesQuery(
    query: string,
    ...fields: (string | undefined)[]
): boolean {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return true
    const haystack = fields.filter(Boolean).join(" ").toLowerCase()
    return terms.every((term) => haystack.includes(term))
}

/** Anchor id of a source's row in the "Sources and Processing" section */
function sourceAnchorId(sourceIndex: number): string {
    return `source-${sourceIndex}`
}

/** Id of a chart's entry in the list of the charts section */
function chartItemId(chartIndex: number): string {
    return `chart-item-${chartIndex}`
}

function scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
}

const FORMAT_ICONS: Record<DatasetDownloadFormat, IconDefinition> = {
    csv: faFileCsv,
    xlsx: faFileExcel,
    parquet: faLayerGroup,
}

const FORMAT_NAMES: Record<DatasetDownloadFormat, string> = {
    csv: "CSV",
    xlsx: "Excel",
    parquet: "Parquet",
}

/** e.g. 9081888 -> "9.1 MB" */
function formatFileSize(sizeBytes: number): string {
    if (sizeBytes < 1e3) return `${sizeBytes} B`
    if (sizeBytes < 1e6) return `${Math.round(sizeBytes / 1e3)} KB`
    return `${(sizeBytes / 1e6).toFixed(1)} MB`
}

/** e.g. ["country", "year"] -> "country and year" */
function joinWithAnd(items: string[]): string {
    if (items.length <= 2) return items.join(" and ")
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

/** What a row of the table is, for the download sections */
function describeTableRows(table: DatasetTable): string {
    if (!table.primaryKey)
        return "The whole table, with every indicator as a column."
    return `One row per ${joinWithAnd(table.primaryKey)}, with every indicator as a column.`
}

// ---------------------------------------------------------------------------
// Generic building blocks

function SearchInput({
    value,
    onChange,
    placeholder,
    className,
}: {
    value: string
    onChange: (value: string) => void
    placeholder: string
    className?: string
}) {
    return (
        <label className={cx("dataset-page__search", className)}>
            <FontAwesomeIcon
                className="dataset-page__search-icon"
                icon={faMagnifyingGlass}
            />
            <input
                className="dataset-page__search-input"
                type="search"
                value={value}
                placeholder={placeholder}
                aria-label={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}

function ExpandableRow({
    id,
    contentId,
    title,
    subtitle,
    isOpen: isOpenControlled,
    onToggle,
    children,
}: {
    id?: string
    /** Must be stable between server and client render (not `useId`, since the
     * server renders the page shell around this tree but the client doesn't) */
    contentId: string
    title: ReactNode
    subtitle?: ReactNode
    /** Pass together with `onToggle` to control the row from outside */
    isOpen?: boolean
    onToggle?: (isOpen: boolean) => void
    children: ReactNode
}) {
    const [isOpenInternal, setIsOpenInternal] = useState(false)
    const isOpen = isOpenControlled ?? isOpenInternal
    const setIsOpen = (open: boolean): void => {
        if (onToggle) onToggle(open)
        else setIsOpenInternal(open)
    }
    return (
        <li
            id={id}
            className={cx("dataset-page__row", {
                "dataset-page__row--open": isOpen,
            })}
        >
            <div className="dataset-page__row-header-wrapper">
                <button
                    type="button"
                    className="dataset-page__row-header"
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className="dataset-page__row-text">
                        <span className="dataset-page__row-title">{title}</span>
                        {subtitle && (
                            <span className="dataset-page__row-subtitle">
                                {subtitle}
                            </span>
                        )}
                    </span>
                    <FontAwesomeIcon
                        className="dataset-page__row-icon"
                        icon={isOpen ? faMinus : faPlus}
                    />
                </button>
            </div>
            {isOpen && (
                <div id={contentId} className="dataset-page__row-content">
                    {children}
                </div>
            )}
        </li>
    )
}

/** A list in a white card. Long lists scroll inside the card. */
function CardList({
    items,
    className,
}: {
    items: ReactNode[]
    className?: string
}) {
    const isScrollable = items.length > MAX_UNSCROLLED_ITEMS
    return (
        <div
            className={cx("dataset-page__card", className, {
                "dataset-page__card--scrollable": isScrollable,
            })}
        >
            <div
                className={cx({
                    "dataset-page__scroll-box": isScrollable,
                })}
            >
                <ul className="dataset-page__rows">{items}</ul>
            </div>
        </div>
    )
}

function SectionWithSideHeading({
    heading,
    headingLevel = 3,
    id,
    isWide = false,
    children,
}: {
    heading: string
    headingLevel?: 2 | 3
    id?: string
    /** Lets the body take up two more columns, e.g. for a list of cards */
    isWide?: boolean
    children: ReactNode
}) {
    const Heading = headingLevel === 2 ? "h2" : "h3"
    return (
        <div className="dataset-page__side-section grid span-cols-12" id={id}>
            <Heading
                className={cx(
                    "dataset-page__side-heading span-cols-3 span-md-cols-12",
                    {
                        "dataset-page__side-heading--large": headingLevel === 2,
                    }
                )}
            >
                {heading}
            </Heading>
            <div
                className={cx(
                    "dataset-page__side-body col-start-4 col-md-start-1 span-md-cols-12",
                    isWide ? "span-cols-8" : "span-cols-6"
                )}
            >
                {children}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Header

function DatasetHeader({
    dataset,
    table,
}: {
    dataset: DatasetPageData
    table: DatasetTable
}) {
    // The first two producers, in the order of the sources list
    const producers = [...new Set(table.sources.map((s) => s.producer))]
    const shownProducers = producers.slice(0, 2)
    const numOtherSources = table.sources.filter(
        (source) => !shownProducers.includes(source.producer)
    ).length
    // Parquet is only offered further down, with the other download options
    const quickDownloads = table.downloads.filter(
        (file) => file.format !== "parquet"
    )

    return (
        <header className="dataset-page__header grid grid-cols-12-full-width">
            <div className="dataset-page__header-main col-start-2 span-cols-8 span-md-cols-12">
                <h1 className="dataset-page__title">{dataset.title}</h1>
                <p className="dataset-page__description">
                    {dataset.description}
                </p>
                {dataset.managedBy && (
                    <p className="dataset-page__byline">
                        <span className="dataset-page__byline-label">
                            Managed by:
                        </span>
                        {dataset.managedBy.imageUrl ? (
                            <img
                                className="dataset-page__avatar"
                                src={dataset.managedBy.imageUrl}
                                alt=""
                                width={24}
                                height={24}
                            />
                        ) : (
                            <span className="dataset-page__avatar" aria-hidden>
                                {dataset.managedBy.name
                                    .split(" ")
                                    .map((part) => part[0])
                                    .join("")}
                            </span>
                        )}
                        {dataset.managedBy.url ? (
                            <a href={dataset.managedBy.url}>
                                {dataset.managedBy.name}
                            </a>
                        ) : (
                            dataset.managedBy.name
                        )}
                    </p>
                )}
                {shownProducers.length > 0 && (
                    <p className="dataset-page__byline">
                        <span className="dataset-page__byline-label">
                            Sources:
                        </span>
                        {numOtherSources > 0 ? (
                            <>
                                {shownProducers.join(", ")}, and{" "}
                                <a
                                    href={`#${SECTION_IDS.sources}`}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        scrollToSection(SECTION_IDS.sources)
                                    }}
                                >
                                    {numOtherSources} more{" "}
                                    {numOtherSources === 1
                                        ? "source"
                                        : "sources"}
                                </a>
                            </>
                        ) : (
                            shownProducers.join(" and ")
                        )}
                    </p>
                )}
                <dl className="dataset-page__key-info">
                    {table.dateRange && (
                        <div>
                            <dt>Date range</dt>
                            <dd>{table.dateRange}</dd>
                        </div>
                    )}
                    <div>
                        <dt>Number of indicators</dt>
                        <dd>
                            <a href={`#${SECTION_IDS.indicators}`}>
                                {table.numIndicators} indicators
                            </a>
                        </dd>
                    </div>
                    {dataset.lastUpdated && (
                        <div>
                            <dt>Last updated</dt>
                            <dd>
                                {dataset.changelog.length > 0 ? (
                                    <a href={`#${SECTION_IDS.changelog}`}>
                                        {dataset.lastUpdated}
                                    </a>
                                ) : (
                                    dataset.lastUpdated
                                )}
                            </dd>
                        </div>
                    )}
                    {dataset.nextUpdate && (
                        <div>
                            <dt>Next expected update</dt>
                            <dd>{dataset.nextUpdate}</dd>
                        </div>
                    )}
                </dl>
            </div>
            <aside className="dataset-page__quick-download col-start-10 span-cols-4 col-md-start-2 span-md-cols-12">
                <div className="dataset-page__overline">Quick download</div>
                <h2 className="dataset-page__quick-download-title">
                    Download the dataset
                </h2>
                <p className="dataset-page__quick-download-description">
                    {describeTableRows(table)}
                </p>
                <div className="dataset-page__quick-download-buttons">
                    {quickDownloads.map((file) => (
                        <a
                            key={file.format}
                            className="dataset-page__quick-download-button"
                            href={file.latestUrl}
                            download
                            data-track-note={`dataset_page_quick_download_${file.format}`}
                        >
                            <span>
                                <span className="dataset-page__quick-download-label">
                                    Download {FORMAT_NAMES[file.format]}
                                </span>{" "}
                                <span className="dataset-page__quick-download-meta">
                                    {formatFileSize(file.sizeBytes)}
                                </span>
                            </span>
                            <FontAwesomeIcon icon={faDownload} />
                        </a>
                    ))}
                </div>
                <div className="dataset-page__quick-download-links">
                    <a href={`#${SECTION_IDS.advancedDownload}`}>
                        Advanced download
                    </a>
                    <a href={`#${SECTION_IDS.reuse}`}>How to cite</a>
                </div>
            </aside>
        </header>
    )
}

// ---------------------------------------------------------------------------
// Indicators

/** A chart, or a view of a multi-dim, that uses an indicator */
interface IndicatorChart {
    key: string
    title: string
    /** For a view of a multi-dim: the title of the multi-dim */
    multiDimTitle?: string
    /** Position of the chart, or of the multi-dim, in the charts section */
    chartIndex: number
    multiDimViewIndex?: number
}

function IndicatorDetails({
    indicator,
    charts,
    sourceIndexByTitle,
    onSourceClick,
    onChartClick,
}: {
    indicator: DatasetIndicator
    /** All the charts of the table */
    charts: DatasetChart[]
    sourceIndexByTitle: Map<string, number>
    onSourceClick: (sourceIndex: number) => void
    onChartClick: (chartIndex: number, multiDimViewIndex?: number) => void
}) {
    const sourceNames = indicator.sourceNames ?? []
    // The charts that use this indicator, with their position in the charts
    // section. For a multi-dim, these are its views that use the indicator.
    const indicatorCharts = charts.flatMap(
        (chart, chartIndex): IndicatorChart[] => {
            if (chart.multiDimViews)
                return chart.multiDimViews
                    .map((view, multiDimViewIndex) => ({
                        view,
                        multiDimViewIndex,
                    }))
                    .filter(({ view }) =>
                        view.indicatorShortNames.includes(indicator.shortName)
                    )
                    .map(({ view, multiDimViewIndex }) => ({
                        key: view.grapherPath,
                        title: view.title,
                        multiDimTitle: chart.title,
                        chartIndex,
                        multiDimViewIndex,
                    }))
            if (!chart.indicatorShortNames.includes(indicator.shortName))
                return []
            return [{ key: chart.grapherPath, title: chart.title, chartIndex }]
        }
    )
    const [showAllCharts, setShowAllCharts] = useState(false)
    const visibleCharts = showAllCharts
        ? indicatorCharts
        : indicatorCharts.slice(0, MAX_INDICATOR_CHARTS)
    return (
        <div className="dataset-page__details">
            {indicator.descriptionLong && (
                <div className="dataset-page__details-text">
                    <SimpleMarkdownText text={indicator.descriptionLong} />
                </div>
            )}
            <dl className="dataset-page__details-meta">
                <div>
                    <dt>Name</dt>
                    <dd>
                        <code>{indicator.shortName}</code>
                    </dd>
                </div>
                {indicator.unit && (
                    <div>
                        <dt>Unit</dt>
                        <dd>{indicator.unit}</dd>
                    </div>
                )}
                {indicator.dateRange && (
                    <div>
                        <dt>Date range</dt>
                        <dd>{indicator.dateRange}</dd>
                    </div>
                )}
            </dl>
            {sourceNames.length > 0 && (
                <>
                    <h4 className="dataset-page__details-heading">
                        This data is based on the following sources:
                    </h4>
                    <ul className="dataset-page__details-sources">
                        {sourceNames.map((name) => {
                            const sourceIndex = sourceIndexByTitle.get(name)
                            return (
                                <li key={name}>
                                    {sourceIndex === undefined ? (
                                        name
                                    ) : (
                                        <a
                                            href={`#${sourceAnchorId(sourceIndex)}`}
                                            onClick={(e) => {
                                                e.preventDefault()
                                                onSourceClick(sourceIndex)
                                            }}
                                        >
                                            {name}
                                            <FontAwesomeIcon
                                                icon={faArrowDown}
                                            />
                                        </a>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                </>
            )}
            {indicatorCharts.length > 0 && (
                <>
                    <h4 className="dataset-page__details-heading">
                        Charts with this indicator:
                    </h4>
                    <ul className="dataset-page__details-sources">
                        {visibleCharts.map((chart) => (
                            <li key={chart.key}>
                                <a
                                    href={`#${SECTION_IDS.charts}`}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        onChartClick(
                                            chart.chartIndex,
                                            chart.multiDimViewIndex
                                        )
                                    }}
                                >
                                    {chart.title}
                                    {chart.multiDimTitle &&
                                        ` (${chart.multiDimTitle})`}
                                    <FontAwesomeIcon icon={faArrowDown} />
                                </a>
                            </li>
                        ))}
                    </ul>
                    {indicatorCharts.length > MAX_INDICATOR_CHARTS && (
                        <button
                            type="button"
                            className="dataset-page__toggle-link"
                            onClick={() => setShowAllCharts(!showAllCharts)}
                        >
                            {showAllCharts
                                ? "Show fewer charts"
                                : `Show all ${indicatorCharts.length} charts`}
                        </button>
                    )}
                </>
            )}
        </div>
    )
}

function IndicatorGroup({
    group,
    query,
    charts,
    sourceIndexByTitle,
    onSourceClick,
    onChartClick,
}: {
    group: DatasetIndicatorGroup
    query: string
    charts: DatasetChart[]
    sourceIndexByTitle: Map<string, number>
    onSourceClick: (sourceIndex: number) => void
    onChartClick: (chartIndex: number, multiDimViewIndex?: number) => void
}) {
    // Only one indicator per group is open at a time
    const [openIndicator, setOpenIndicator] = useState<string | undefined>()
    const indicators = group.indicators.filter((indicator) =>
        matchesQuery(
            query,
            indicator.title,
            indicator.description,
            indicator.unit,
            indicator.shortName,
            ...(indicator.sourceNames ?? [])
        )
    )
    if (indicators.length === 0) return null

    return (
        <div className="dataset-page__indicator-group">
            <h3 className="dataset-page__group-title">{group.title}</h3>
            <CardList
                items={indicators.map((indicator) => (
                    <ExpandableRow
                        key={indicator.shortName}
                        contentId={`indicator-${indicator.shortName}`}
                        isOpen={openIndicator === indicator.shortName}
                        onToggle={(isOpen) =>
                            setOpenIndicator(
                                isOpen ? indicator.shortName : undefined
                            )
                        }
                        title={indicator.title}
                        subtitle={indicator.description}
                    >
                        <IndicatorDetails
                            indicator={indicator}
                            charts={charts}
                            sourceIndexByTitle={sourceIndexByTitle}
                            onSourceClick={onSourceClick}
                            onChartClick={onChartClick}
                        />
                    </ExpandableRow>
                ))}
            />
        </div>
    )
}

function IndicatorsSection({
    table,
    onSourceClick,
    onChartClick,
}: {
    table: DatasetTable
    onSourceClick: (sourceIndex: number) => void
    onChartClick: (chartIndex: number, multiDimViewIndex?: number) => void
}) {
    const [query, setQuery] = useState("")
    const sourceIndexByTitle = useMemo(
        () => new Map(table.sources.map((source, i) => [source.title, i])),
        [table.sources]
    )
    const hasResults = table.indicatorGroups.some((group) =>
        group.indicators.some((indicator) =>
            matchesQuery(
                query,
                indicator.title,
                indicator.description,
                indicator.unit,
                indicator.shortName,
                ...(indicator.sourceNames ?? [])
            )
        )
    )
    return (
        <section
            className="dataset-page__section col-start-2 span-cols-8 span-md-cols-12"
            id={SECTION_IDS.indicators}
        >
            <h2 className="dataset-page__section-title">
                Indicators in this dataset
            </h2>
            <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search for an indicator name, title, unit, source, or producer…"
            />
            {table.indicatorGroups.map((group) => (
                <IndicatorGroup
                    key={group.id}
                    group={group}
                    query={query}
                    charts={table.charts}
                    sourceIndexByTitle={sourceIndexByTitle}
                    onSourceClick={onSourceClick}
                    onChartClick={onChartClick}
                />
            ))}
            {!hasResults && (
                <p className="dataset-page__no-results">
                    No indicators match “{query}”.
                </p>
            )}
        </section>
    )
}

// ---------------------------------------------------------------------------
// Charts

interface ChartSelection {
    chartIndex: number
    /** The tab, among those of the chart or of the selected multi-dim view */
    viewIndex: number
    /** Set when one view of a multi-dim was picked from an indicator; otherwise the multi-dim shows its first view */
    multiDimViewIndex?: number
}

function ChartListItem({
    id,
    chart,
    isSelected,
    selectedViewIndex,
    onSelect,
}: {
    id: string
    chart: DatasetChart
    isSelected: boolean
    selectedViewIndex?: number
    onSelect: (viewIndex: number) => void
}) {
    return (
        <li
            id={id}
            className={cx("dataset-page__chart-item", {
                "dataset-page__chart-item--selected": isSelected,
            })}
        >
            <button
                type="button"
                className="dataset-page__chart-item-header"
                aria-pressed={isSelected}
                onClick={() => onSelect(0)}
            >
                <span className="dataset-page__chart-item-title">
                    {chart.title}
                    {chart.isMultiDim && (
                        <span className="dataset-page__chart-item-note">
                            {" "}
                            (multiple dimensions)
                        </span>
                    )}
                </span>
                <span className="dataset-page__chart-item-source">
                    <strong>Source:</strong> {chart.sourceText}
                </span>
            </button>
            <div className="dataset-page__chart-thumbnails">
                {chart.views.map((view, viewIndex) => (
                    <button
                        key={view.tab}
                        type="button"
                        className={cx("dataset-page__chart-thumbnail", {
                            "dataset-page__chart-thumbnail--selected":
                                isSelected && selectedViewIndex === viewIndex,
                        })}
                        aria-label={`${chart.title}: ${view.label}`}
                        onClick={() => onSelect(viewIndex)}
                    >
                        <img
                            src={chartThumbnailUrl(chart.grapherPath, view.tab)}
                            alt=""
                            loading="lazy"
                        />
                    </button>
                ))}
            </div>
        </li>
    )
}

function ChartsSection({
    table,
    selection,
    onSelect,
}: {
    table: DatasetTable
    selection: ChartSelection
    onSelect: (selection: ChartSelection) => void
}) {
    const [query, setQuery] = useState("")

    const filteredCharts = useMemo(
        () =>
            table.charts
                .map((chart, index) => ({ chart, index }))
                .filter(({ chart }) =>
                    matchesQuery(query, chart.title, chart.sourceText)
                ),
        [table.charts, query]
    )

    if (table.charts.length === 0) return null

    const selectedChart = table.charts[selection.chartIndex]
    // What the preview shows: the chart, or one view of a multi-dim when it was picked from an indicator
    const selectedMultiDimView =
        selection.multiDimViewIndex !== undefined
            ? selectedChart.multiDimViews?.[selection.multiDimViewIndex]
            : undefined
    const preview = selectedMultiDimView ?? selectedChart
    const selectedView = preview.views[selection.viewIndex]
    const iframeSrc = grapherUrl(
        preview.grapherPath,
        selectedView ? { tab: selectedView.tab } : {}
    )

    return (
        <section
            className="dataset-page__section col-start-2 span-cols-12"
            id={SECTION_IDS.charts}
        >
            <h2 className="dataset-page__section-title">
                Charts based on this dataset
            </h2>
            <SearchInput
                className="dataset-page__search--wide"
                value={query}
                onChange={setQuery}
                placeholder="Search charts by name, keyword, or source…"
            />
            <div className="dataset-page__charts grid span-cols-12">
                <div className="dataset-page__chart-list-wrapper span-cols-5 span-md-cols-12">
                    {filteredCharts.length > 0 ? (
                        <ul className="dataset-page__chart-list">
                            {filteredCharts.map(({ chart, index }) => (
                                <ChartListItem
                                    key={chart.grapherPath}
                                    id={chartItemId(index)}
                                    chart={chart}
                                    isSelected={selection.chartIndex === index}
                                    // The thumbnails are those of the multi-dim's first view
                                    selectedViewIndex={
                                        selection.multiDimViewIndex ===
                                        undefined
                                            ? selection.viewIndex
                                            : undefined
                                    }
                                    onSelect={(viewIndex) =>
                                        onSelect({
                                            chartIndex: index,
                                            viewIndex,
                                        })
                                    }
                                />
                            ))}
                        </ul>
                    ) : (
                        <p className="dataset-page__no-results">
                            No charts match “{query}”.
                        </p>
                    )}
                </div>
                <div className="dataset-page__chart-preview col-start-6 span-cols-7 col-md-start-1 span-md-cols-12">
                    <iframe
                        key={iframeSrc}
                        className="dataset-page__chart-iframe"
                        src={iframeSrc}
                        title={preview.title}
                        loading="lazy"
                        allow="web-share; clipboard-write"
                    />
                </div>
            </div>
        </section>
    )
}

// ---------------------------------------------------------------------------
// Related research

function RelatedResearchSection({ dataset }: { dataset: DatasetPageData }) {
    if (dataset.relatedResearch.length === 0) return null
    return (
        <section className="dataset-page__section dataset-page__section--research dataset-page__section--bordered col-start-2 span-cols-12">
            <h2 className="dataset-page__section-title">
                Related research and writing
            </h2>
            <div className="dataset-page__research grid span-cols-12">
                {dataset.relatedResearch.map((item) => (
                    <a
                        key={item.url}
                        href={item.url}
                        className="dataset-page__research-item span-cols-4 span-md-cols-6 span-sm-cols-12"
                    >
                        <img src={item.imageUrl} alt="" loading="lazy" />
                        <span>
                            <span className="dataset-page__research-title">
                                {item.title}
                            </span>
                            <span className="dataset-page__research-description">
                                {item.description}
                            </span>
                        </span>
                    </a>
                ))}
            </div>
        </section>
    )
}

// ---------------------------------------------------------------------------
// Sources, processing, changelog

/** "2026-04-21" -> "2026/04/21", as in the design */
function formatSourceDate(isoDate: string): string {
    return isoDate.replaceAll("-", "/")
}

function SourceDetails({ source }: { source: DatasetSource }) {
    return (
        <div className="dataset-page__details">
            {source.description && (
                <div className="dataset-page__details-text">
                    <SimpleMarkdownText text={source.description} />
                </div>
            )}
            <dl className="dataset-page__source-grid">
                <div>
                    <dt>Producer</dt>
                    <dd>{source.producer}</dd>
                </div>
                {source.datePublished && (
                    <div>
                        <dt>Published</dt>
                        <dd>{formatSourceDate(source.datePublished)}</dd>
                    </div>
                )}
                {source.dateAccessed && (
                    <div>
                        <dt>Retrieved on</dt>
                        <dd>{formatSourceDate(source.dateAccessed)}</dd>
                    </div>
                )}
                {source.url && (
                    <div>
                        <dt>Retrieved from</dt>
                        <dd>
                            <a href={source.url}>{source.url}</a>
                        </dd>
                    </div>
                )}
                {source.citation && (
                    <div className="dataset-page__source-grid-full">
                        <dt>Citation</dt>
                        <dd>{source.citation}</dd>
                    </div>
                )}
            </dl>
            {source.downloadUrl && (
                <a
                    className="dataset-page__source-download"
                    href={source.downloadUrl}
                    data-track-note="dataset_page_source_download"
                >
                    <FontAwesomeIcon icon={faDownload} />
                    Download
                </a>
            )}
        </div>
    )
}

function SourcesAndProcessingSection({
    table,
    openSource,
    onToggleSource,
}: {
    table: DatasetTable
    openSource: number | undefined
    onToggleSource: (sourceIndex: number, isOpen: boolean) => void
}) {
    return (
        <section
            className="dataset-page__section dataset-page__section--sources col-start-2 span-cols-12"
            id={SECTION_IDS.sources}
        >
            <h2 className="dataset-page__section-title">
                Sources and Processing
            </h2>
            <SectionWithSideHeading
                heading="This dataset is based on the following sources"
                isWide
            >
                <CardList
                    className="dataset-page__sources"
                    items={table.sources.map((source, index) => (
                        <ExpandableRow
                            key={source.title}
                            id={sourceAnchorId(index)}
                            contentId={`${sourceAnchorId(index)}-content`}
                            isOpen={openSource === index}
                            onToggle={(isOpen) => onToggleSource(index, isOpen)}
                            title={source.title}
                            subtitle={
                                source.year
                                    ? `${source.producer}, ${source.year}`
                                    : source.producer
                            }
                        >
                            <SourceDetails source={source} />
                        </ExpandableRow>
                    ))}
                />
            </SectionWithSideHeading>
            <SectionWithSideHeading heading="How we process data">
                <p className="dataset-page__body-text">
                    {PROCESSING_DESCRIPTION}
                </p>
                <a
                    className="dataset-page__arrow-link"
                    href="https://docs.owid.io/projects/etl/"
                >
                    Read about our data pipeline{" "}
                    <FontAwesomeIcon icon={faArrowRight} />
                </a>
            </SectionWithSideHeading>
        </section>
    )
}

function ChangelogSection({ dataset }: { dataset: DatasetPageData }) {
    const [showAll, setShowAll] = useState(false)
    if (dataset.changelog.length === 0) return null
    // The entries come newest first
    const entries = showAll
        ? dataset.changelog
        : dataset.changelog.slice(0, MAX_CHANGELOG_ENTRIES)
    return (
        <section
            className="dataset-page__section dataset-page__section--changelog dataset-page__section--bordered col-start-2 span-cols-12"
            id={SECTION_IDS.changelog}
        >
            <SectionWithSideHeading heading="Changelog" headingLevel={2}>
                <div className="dataset-page__changelog">
                    {entries.map((entry) => (
                        <div
                            key={entry.date}
                            className="dataset-page__changelog-entry"
                        >
                            <h4 className="dataset-page__changelog-date">
                                <time dateTime={entry.date}>{entry.date}</time>:
                            </h4>
                            <ul>
                                {entry.changes.map((change) => (
                                    <li key={change}>
                                        <SimpleMarkdownText
                                            text={change}
                                            useParagraphs={false}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                {dataset.changelog.length > MAX_CHANGELOG_ENTRIES && (
                    <button
                        type="button"
                        className="dataset-page__toggle-link"
                        onClick={() => {
                            // Hiding the older entries makes the page shorter, so stay at the changelog
                            if (showAll) scrollToSection(SECTION_IDS.changelog)
                            setShowAll(!showAll)
                        }}
                    >
                        {showAll
                            ? "Show fewer entries"
                            : `Show all ${dataset.changelog.length} entries`}
                    </button>
                )}
            </SectionWithSideHeading>
        </section>
    )
}

// ---------------------------------------------------------------------------
// Reuse & download

type LinkVersion = "latest" | "version"

function DownloadSection({
    dataset,
    table,
}: {
    dataset: DatasetPageData
    table: DatasetTable
}) {
    const [linkVersion, setLinkVersion] = useState<LinkVersion>("latest")

    const files = [
        ...table.downloads.map((file) => ({
            label: `${FORMAT_NAMES[file.format]} file`,
            latestUrl: file.latestUrl,
            versionedUrl: file.versionedUrl,
        })),
        ...table.auxiliaryFiles,
    ]
    const latestLinks = files.map((file) => ({
        label: file.label,
        url: file.latestUrl,
    }))
    // Files of this version are only listed if they are published
    const versionedLinks = files.flatMap((file) =>
        file.versionedUrl ? [{ label: file.label, url: file.versionedUrl }] : []
    )

    const renderLinks = (links: { label: string; url: string }[]) => (
        <ul className="dataset-page__file-links">
            {links.map((link) => (
                <li key={link.label}>
                    <a href={link.url} download>
                        <FontAwesomeIcon icon={faDownload} />
                        {link.label}
                    </a>
                </li>
            ))}
        </ul>
    )

    return (
        <>
            <div className="dataset-page__download-block">
                <h4 className="dataset-page__overline">Quick download</h4>
                <p className="dataset-page__body-text dataset-page__body-text--tight">
                    {describeTableRows(table)}
                    <br />
                    {table.numRows.toLocaleString("en-US")} rows ×{" "}
                    {table.numColumns} columns
                </p>
                <div className="dataset-page__download-buttons">
                    {table.downloads.map((file) => (
                        <a
                            key={file.format}
                            className="dataset-page__download-button"
                            href={file.latestUrl}
                            download
                            data-track-note={`dataset_page_download_${file.format}`}
                        >
                            <span className="dataset-page__download-button-format">
                                <FontAwesomeIcon
                                    icon={FORMAT_ICONS[file.format]}
                                />
                            </span>
                            <span className="dataset-page__download-button-text">
                                <span className="dataset-page__download-button-title">
                                    Download {FORMAT_NAMES[file.format]}
                                </span>
                                <span className="dataset-page__download-button-meta">
                                    {formatFileSize(file.sizeBytes)}
                                </span>
                            </span>
                            <FontAwesomeIcon icon={faDownload} />
                        </a>
                    ))}
                </div>
            </div>

            <div
                className="dataset-page__download-block"
                id={SECTION_IDS.advancedDownload}
            >
                <h4 className="dataset-page__overline">
                    Advanced download options
                </h4>
                <RadioButton
                    className="dataset-page__radio"
                    group="dataset-link-version"
                    checked={linkVersion === "latest"}
                    onChange={() => setLinkVersion("latest")}
                    label={
                        <>
                            Get links to the <strong>latest data</strong>. They
                            always give you the newest release.
                        </>
                    }
                />
                {linkVersion === "latest" && renderLinks(latestLinks)}
                {versionedLinks.length > 0 && (
                    <RadioButton
                        className="dataset-page__radio"
                        group="dataset-link-version"
                        checked={linkVersion === "version"}
                        onChange={() => setLinkVersion("version")}
                        label={
                            <>
                                Get links to <strong>this version</strong> (
                                {dataset.version}). They always give you the
                                same data, even if there are newer releases.
                            </>
                        }
                    />
                )}
                {linkVersion === "version" && renderLinks(versionedLinks)}
            </div>

            <div className="dataset-page__download-block">
                <h4 className="dataset-page__overline">Data API</h4>
                <p className="dataset-page__body-text">
                    Use these URLs to programmatically access this dataset.{" "}
                    <a href="https://docs.owid.io/projects/etl/api/">
                        Our documentation provides more information
                    </a>{" "}
                    on how to use the API, and you can find a few code examples
                    there.
                </p>
                <div className="dataset-page__api-urls">
                    <div>
                        <p className="dataset-page__code-label">Source code</p>
                        <CodeSnippet
                            code={dataset.sourceCodeUrl}
                            theme="light"
                        />
                    </div>
                    {dataset.readmeUrl && (
                        <div>
                            <p className="dataset-page__code-label">
                                This page as a text file (README, Markdown)
                            </p>
                            <CodeSnippet
                                code={dataset.readmeUrl}
                                theme="light"
                            />
                        </div>
                    )}
                    {dataset.jsonLdUrl && (
                        <div>
                            <p className="dataset-page__code-label">
                                Machine-readable metadata (JSON-LD)
                            </p>
                            <CodeSnippet
                                code={dataset.jsonLdUrl}
                                theme="light"
                            />
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

function ReuseSection({
    dataset,
    table,
}: {
    dataset: DatasetPageData
    table: DatasetTable
}) {
    return (
        <section
            className="dataset-page__section dataset-page__section--bordered col-start-2 span-cols-12"
            id={SECTION_IDS.reuse}
        >
            <SectionWithSideHeading heading="Reuse this work" headingLevel={2}>
                <p className="dataset-page__body-text dataset-page__reuse-text">
                    Our World in Data collects and republishes this data; it is
                    not the original producer. The licenses of the original
                    sources still apply; each source above links to the
                    producer's site, where its terms are stated. It is your
                    responsibility to check that your use of the data is
                    permitted by them, and to credit the sources correctly.
                </p>
            </SectionWithSideHeading>
            {table.citation && (
                <SectionWithSideHeading heading="How to cite this data">
                    <CodeSnippet code={table.citation} theme="light" />
                </SectionWithSideHeading>
            )}
            <SectionWithSideHeading
                heading="Download"
                id={SECTION_IDS.download}
            >
                <DownloadSection dataset={dataset} table={table} />
            </SectionWithSideHeading>
        </section>
    )
}

// ---------------------------------------------------------------------------

export function DatasetPageContent({ dataset }: DatasetPageProps) {
    // Only one source is open at a time
    const [openSource, setOpenSource] = useState<number | undefined>()
    // Set when a source link is clicked; we scroll once the row has rendered
    const [scrollTarget, setScrollTarget] = useState<string | undefined>()

    const toggleSource = (sourceIndex: number, isOpen: boolean): void => {
        setOpenSource(isOpen ? sourceIndex : undefined)
    }

    const revealSource = (sourceIndex: number): void => {
        toggleSource(sourceIndex, true)
        setScrollTarget(sourceAnchorId(sourceIndex))
        window.history.replaceState(null, "", `#${sourceAnchorId(sourceIndex)}`)
    }

    useEffect(() => {
        if (!scrollTarget) return
        scrollToSection(scrollTarget)
        setScrollTarget(undefined)
    }, [scrollTarget])

    // The chart shown in the charts section
    const [chartSelection, setChartSelection] = useState<ChartSelection>({
        chartIndex: 0,
        viewIndex: 0,
    })
    // Set when a chart is clicked in an indicator; we scroll to it once it is selected
    const [chartToReveal, setChartToReveal] = useState<number | undefined>()

    const revealChart = (
        chartIndex: number,
        multiDimViewIndex?: number
    ): void => {
        setChartSelection({ chartIndex, viewIndex: 0, multiDimViewIndex })
        setChartToReveal(chartIndex)
    }

    useEffect(() => {
        if (chartToReveal === undefined) return
        // Bring the chart's entry into view inside its list, then go to the section
        document
            .getElementById(chartItemId(chartToReveal))
            ?.scrollIntoView({ block: "nearest" })
        scrollToSection(SECTION_IDS.charts)
        setChartToReveal(undefined)
    }, [chartToReveal])

    // The page shows the first table for now
    const table = dataset.tables[0]

    // Support linking directly to a source, e.g. /datasets/energy/owid_energy#source-3
    useEffect(() => {
        const match = window.location.hash.match(/^#source-(\d+)$/)
        if (!match) return
        const sourceIndex = Number(match[1])
        if (sourceIndex < table.sources.length) revealSource(sourceIndex)
        // oxlint-disable-next-line react-hooks/exhaustive-deps -- only on mount
    }, [])

    return (
        <div className="dataset-page">
            <DatasetHeader dataset={dataset} table={table} />
            <div className="grid grid-cols-12-full-width">
                {table.description && (
                    <section
                        className="dataset-page__about col-start-2 span-cols-8 span-md-cols-12"
                        id={SECTION_IDS.about}
                    >
                        <SimpleMarkdownText text={table.description} />
                    </section>
                )}
                {/* Full-width gray band behind the indicator cards */}
                <div className="dataset-page__indicators-band span-cols-14 grid grid-cols-12-full-width">
                    <IndicatorsSection
                        table={table}
                        onSourceClick={revealSource}
                        onChartClick={revealChart}
                    />
                </div>
                <ChartsSection
                    table={table}
                    selection={chartSelection}
                    onSelect={setChartSelection}
                />
                <RelatedResearchSection dataset={dataset} />
            </div>
            <div className="dataset-page__band grid grid-cols-12-full-width">
                <SourcesAndProcessingSection
                    table={table}
                    openSource={openSource}
                    onToggleSource={toggleSource}
                />
                <ChangelogSection dataset={dataset} />
                <ReuseSection dataset={dataset} table={table} />
            </div>
        </div>
    )
}
