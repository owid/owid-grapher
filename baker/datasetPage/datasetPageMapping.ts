import {
    DEFAULT_THUMBNAIL_FILENAME,
    GRAPHER_TAB_NAMES,
    GrapherChartType,
    GrapherTabName,
} from "@ourworldindata/types"
import { dayjs } from "@ourworldindata/utils"
import {
    makeLabelForGrapherTab,
    mapGrapherTabNameToQueryParam,
} from "@ourworldindata/grapher"
import {
    CatalogPathsByColumn,
    DatasetPageChartLookup,
    DatasetPageRelatedPage,
} from "../../db/model/DatasetPageCharts.js"
import {
    DatasetAuxiliaryFile,
    DatasetChart,
    DatasetChartView,
    DatasetDownloadFile,
    DatasetDownloadFormat,
    DatasetIndicator,
    DatasetIndicatorGroup,
    DatasetPageData,
    DatasetRelatedResearch,
    DatasetSource,
    DatasetTable,
} from "../../site/datasetPage/datasetPageTypes.js"
import {
    DatasetPageCodebookRow,
    DatasetPageFiles,
    DatasetPageFilesTable,
    DatasetPageManifestTable,
} from "./datasetPageFiles.js"

// Maps the page files the ETL publishes for a dataset to the input of the
// dataset page.

const DISPLAY_DATE_FORMAT = "MMMM D, YYYY"

/** Download formats, in the order the page lists them */
const DOWNLOAD_FORMATS: DatasetDownloadFormat[] = ["csv", "xlsx", "parquet"]

/** e.g. "2026-09-10" -> "September 10, 2026". Undefined if the version isn't a date. */
export function formatVersionDate(version: string): string | undefined {
    const date = dayjs.utc(version)
    if (!date.isValid() || date.format("YYYY-MM-DD") !== version)
        return undefined
    return date.format(DISPLAY_DATE_FORMAT)
}

/** The version's date plus the update period. Undefined if either is unknown. */
export function getNextUpdate(
    version: string,
    updatePeriodDays: number | undefined
): string | undefined {
    if (updatePeriodDays === undefined) return undefined
    if (!formatVersionDate(version)) return undefined
    return dayjs
        .utc(version)
        .add(updatePeriodDays, "day")
        .format(DISPLAY_DATE_FORMAT)
}

/** Years compare as numbers (so that "-500" < "1800"), anything else as text */
function compareDates(a: string, b: string): number {
    if (!Number.isNaN(Number(a)) && !Number.isNaN(Number(b)))
        return Number(a) - Number(b)
    return a.localeCompare(b)
}

/** The earliest start and latest end of date ranges like "1900–2025" */
export function getTableDateRange(dateRanges: string[]): string | undefined {
    const starts: string[] = []
    const ends: string[] = []
    for (const dateRange of dateRanges) {
        if (dateRange.trim() === "") continue
        const [start, end = start] = dateRange
            .split("–")
            .map((part) => part.trim())
        starts.push(start)
        ends.push(end)
    }
    if (starts.length === 0) return undefined
    const earliest = starts.sort(compareDates)[0]
    const latest = ends.sort(compareDates)[ends.length - 1]
    return earliest === latest ? earliest : `${earliest}–${latest}`
}

/**
 * For each column, the catalog paths of the indicators with its data: the
 * column's own path in any version, plus the table's `indicator_links`.
 */
export function getColumnCatalogPaths(
    catalogPath: string,
    manifestTable: DatasetPageManifestTable,
    columns: string[]
): CatalogPathsByColumn {
    const parts = catalogPath.split("/")
    if (parts.length !== 4)
        throw new Error(`Unexpected catalog path "${catalogPath}"`)
    const [channel, namespace, , dataset] = parts
    const tablePath = `${channel}/${namespace}/*/${dataset}/${manifestTable.name}`

    const links = manifestTable.indicator_links ?? {}
    const unknownColumns = Object.keys(links).filter(
        (column) => !columns.includes(column)
    )
    if (unknownColumns.length > 0)
        throw new Error(
            `indicator_links of table "${manifestTable.name}" refer to unknown columns: ${unknownColumns.join(", ")}`
        )

    return Object.fromEntries(
        columns.map((column) => [
            column,
            [`${tablePath}#${column}`, ...(links[column] ?? [])],
        ])
    )
}

