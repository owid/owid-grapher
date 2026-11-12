import { describe, expect, it } from "vitest"

import {
    formatVersionDate,
    getColumnCatalogPaths,
    getNextUpdate,
    getTableDateRange,
    makeCharts,
    makeDatasetPageData,
} from "./datasetPageMapping.js"
import {
    DatasetPageCodebookRow,
    DatasetPageFiles,
    DatasetPageManifest,
    DatasetPageManifestTable,
    DatasetPageSourcesRow,
} from "./datasetPageFiles.js"
import { DatasetPageData } from "../../site/datasetPage/datasetPageTypes.js"
import { DatasetPageChartLookup } from "../../db/model/DatasetPageCharts.js"

// The dataset page is built from the page files the ETL publishes (a manifest
// plus a codebook and a sources CSV per table). These tests pin down how those
// files map to the page's input, both for a manifest as published today and
// for one with the optional fields the ETL is adding (update_period_days,
// primary_key, and indicator_links).

const FOLDER_URL = "https://catalog.ourworldindata.org/energy/owid_energy"
const VERSIONED_URL =
    "https://catalog.ourworldindata.org/garden/energy/2026-09-10/owid_energy"

function codebookRow(
    column: string,
    fields: Partial<DatasetPageCodebookRow> = {}
): DatasetPageCodebookRow {
    return {
        column,
        title: `Title of ${column}`,
        description: `Description of ${column}.`,
        unit: "",
        date_range: "",
        source: "",
        description_key: "",
        description_from_producer: "",
        description_processing: "",
        ...fields,
    }
}

const mainTable: DatasetPageManifestTable = {
    name: "owid_energy",
    title: "Energy dataset",
    description: "About the energy dataset.",
    rows: 19494,
    columns: 4,
    codebook: "owid_energy.codebook.csv",
    sources: "owid_energy.sources.csv",
    citation: "Energy Institute (2026) and other sources",
}

const mappingTable: DatasetPageManifestTable = {
    name: "column_mapping",
    title: "Column mapping",
    description: null,
    rows: 130,
    columns: 2,
    codebook: "column_mapping.codebook.csv",
    sources: "column_mapping.sources.csv",
}

const mainCodebook: DatasetPageCodebookRow[] = [
    codebookRow("country", { date_range: "1700–2025" }),
    codebookRow("year", { date_range: "1700–2025" }),
    codebookRow("coal_energy_twh", {
        unit: "terawatt-hours (TWh)",
        date_range: "1800–2025",
        source: "Energy Institute – Statistical Review of World Energy (2026); Smil – Energy Transitions (2017)",
        description_key: "Longer text about coal.",
    }),
    codebookRow("coal_elec_twh", {
        date_range: "1985–2025",
        source: "Ember – Yearly Electricity Data (2026)",
    }),
]

const mainSources: DatasetPageSourcesRow[] = [
    {
        label: "Energy Institute – Statistical Review of World Energy (2026)",
        producer: "Energy Institute",
        title: "Statistical Review of World Energy",
        description: "About the review.",
        date_published: "2026-06-30",
        date_accessed: "2026-07-02",
        url_main: "https://www.energyinst.org/statistical-review/",
        url_download: "",
        citation_full: "Energy Institute – Statistical Review (2026).",
    },
    {
        label: "Smil – Energy Transitions (2017)",
        producer: "Smil",
        title: "Energy Transitions",
        description: "",
        date_published: "",
        date_accessed: "",
        url_main: "https://vaclavsmil.com/",
        url_download: "https://example.com/smil.xlsx",
        citation_full: "",
    },
]

