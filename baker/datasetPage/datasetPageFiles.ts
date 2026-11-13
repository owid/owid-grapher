import { csvParse } from "d3-dsv"
import { DATASET_PAGES_URL } from "../../settings/serverSettings.js"

// The "page files" the ETL publishes for a dataset, in one folder per dataset:
// <base>/<namespace>/<short_name>/manifest.json, plus a codebook and a sources
// CSV per table. These types follow that contract; fields marked as optional
// may be missing from the files.

export interface DatasetPageManifestOwner {
    name: string
    url?: string
}

export interface DatasetPageManifestTable {
    name: string
    title: string
    /** Markdown */
    description: string | null
    rows: number
    columns: number
    /** File name of the table's codebook CSV */
    codebook: string
    /** File name of the table's sources CSV */
    sources: string
    citation?: string
    /** e.g. ["country", "year"] */
    primary_key?: string[]
    // Extra catalog paths of a column's data, e.g.
    // {"coal_energy_twh": ["grapher/energy/*/energy_mix/energy_mix#coal_twh"]}
    indicator_links?: Record<string, string[]>
}

export interface DatasetPageManifestFile {
    name: string
    format: "csv" | "parquet" | "xlsx" | "md" | "json" | "feather"
    role: "data" | "documentation" | "archive"
    size_bytes: number
    /** Absolute URL */
    url: string
    table?: string
    /** True for the dated files of one version (these have the role "archive") */
    versioned?: boolean
}

export interface DatasetPageManifestChangelogEntry {
    date: string
    changes: string[]
}

export interface DatasetPageManifest {
    manifest_version: number
    /** e.g. "garden/energy/2026-09-10/owid_energy" */
    catalog_path: string
    namespace: string
    short_name: string
    version: string
    title: string
    /** Markdown */
    description: string
    published_at: string
    /** File name of the README */
    readme: string
    /** File name of the JSON-LD metadata */
    jsonld?: string
    /** The first owner is the accountable one */
    owners?: DatasetPageManifestOwner[]
    topics: string[]
    explore_url: string
    /** Newest first */
    changelog?: DatasetPageManifestChangelogEntry[]
    /** The first table is the main one */
    tables: DatasetPageManifestTable[]
    files: DatasetPageManifestFile[]
    build_checksum: string
    update_period_days?: number
}

/** A row of a table's codebook CSV: one per column of the table, in table order */
export interface DatasetPageCodebookRow {
    column: string
    title: string
    description: string
    unit: string
    /** e.g. "1900–2025" */
    date_range: string
    /** Source labels, separated by "; " */
    source: string
    description_key: string
    description_from_producer: string
    description_processing: string
}

/** A row of a table's sources CSV. `label` is what the codebook's `source` refers to. */
export interface DatasetPageSourcesRow {
    label: string
    producer: string
    title: string
    description: string
    date_published: string
    date_accessed: string
    url_main: string
    url_download: string
    citation_full: string
}

export interface DatasetPageFilesTable {
    manifestTable: DatasetPageManifestTable
    codebook: DatasetPageCodebookRow[]
    sources: DatasetPageSourcesRow[]
}

export interface DatasetPageFiles {
    /** The folder the files were read from */
    folderUrl: string
    manifest: DatasetPageManifest
    /** In the order of the manifest's tables */
    tables: DatasetPageFilesTable[]
}

const PRODUCTION_DATASET_PAGES_URL = "https://catalog.ourworldindata.org"

async function fetchText(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok)
        throw new Error(`Failed to fetch ${url}: ${response.status}`)
    return response.text()
}

/**
 * Reads the page files of a dataset, from this environment's address if they
 * are there, otherwise from production. Returns undefined if there are none.
 */
export async function fetchDatasetPageFiles(
    namespace: string,
    shortName: string
): Promise<DatasetPageFiles | undefined> {
    for (const baseUrl of [DATASET_PAGES_URL, PRODUCTION_DATASET_PAGES_URL]) {
        const folderUrl = `${baseUrl.replace(/\/+$/, "")}/${namespace}/${shortName}`
        const manifestUrl = `${folderUrl}/manifest.json`
        const response = await fetch(manifestUrl)
        if (response.status === 404) continue
        if (!response.ok)
            throw new Error(
                `Failed to fetch ${manifestUrl}: ${response.status}`
            )
        const manifest: DatasetPageManifest = await response.json()

        // All the files of a dataset are read from the same folder
        const tables = await Promise.all(
            manifest.tables.map(async (manifestTable) => ({
                manifestTable,
                codebook: csvParse<keyof DatasetPageCodebookRow>(
                    await fetchText(`${folderUrl}/${manifestTable.codebook}`)
                ),
                sources: csvParse<keyof DatasetPageSourcesRow>(
                    await fetchText(`${folderUrl}/${manifestTable.sources}`)
                ),
            }))
        )
        return { folderUrl, manifest, tables }
    }
    return undefined
}

/**
 * The datasets listed in a sitemap that the ETL publishes at `baseUrl`, as
 * "<namespace>/<short_name>". The sitemap has one address per dataset page,
 * e.g. "<baseUrl>/energy/owid_energy/".
 */
export function parseDatasetPageKeys(
    sitemapXml: string,
    baseUrl: string
): string[] {
    const prefix = `${baseUrl.replace(/\/+$/, "")}/`
    const keys: string[] = []
    for (const match of sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const url = match[1].trim()
        if (!url.startsWith(prefix)) continue
        const key = url.slice(prefix.length).replace(/\/+$/, "")
        if (/^[\w-]+\/[\w-]+$/.test(key)) keys.push(key)
    }
    return keys
}

/**
 * The datasets that have a page, as "<namespace>/<short_name>". Which datasets
 * have one is decided in the ETL, by each dataset's metadata: this reads the
 * list the ETL publishes for this environment and the one for production.
 */
export async function fetchDatasetPageKeys(): Promise<string[]> {
    const keys = new Set<string>()
    for (const baseUrl of [DATASET_PAGES_URL, PRODUCTION_DATASET_PAGES_URL]) {
        const sitemapUrl = `${baseUrl.replace(/\/+$/, "")}/sitemap.xml`
        const response = await fetch(sitemapUrl)
        if (response.status === 404) continue
        if (!response.ok)
            throw new Error(`Failed to fetch ${sitemapUrl}: ${response.status}`)
        for (const key of parseDatasetPageKeys(await response.text(), baseUrl))
            keys.add(key)
    }
    return [...keys].sort()
}
