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
    DatasetChart,
    DatasetDownloadFile,
    DatasetIndicator,
    DatasetIndicatorGroup,
    DatasetPageData,
    DatasetSource,
} from "./datasetPageTypes.js"

export const DATASET_PAGE_CONTENT_ROOT_ID = "dataset-page-root"
export const DATASET_PAGE_PROPS_KEY = "_OWID_DATASET_PAGE_PROPS"

// The prototype embeds charts from the live site so that it works without a
// local database that has the energy charts in it.
const PROTOTYPE_GRAPHER_BASE_URL = "https://ourworldindata.org/grapher"

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
    return `${PROTOTYPE_GRAPHER_BASE_URL}/${slug}?${searchParams.toString()}`
}

function chartThumbnailUrl(grapherPath: string, tab: string): string {
    const [slug, query = ""] = grapherPath.split("?")
    const searchParams = new URLSearchParams(query)
    searchParams.set("tab", tab)
    searchParams.set("imType", "thumbnail")
    return `${PROTOTYPE_GRAPHER_BASE_URL}/${slug}.png?${searchParams.toString()}`
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

function scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
}

const FORMAT_ICONS: Record<DatasetDownloadFile["format"], IconDefinition> = {
    csv: faFileCsv,
    excel: faFileExcel,
    parquet: faLayerGroup,
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
    numIndicators,
}: {
    dataset: DatasetPageData
    numIndicators: number
}) {
    const producers = [...new Set(dataset.sources.map((s) => s.producer))]
    const highlightedProducers = ["Ember", "Smil"].filter((p) =>
        producers.includes(p)
    )
    const numOtherSources = dataset.sources.length - highlightedProducers.length
    // Parquet is only offered further down, with the other download options
    const quickDownloads = dataset.downloads.filter(
        (file) => file.format !== "parquet"
    )

    return (
        <header className="dataset-page__header grid grid-cols-12-full-width">
            <div className="dataset-page__header-main col-start-2 span-cols-8 span-md-cols-12">
                <h1 className="dataset-page__title">{dataset.title}</h1>
                <p className="dataset-page__description">
                    {dataset.description}
                </p>
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
                    <a href={dataset.managedBy.url}>{dataset.managedBy.name}</a>
                </p>
                <p className="dataset-page__byline">
                    <span className="dataset-page__byline-label">Sources:</span>
                    {highlightedProducers.join(", ")}, and{" "}
                    <a
                        href={`#${SECTION_IDS.sources}`}
                        onClick={(e) => {
                            e.preventDefault()
                            scrollToSection(SECTION_IDS.sources)
                        }}
                    >
                        {numOtherSources} more sources
                    </a>
                </p>
                <dl className="dataset-page__key-info">
                    <div>
                        <dt>Date range</dt>
                        <dd>{dataset.dateRange}</dd>
                    </div>
                    <div>
                        <dt>Number of indicators</dt>
                        <dd>
                            <a href={`#${SECTION_IDS.indicators}`}>
                                {numIndicators} indicators
                            </a>
                        </dd>
                    </div>
                    <div>
                        <dt>Last updated</dt>
                        <dd>
                            <a href={`#${SECTION_IDS.changelog}`}>
                                {dataset.lastUpdated}
                            </a>
                        </dd>
                    </div>
                    <div>
                        <dt>Next expected update</dt>
                        <dd>{dataset.nextUpdate}</dd>
                    </div>
                </dl>
            </div>
            <aside className="dataset-page__quick-download col-start-10 span-cols-4 col-md-start-2 span-md-cols-12">
                <div className="dataset-page__overline">Quick download</div>
                <h2 className="dataset-page__quick-download-title">
                    Download the dataset
                </h2>
                <p className="dataset-page__quick-download-description">
                    One row per country (or region) and year, with every
                    indicator as a column.
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
                                    {file.label}
                                </span>{" "}
                                <span className="dataset-page__quick-download-meta">
                                    {file.size}
                                    {file.note && `, ${file.note}`}
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
                    <a href={dataset.license.url}>{dataset.license.name}</a>
                </div>
            </aside>
        </header>
    )
}

// ---------------------------------------------------------------------------
// Indicators

function IndicatorDetails({
    indicator,
    sourceIndexByTitle,
    onSourceClick,
}: {
    indicator: DatasetIndicator
    sourceIndexByTitle: Map<string, number>
    onSourceClick: (sourceIndex: number) => void
}) {
    const sourceNames = indicator.sourceNames ?? []
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
        </div>
    )
}