/** A manifest as published today, without update_period_days, primary_key, and indicator_links */
const manifestWithoutNewFields: DatasetPageManifest = {
    manifest_version: 1,
    catalog_path: "garden/energy/2026-09-10/owid_energy",
    namespace: "energy",
    short_name: "owid_energy",
    version: "2026-09-10",
    title: "Energy dataset",
    description: "Our complete energy data in one table.",
    published_at: "2026-11-10T12:10:28Z",
    readme: "readme.md",
    jsonld: "dataset.jsonld",
    owners: [
        {
            name: "First Owner",
            url: "https://ourworldindata.org/team/first-owner",
        },
        { name: "Second Owner" },
    ],
    topics: ["Energy"],
    explore_url: "https://ourworldindata.org/search?q=Energy",
    changelog: [
        { date: "2026-09-10", changes: ["Updated the Statistical Review."] },
    ],
    tables: [mainTable, mappingTable],
    files: [
        {
            name: "owid_energy.csv",
            format: "csv",
            role: "data",
            size_bytes: 9081888,
            url: `${FOLDER_URL}/owid_energy.csv`,
            table: "owid_energy",
        },
        {
            name: "owid_energy.parquet",
            format: "parquet",
            role: "data",
            size_bytes: 3672489,
            url: `${FOLDER_URL}/owid_energy.parquet`,
            table: "owid_energy",
        },
        {
            name: "owid_energy.xlsx",
            format: "xlsx",
            role: "data",
            size_bytes: 12835376,
            url: `${FOLDER_URL}/owid_energy.xlsx`,
            table: "owid_energy",
        },
        {
            name: "owid_energy.codebook.csv",
            format: "csv",
            role: "documentation",
            size_bytes: 67242,
            url: `${FOLDER_URL}/owid_energy.codebook.csv`,
            table: "owid_energy",
        },
        {
            name: "owid_energy.sources.csv",
            format: "csv",
            role: "documentation",
            size_bytes: 10159,
            url: `${FOLDER_URL}/owid_energy.sources.csv`,
            table: "owid_energy",
        },
        {
            name: "column_mapping.csv",
            format: "csv",
            role: "data",
            size_bytes: 6783,
            url: `${FOLDER_URL}/column_mapping.csv`,
            table: "column_mapping",
        },
        {
            name: "readme.md",
            format: "md",
            role: "documentation",
            size_bytes: 99366,
            url: `${FOLDER_URL}/readme.md`,
        },
        {
            name: "owid_energy.csv",
            format: "csv",
            role: "archive",
            size_bytes: 14524837,
            url: `${VERSIONED_URL}/owid_energy.csv`,
            table: "owid_energy",
            versioned: true,
        },
        {
            name: "owid_energy.parquet",
            format: "parquet",
            role: "archive",
            size_bytes: 3672918,
            url: `${VERSIONED_URL}/owid_energy.parquet`,
            table: "owid_energy",
            versioned: true,
        },
        {
            name: "owid_energy.feather",
            format: "feather",
            role: "archive",
            size_bytes: 2647066,
            url: `${VERSIONED_URL}/owid_energy.feather`,
            table: "owid_energy",
            versioned: true,
        },
    ],
    build_checksum: "aee6f59a67c960883d7b6cc138e620ad",
}

const manifestWithNewFields: DatasetPageManifest = {
    ...manifestWithoutNewFields,
    update_period_days: 365,
    tables: [
        {
            ...mainTable,
            primary_key: ["country", "year"],
            indicator_links: {
                coal_energy_twh: [
                    "grapher/energy/*/energy_mix/energy_mix#coal_twh",
                ],
            },
        },
        mappingTable,
    ],
}

function makeFiles(manifest: DatasetPageManifest): DatasetPageFiles {
    return {
        folderUrl: FOLDER_URL,
        manifest,
        tables: [
            {
                manifestTable: manifest.tables[0],
                codebook: mainCodebook,
                sources: mainSources,
            },
            {
                manifestTable: manifest.tables[1],
                codebook: [codebookRow("name_before"), codebookRow("name")],
                sources: [],
            },
        ],
    }
}

const noCharts: DatasetPageChartLookup = { charts: [], multiDims: [] }

function makeDatasetWithoutCharts(
    manifest: DatasetPageManifest
): DatasetPageData {
    return makeDatasetPageData(makeFiles(manifest), [noCharts, noCharts])
}

describe(formatVersionDate, () => {
    it("formats a version that is a date", () => {
        expect(formatVersionDate("2026-09-10")).toEqual("September 10, 2026")
    })

    it.each(["latest", "2026", "2026-02-30"])(
        "returns undefined for %s, which isn't a date",
        (version) => {
            expect(formatVersionDate(version)).toBeUndefined()
        }
    )
})