function makeIndicator(row: DatasetPageCodebookRow): DatasetIndicator {
    return {
        shortName: row.column,
        title: row.title,
        description: row.description,
        unit: row.unit || undefined,
        dateRange: row.date_range || undefined,
        descriptionLong: row.description_key || undefined,
        sourceNames: row.source ? row.source.split("; ") : [],
    }
}

/** One group with the primary key's columns and one with the rest, or a single group without a primary key */
export function makeIndicatorGroups(
    indicators: DatasetIndicator[],
    primaryKey: string[] | undefined
): DatasetIndicatorGroup[] {
    if (!primaryKey)
        return [{ id: "indicators", title: "Indicators", indicators }]
    return [
        {
            id: "index-columns",
            title: "Index columns",
            indicators: indicators.filter((indicator) =>
                primaryKey.includes(indicator.shortName)
            ),
        },
        {
            id: "indicators",
            title: "Indicators",
            indicators: indicators.filter(
                (indicator) => !primaryKey.includes(indicator.shortName)
            ),
        },
    ]
}

function makeChartViews(
    chartTypes: GrapherChartType[],
    hasMapTab: boolean
): DatasetChartView[] {
    const tabNames: GrapherTabName[] = hasMapTab
        ? [GRAPHER_TAB_NAMES.WorldMap, ...chartTypes]
        : chartTypes
    return tabNames.map((tabName) => ({
        tab: mapGrapherTabNameToQueryParam(tabName),
        label: makeLabelForGrapherTab(tabName, { format: "long" }),
    }))
}

/** The sources of the columns a chart uses, in table order */
function makeChartSourceText(
    indicators: DatasetIndicator[],
    columns: string[]
): string {
    const sourceNames = indicators
        .filter((indicator) => columns.includes(indicator.shortName))
        .flatMap((indicator) => indicator.sourceNames)
    return [...new Set(sourceNames)].join("; ")
}

/** One entry per multi-dim (showing its first view that uses the table) and one per standalone chart */
export function makeCharts(
    lookup: DatasetPageChartLookup,
    indicators: DatasetIndicator[]
): DatasetChart[] {
    const byTitle = (a: DatasetChart, b: DatasetChart): number =>
        a.title.localeCompare(b.title)

    const multiDims = lookup.multiDims.map((multiDim) => {
        const [firstView] = multiDim.views
        return {
            title: multiDim.title,
            grapherPath: firstView.queryStr
                ? `${multiDim.slug}?${firstView.queryStr}`
                : multiDim.slug,
            isMultiDim: true,
            sourceText: makeChartSourceText(indicators, multiDim.columns),
            views: makeChartViews(firstView.chartTypes, firstView.hasMapTab),
            indicatorShortNames: multiDim.columns,
            multiDimViews: multiDim.views.map((view) => ({
                title: view.title,
                grapherPath: view.queryStr
                    ? `${multiDim.slug}?${view.queryStr}`
                    : multiDim.slug,
                views: makeChartViews(view.chartTypes, view.hasMapTab),
                indicatorShortNames: view.columns,
            })),
        }
    })
    const charts = lookup.charts.map((chart) => ({
        title: chart.title,
        grapherPath: chart.slug,
        isMultiDim: false,
        sourceText: makeChartSourceText(indicators, chart.columns),
        views: makeChartViews(chart.chartTypes, chart.hasMapTab),
        indicatorShortNames: chart.columns,
    }))
    return [...multiDims.sort(byTitle), ...charts.sort(byTitle)]
}

function makeSource(
    row: DatasetPageFilesTable["sources"][number]
): DatasetSource {
    const year = parseInt(row.date_published.slice(0, 4))
    return {
        title: row.label,
        producer: row.producer,
        year: Number.isNaN(year) ? undefined : year,
        url: row.url_main,
        description: row.description,
        citation: row.citation_full,
        datePublished: row.date_published || undefined,
        dateAccessed: row.date_accessed || undefined,
        downloadUrl: row.url_download || undefined,
    }
}

function makeDownloads(
    files: DatasetPageFiles,
    tableName: string
): DatasetDownloadFile[] {
    const allFiles = files.manifest.files
    const downloads: DatasetDownloadFile[] = []
    for (const format of DOWNLOAD_FORMATS) {
        const file = allFiles.find(
            (file) =>
                file.role === "data" &&
                file.table === tableName &&
                file.format === format
        )
        if (!file) continue
        const versionedFile = allFiles.find(
            (file) =>
                file.versioned &&
                file.table === tableName &&
                file.format === format
        )
        downloads.push({
            format,
            sizeBytes: file.size_bytes,
            latestUrl: file.url,
            versionedUrl: versionedFile?.url,
        })
    }
    return downloads
}