function IndicatorGroup({
    group,
    query,
    sourceIndexByTitle,
    onSourceClick,
}: {
    group: DatasetIndicatorGroup
    query: string
    sourceIndexByTitle: Map<string, number>
    onSourceClick: (sourceIndex: number) => void
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
                            sourceIndexByTitle={sourceIndexByTitle}
                            onSourceClick={onSourceClick}
                        />
                    </ExpandableRow>
                ))}
            />
        </div>
    )
}

function IndicatorsSection({
    dataset,
    onSourceClick,
}: {
    dataset: DatasetPageData
    onSourceClick: (sourceIndex: number) => void
}) {
    const [query, setQuery] = useState("")
    const sourceIndexByTitle = useMemo(
        () => new Map(dataset.sources.map((source, i) => [source.title, i])),
        [dataset.sources]
    )
    const hasResults = dataset.indicatorGroups.some((group) =>
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
                Indicators in the {dataset.shortTitle} dataset
            </h2>
            <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search for an indicator name, title, unit, source, or producer…"
            />
            {dataset.indicatorGroups.map((group) => (
                <IndicatorGroup
                    key={group.id}
                    group={group}
                    query={query}
                    sourceIndexByTitle={sourceIndexByTitle}
                    onSourceClick={onSourceClick}
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
    viewIndex: number
}

function ChartListItem({
    chart,
    isSelected,
    selectedViewIndex,
    onSelect,
}: {
    chart: DatasetChart
    isSelected: boolean
    selectedViewIndex?: number
    onSelect: (viewIndex: number) => void
}) {
    return (
        <li
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

function ChartsSection({ dataset }: { dataset: DatasetPageData }) {
    const [query, setQuery] = useState("")
    const [selection, setSelection] = useState<ChartSelection>({
        chartIndex: 0,
        viewIndex: 0,
    })

    const filteredCharts = useMemo(
        () =>
            dataset.charts
                .map((chart, index) => ({ chart, index }))
                .filter(({ chart }) =>
                    matchesQuery(query, chart.title, chart.sourceText)
                ),
        [dataset.charts, query]
    )

    const selectedChart = dataset.charts[selection.chartIndex]
    const selectedView = selectedChart.views[selection.viewIndex]
    const iframeSrc = grapherUrl(selectedChart.grapherPath, {
        tab: selectedView.tab,
    })

    return (
        <section
            className="dataset-page__section col-start-2 span-cols-12"
            id={SECTION_IDS.charts}
        >
            <h2 className="dataset-page__section-title">
                Charts based on the {dataset.shortTitle} dataset
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
                                    chart={chart}
                                    isSelected={selection.chartIndex === index}
                                    selectedViewIndex={selection.viewIndex}
                                    onSelect={(viewIndex) =>
                                        setSelection({
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
                        title={selectedChart.title}
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
            <div className="dataset-page__details-text">
                <SimpleMarkdownText text={source.description} />
            </div>
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
                <div>
                    <dt>Retrieved from</dt>
                    <dd>
                        <a href={source.url}>{source.url}</a>
                    </dd>
                </div>
                <div className="dataset-page__source-grid-full">
                    <dt>Citation</dt>
                    <dd>{source.citation}</dd>
                </div>
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
    dataset,
    openSource,
    onToggleSource,
}: {
    dataset: DatasetPageData
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
                    items={dataset.sources.map((source, index) => (
                        <ExpandableRow
                            key={source.title}
                            id={sourceAnchorId(index)}
                            contentId={`${sourceAnchorId(index)}-content`}
                            isOpen={openSource === index}
                            onToggle={(isOpen) => onToggleSource(index, isOpen)}
                            title={source.title}
                            subtitle={`${source.producer}, ${source.year}`}
                        >
                            <SourceDetails source={source} />
                        </ExpandableRow>
                    ))}
                />
            </SectionWithSideHeading>
            <SectionWithSideHeading heading="How we process data">
                <p className="dataset-page__body-text">
                    {dataset.processingDescription}
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
    return (
        <section
            className="dataset-page__section dataset-page__section--changelog dataset-page__section--bordered col-start-2 span-cols-12"
            id={SECTION_IDS.changelog}
        >
            <SectionWithSideHeading heading="Changelog" headingLevel={2}>
                <div className="dataset-page__changelog">
                    {dataset.changelog.map((entry) => (
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
            </SectionWithSideHeading>
        </section>
    )
}

// ---------------------------------------------------------------------------
// Reuse & download

type LinkVersion = "latest" | "version"

function DownloadSection({ dataset }: { dataset: DatasetPageData }) {
    const [linkVersion, setLinkVersion] = useState<LinkVersion>("latest")
    const urlFor = (file: { latestUrl: string; versionedUrl: string }) =>
        linkVersion === "latest" ? file.latestUrl : file.versionedUrl
    const numColumns = dataset.indicatorGroups.reduce(
        (sum, group) => sum + group.indicators.length,
        0
    )

    const fileLinks = [
        ...dataset.downloads.map((file) => ({
            label: `${file.format === "csv" ? "CSV" : file.format === "excel" ? "Excel" : "Parquet"} file`,
            url: urlFor(file),
        })),
        ...dataset.auxiliaryFiles.map((file) => ({
            label: file.label,
            url: urlFor(file),
        })),
    ]

    const renderLinks = () => (
        <ul className="dataset-page__file-links">
            {fileLinks.map((link) => (
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
                    One row per country (or region) and year, with every
                    indicator as a column.
                    <br />
                    {dataset.numRows.toLocaleString("en-US")} rows ×{" "}
                    {numColumns} columns
                </p>
                <div className="dataset-page__download-buttons">
                    {dataset.downloads.map((file) => (
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
                                    {file.label}
                                </span>
                                <span className="dataset-page__download-button-meta">
                                    {file.note ? `${file.note} ` : ""}
                                    {file.size}
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
                {linkVersion === "latest" && renderLinks()}
                <RadioButton
                    className="dataset-page__radio"
                    group="dataset-link-version"
                    checked={linkVersion === "version"}
                    onChange={() => setLinkVersion("version")}
                    label={
                        <>
                            Get links to <strong>this version</strong> (
                            {dataset.version}). They always give you the same
                            data, even if there are newer releases.
                        </>
                    }
                />
                {linkVersion === "version" && renderLinks()}
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
                    <div>
                        <p className="dataset-page__code-label">
                            This page as a text file (README, Markdown)
                        </p>
                        <CodeSnippet code={dataset.readmeUrl} theme="light" />
                    </div>
                    <div>
                        <p className="dataset-page__code-label">
                            Machine-readable metadata (JSON-LD)
                        </p>
                        <CodeSnippet code={dataset.jsonLdUrl} theme="light" />
                    </div>
                </div>
            </div>
        </>
    )
}

function ReuseSection({ dataset }: { dataset: DatasetPageData }) {
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
            <SectionWithSideHeading
                heading="Download"
                id={SECTION_IDS.download}
            >
                <DownloadSection dataset={dataset} />
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

    // Support linking directly to a source, e.g. /datasets/energy#source-3
    useEffect(() => {
        const match = window.location.hash.match(/^#source-(\d+)$/)
        if (!match) return
        const sourceIndex = Number(match[1])
        if (sourceIndex < dataset.sources.length) revealSource(sourceIndex)
        // oxlint-disable-next-line react-hooks/exhaustive-deps -- only on mount
    }, [])

    const numIndicators = dataset.indicatorGroups.reduce(
        (sum, group) => sum + group.indicators.length,
        0
    )

    return (
        <div className="dataset-page">
            <DatasetHeader dataset={dataset} numIndicators={numIndicators} />
            <div className="grid grid-cols-12-full-width">
                <section
                    className="dataset-page__about col-start-2 span-cols-8 span-md-cols-12"
                    id={SECTION_IDS.about}
                >
                    {dataset.about.map((paragraph) => (
                        <SimpleMarkdownText key={paragraph} text={paragraph} />
                    ))}
                </section>
                {/* Full-width gray band behind the indicator cards */}
                <div className="dataset-page__indicators-band span-cols-14 grid grid-cols-12-full-width">
                    <IndicatorsSection
                        dataset={dataset}
                        onSourceClick={revealSource}
                    />
                </div>
                <ChartsSection dataset={dataset} />
                <RelatedResearchSection dataset={dataset} />
            </div>
            <div className="dataset-page__band grid grid-cols-12-full-width">
                <SourcesAndProcessingSection
                    dataset={dataset}
                    openSource={openSource}
                    onToggleSource={toggleSource}
                />
                <ChangelogSection dataset={dataset} />
                <ReuseSection dataset={dataset} />
            </div>
        </div>
    )
}