describe(getNextUpdate, () => {
    it("adds the update period to the version's date", () => {
        expect(getNextUpdate("2026-09-10", 365)).toEqual("September 10, 2027")
        expect(getNextUpdate("2026-09-10", 30)).toEqual("October 10, 2026")
    })

    it("is unknown without an update period", () => {
        expect(getNextUpdate("2026-09-10", undefined)).toBeUndefined()
    })

    it("is unknown when the version isn't a date", () => {
        expect(getNextUpdate("latest", 365)).toBeUndefined()
    })
})

describe(getTableDateRange, () => {
    it("takes the earliest start and the latest end", () => {
        expect(
            getTableDateRange(["1900–2025", "1700–2022", "1965–2024"])
        ).toEqual("1700–2025")
    })

    it("compares years as numbers, not as text", () => {
        expect(getTableDateRange(["1800–2000", "900–950"])).toEqual("900–2000")
        expect(getTableDateRange(["-10000–1800", "1700–2025"])).toEqual(
            "-10000–2025"
        )
    })

    it("skips columns without a date range", () => {
        expect(getTableDateRange(["", "1990–2020"])).toEqual("1990–2020")
    })

    it("treats a single year as both start and end", () => {
        expect(getTableDateRange(["2020"])).toEqual("2020")
        expect(getTableDateRange(["2020", "2010–2015"])).toEqual("2010–2020")
    })

    it("is unknown when no column has a date range", () => {
        expect(getTableDateRange(["", ""])).toBeUndefined()
    })
})

describe(getColumnCatalogPaths, () => {
    const columns = ["country", "coal_energy_twh"]

    it("gives each column its own path, with the version replaced by *", () => {
        expect(
            getColumnCatalogPaths(
                "garden/energy/2026-09-10/owid_energy",
                mainTable,
                columns
            )
        ).toEqual({
            country: ["garden/energy/*/owid_energy/owid_energy#country"],
            coal_energy_twh: [
                "garden/energy/*/owid_energy/owid_energy#coal_energy_twh",
            ],
        })
    })

    it("adds the column's indicator_links", () => {
        expect(
            getColumnCatalogPaths(
                "garden/energy/2026-09-10/owid_energy",
                manifestWithNewFields.tables[0],
                columns
            )
        ).toEqual({
            country: ["garden/energy/*/owid_energy/owid_energy#country"],
            coal_energy_twh: [
                "garden/energy/*/owid_energy/owid_energy#coal_energy_twh",
                "grapher/energy/*/energy_mix/energy_mix#coal_twh",
            ],
        })
    })

    it("rejects indicator_links for a column the table doesn't have", () => {
        const table = {
            ...mainTable,
            indicator_links: { gas_twh: ["grapher/energy/*/a/b#c"] },
        }
        expect(() =>
            getColumnCatalogPaths(
                "garden/energy/2026-09-10/owid_energy",
                table,
                columns
            )
        ).toThrow(/gas_twh/)
    })
})