function makeAuxiliaryFiles(
    files: DatasetPageFiles,
    manifestTable: DatasetPageManifestTable
): DatasetAuxiliaryFile[] {
    const allFiles = files.manifest.files
    return allFiles
        .filter(
            (file) =>
                file.role === "documentation" &&
                file.table === manifestTable.name
        )
        .map((file) => {
            const label =
                file.name === manifestTable.codebook
                    ? "Codebook (CSV)"
                    : file.name === manifestTable.sources
                      ? "Sources (CSV)"
                      : file.name
            const versionedFile = allFiles.find(
                (other) =>
                    other.versioned &&
                    other.table === manifestTable.name &&
                    other.name === file.name
            )
            return {
                label,
                latestUrl: file.url,
                versionedUrl: versionedFile?.url,
            }
        })
}

/** The URL of a file of the dataset, falling back to the folder the files were read from */
function getFileUrl(files: DatasetPageFiles, fileName: string): string {
    const file = files.manifest.files.find(
        (file) => file.name === fileName && !file.versioned
    )
    return file?.url ?? `${files.folderUrl}/${fileName}`
}

export function makeDatasetTable(
    files: DatasetPageFiles,
    filesTable: DatasetPageFilesTable,
    chartLookup: DatasetPageChartLookup
): DatasetTable {
    const { manifestTable, codebook, sources } = filesTable
    const primaryKey = manifestTable.primary_key?.length
        ? manifestTable.primary_key
        : undefined
    const indicators = codebook.map(makeIndicator)
    return {
        name: manifestTable.name,
        title: manifestTable.title,
        description: manifestTable.description ?? undefined,
        numRows: manifestTable.rows,
        numColumns: manifestTable.columns,
        numIndicators: codebook.filter(
            (row) => !primaryKey?.includes(row.column)
        ).length,
        primaryKey,
        dateRange: getTableDateRange(codebook.map((row) => row.date_range)),
        citation: manifestTable.citation,
        indicatorGroups: makeIndicatorGroups(indicators, primaryKey),
        sources: sources.map(makeSource),
        charts: makeCharts(chartLookup, indicators),
        downloads: makeDownloads(files, manifestTable.name),
        auxiliaryFiles: makeAuxiliaryFiles(files, manifestTable),
    }
}

/**
 * The cards of the pages that embed the dataset's charts. `imageUrls` has the
 * address of a page's featured image, by file name.
 */
export function makeRelatedResearch(
    pages: DatasetPageRelatedPage[],
    imageUrls: Record<string, string>,
    baseUrl: string
): DatasetRelatedResearch[] {
    return pages.map((page) => ({
        title: page.title,
        description: page.excerpt ?? "",
        url: `${baseUrl}/${page.slug}`,
        imageUrl:
            (page.featuredImage && imageUrls[page.featuredImage]) ||
            `${baseUrl}/${DEFAULT_THUMBNAIL_FILENAME}`,
    }))
}

/** `chartLookups` are in the order of the manifest's tables */
export function makeDatasetPageData(
    files: DatasetPageFiles,
    chartLookups: DatasetPageChartLookup[],
    ownerImageUrl?: string,
    relatedResearch: DatasetRelatedResearch[] = []
): DatasetPageData {
    const { manifest } = files
    if (files.tables.length === 0)
        throw new Error(
            `The manifest of ${manifest.catalog_path} has no tables`
        )
    const [owner] = manifest.owners ?? []
    const stepPath = manifest.catalog_path.split("/").slice(0, -1).join("/")
    return {
        slug: `${manifest.namespace}/${manifest.short_name}`,
        title: manifest.title,
        description: manifest.description,
        managedBy: owner
            ? { name: owner.name, url: owner.url, imageUrl: ownerImageUrl }
            : undefined,
        lastUpdated: formatVersionDate(manifest.version),
        nextUpdate: getNextUpdate(
            manifest.version,
            manifest.update_period_days
        ),
        version: manifest.version,
        tables: files.tables.map((filesTable, i) =>
            makeDatasetTable(files, filesTable, chartLookups[i])
        ),
        relatedResearch,
        changelog: manifest.changelog ?? [],
        sourceCodeUrl: `https://github.com/owid/etl/tree/master/etl/steps/data/${stepPath}/`,
        readmeUrl: getFileUrl(files, manifest.readme),
        jsonLdUrl: manifest.jsonld
            ? getFileUrl(files, manifest.jsonld)
            : undefined,
    }
}