describe("makeDatasetPageData, for a manifest without the new fields", () => {
    it("maps the dataset's fields", () => {
        const dataset = makeDatasetWithoutCharts(manifestWithoutNewFields)
        expect(dataset).toMatchObject({
            slug: "energy/owid_energy",
            title: "Energy dataset",
            description: "Our complete energy data in one table.",
            managedBy: {
                name: "First Owner",
                url: "https://ourworldindata.org/team/first-owner",
            },
            lastUpdated: "September 10, 2026",
            version: "2026-09-10",
            changelog: manifestWithoutNewFields.changelog,
            sourceCodeUrl:
                "https://github.com/owid/etl/tree/master/etl/steps/data/garden/energy/2026-09-10/",
            readmeUrl: `${FOLDER_URL}/readme.md`,
            // Not in the files list, so it's in the folder the files were read from
            jsonLdUrl: `${FOLDER_URL}/dataset.jsonld`,
        })
    })

    it("has no next update without an update period", () => {
        const dataset = makeDatasetWithoutCharts(manifestWithoutNewFields)
        expect(dataset.nextUpdate).toBeUndefined()
    })

    it("keeps every table of the manifest, in order", () => {
        const dataset = makeDatasetWithoutCharts(manifestWithoutNewFields)
        expect(dataset.tables.map((t) => t.name)).toEqual([
            "owid_energy",
            "column_mapping",
        ])
        expect(dataset.tables[1].description).toBeUndefined()
        expect(dataset.tables[1].downloads.map((d) => d.latestUrl)).toEqual([
            `${FOLDER_URL}/column_mapping.csv`,
        ])
    })

    it("maps the table's fields", () => {
        const [table] = makeDatasetWithoutCharts(
            manifestWithoutNewFields
        ).tables
        expect(table).toMatchObject({
            title: "Energy dataset",
            description: "About the energy dataset.",
            numRows: 19494,
            numColumns: 4,
            numIndicators: 4,
            primaryKey: undefined,
            dateRange: "1700–2025",
            citation: "Energy Institute (2026) and other sources",
        })
    })

    it("puts all columns in one group", () => {
        const [table] = makeDatasetWithoutCharts(
            manifestWithoutNewFields
        ).tables
        expect(table.indicatorGroups).toHaveLength(1)
        expect(
            table.indicatorGroups[0].indicators.map((i) => i.shortName)
        ).toEqual(["country", "year", "coal_energy_twh", "coal_elec_twh"])
    })

    it("maps a codebook row to an indicator", () => {
        const [table] = makeDatasetWithoutCharts(
            manifestWithoutNewFields
        ).tables
        expect(table.indicatorGroups[0].indicators[2]).toEqual({
            shortName: "coal_energy_twh",
            title: "Title of coal_energy_twh",
            description: "Description of coal_energy_twh.",
            unit: "terawatt-hours (TWh)",
            dateRange: "1800–2025",
            descriptionLong: "Longer text about coal.",
            sourceNames: [
                "Energy Institute – Statistical Review of World Energy (2026)",
                "Smil – Energy Transitions (2017)",
            ],
        })
    })

    it("maps the sources, with the year taken from the publication date", () => {
        const [table] = makeDatasetWithoutCharts(
            manifestWithoutNewFields
        ).tables
        expect(table.sources).toEqual([
            {
                title: "Energy Institute – Statistical Review of World Energy (2026)",
                producer: "Energy Institute",
                year: 2026,
                url: "https://www.energyinst.org/statistical-review/",
                description: "About the review.",
                citation: "Energy Institute – Statistical Review (2026).",
                datePublished: "2026-06-30",
                dateAccessed: "2026-07-02",
                downloadUrl: undefined,
            },
            {
                title: "Smil – Energy Transitions (2017)",
                producer: "Smil",
                year: undefined,
                url: "https://vaclavsmil.com/",
                description: "",
                citation: "",
                datePublished: undefined,
                dateAccessed: undefined,
                downloadUrl: "https://example.com/smil.xlsx",
            },
        ])
    })

    it("lists the table's data files as downloads, with this version's file where there is one", () => {
        const [table] = makeDatasetWithoutCharts(
            manifestWithoutNewFields
        ).tables
        expect(table.downloads).toEqual([
            {
                format: "csv",
                sizeBytes: 9081888,
                latestUrl: `${FOLDER_URL}/owid_energy.csv`,
                versionedUrl: `${VERSIONED_URL}/owid_energy.csv`,
            },
            {
                format: "xlsx",
                sizeBytes: 12835376,
                latestUrl: `${FOLDER_URL}/owid_energy.xlsx`,
                versionedUrl: undefined,
            },
            {
                format: "parquet",
                sizeBytes: 3672489,
                latestUrl: `${FOLDER_URL}/owid_energy.parquet`,
                versionedUrl: `${VERSIONED_URL}/owid_energy.parquet`,
            },
        ])
    })

    it("lists the table's codebook and sources files", () => {
        const [table] = makeDatasetWithoutCharts(
            manifestWithoutNewFields
        ).tables
        expect(table.auxiliaryFiles).toEqual([
            {
                label: "Codebook (CSV)",
                latestUrl: `${FOLDER_URL}/owid_energy.codebook.csv`,
                versionedUrl: undefined,
            },
            {
                label: "Sources (CSV)",
                latestUrl: `${FOLDER_URL}/owid_energy.sources.csv`,
                versionedUrl: undefined,
            },
        ])
    })
})

describe("makeDatasetPageData, for a manifest with the new fields", () => {
    it("adds the update period to the version's date", () => {
        const dataset = makeDatasetWithoutCharts(manifestWithNewFields)
        expect(dataset.nextUpdate).toEqual("September 10, 2027")
    })

    it("groups the primary key's columns apart from the indicators", () => {
        const [table] = makeDatasetWithoutCharts(manifestWithNewFields).tables
        expect(
            table.indicatorGroups.map((group) => ({
                title: group.title,
                columns: group.indicators.map((i) => i.shortName),
            }))
        ).toEqual([
            { title: "Index columns", columns: ["country", "year"] },
            {
                title: "Indicators",
                columns: ["coal_energy_twh", "coal_elec_twh"],
            },
        ])
    })

    it("doesn't count the primary key's columns as indicators", () => {
        const [table] = makeDatasetWithoutCharts(manifestWithNewFields).tables
        expect(table.primaryKey).toEqual(["country", "year"])
        expect(table.numIndicators).toEqual(2)
        expect(table.numColumns).toEqual(4)
    })
})

describe(makeCharts, () => {
    const lookup: DatasetPageChartLookup = {
        charts: [
            {
                chartId: 1,
                slug: "coal-consumption",
                title: "Coal consumption",
                chartTypes: ["LineChart", "DiscreteBar"],
                hasMapTab: true,
                columns: ["coal_elec_twh", "coal_energy_twh"],
            },
        ],
        multiDims: [
            {
                multiDimId: 2,
                slug: "energy-mix",
                title: "Energy mix",
                views: [
                    {
                        queryStr: "metric=total&source=coal",
                        chartTypes: ["StackedArea"],
                        hasMapTab: false,
                        columns: ["coal_energy_twh"],
                    },
                    {
                        queryStr: "metric=share&source=coal",
                        chartTypes: ["LineChart"],
                        hasMapTab: true,
                        columns: ["coal_elec_twh"],
                    },
                ],
                columns: ["coal_energy_twh", "coal_elec_twh"],
            },
        ],
    }

    it("makes one entry per multi-dim, showing its first matching view, then one per chart", () => {
        // The indicators of the main table, as the page builds them
        const indicators = makeDatasetWithoutCharts(manifestWithoutNewFields)
            .tables[0].indicatorGroups[0].indicators
        expect(makeCharts(lookup, indicators)).toEqual([
            {
                title: "Energy mix",
                grapherPath: "energy-mix?metric=total&source=coal",
                isMultiDim: true,
                sourceText:
                    "Energy Institute – Statistical Review of World Energy (2026); Smil – Energy Transitions (2017); Ember – Yearly Electricity Data (2026)",
                views: [{ tab: "stacked-area", label: "Area chart" }],
                indicatorShortNames: ["coal_energy_twh", "coal_elec_twh"],
            },
            {
                title: "Coal consumption",
                grapherPath: "coal-consumption",
                isMultiDim: false,
                // In table order, not in the order the columns were matched
                sourceText:
                    "Energy Institute – Statistical Review of World Energy (2026); Smil – Energy Transitions (2017); Ember – Yearly Electricity Data (2026)",
                views: [
                    { tab: "map", label: "World map" },
                    { tab: "line", label: "Line chart" },
                    { tab: "discrete-bar", label: "Bar chart" },
                ],
                indicatorShortNames: ["coal_elec_twh", "coal_energy_twh"],
            },
        ])
    })
})

describe("makeDatasetPageData, owner", () => {
    it("carries the owner's photo when there is one", () => {
        const dataset = makeDatasetPageData(
            makeFiles(manifestWithoutNewFields),
            [noCharts, noCharts],
            "https://example.org/photo.jpg"
        )
        expect(dataset.managedBy).toEqual({
            name: "First Owner",
            url: "https://ourworldindata.org/team/first-owner",
            imageUrl: "https://example.org/photo.jpg",
        })
    })

    it("has no owner when the manifest lists none", () => {
        const dataset = makeDatasetWithoutCharts({
            ...manifestWithoutNewFields,
            owners: undefined,
        })
        expect(dataset.managedBy).toBeUndefined()
    })
})
