import * as _ from "lodash-es"
import { match } from "ts-pattern"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import { OwidColumnDef } from "@ourworldindata/types"

export enum CsvDownloadType {
    Full = "full",
    CurrentSelection = "current_selection",
}

export interface DataDownloadContextBase {
    slug: string
    searchParams: URLSearchParams
    externalSearchParams: URLSearchParams
    baseUrl: string
}

export interface DataDownloadContextServerSide extends DataDownloadContextBase {
    // Configurable options
    csvDownloadType: CsvDownloadType
    shortColNames: boolean
}

export interface DataDownloadContextClientSide extends DataDownloadContextBase {
    // Configurable options
    csvDownloadType: CsvDownloadType
    shortColNames: boolean

    // Only needed for local CSV generation
    fullTable: OwidTable
    filteredTable: OwidTable
    activeColumnSlugs: string[] | undefined
}

export const createCsvBlobLocally = async (
    ctx: DataDownloadContextClientSide
): Promise<Blob> => {
    const downloadTable =
        ctx.csvDownloadType === CsvDownloadType.Full
            ? ctx.fullTable
            : ctx.filteredTable
    const csv = downloadTable.toPrettyCsv(
        ctx.shortColNames,
        ctx.activeColumnSlugs
    )

    return new Blob([csv], { type: "text/csv;charset=utf-8" })
}

export const getDownloadSearchParams = (
    ctx: DataDownloadContextServerSide
): URLSearchParams => {
    const searchParams = new URLSearchParams()
    searchParams.set("v", "1") // API versioning
    searchParams.set(
        "csvType",
        match(ctx.csvDownloadType)
            .with(CsvDownloadType.CurrentSelection, () => "filtered")
            .with(CsvDownloadType.Full, () => "full")
            .exhaustive()
    )
    searchParams.set("useColumnShortNames", ctx.shortColNames.toString())
    const otherParams =
        ctx.csvDownloadType === CsvDownloadType.CurrentSelection
            ? // Append all the current grapher settings, e.g.
              // ?time=2020&selection=~USA + mdim dimensions.
              ctx.searchParams
            : // Use the base grapher settings + mdim dimensions.
              ctx.externalSearchParams
    for (const [key, value] of otherParams.entries()) {
        searchParams.set(key, value)
    }
    return searchParams
}

export const getDownloadUrl = (
    extension: "csv" | "metadata.json" | "zip",
    ctx: DataDownloadContextServerSide
): string => {
    const searchParams = getDownloadSearchParams(ctx)
    const searchStr = searchParams.toString().replaceAll("%7E", "~")
    return `${ctx.baseUrl}.${extension}` + (searchStr ? `?${searchStr}` : "")
}

export const getNonRedistributableInfo = (
    table: OwidTable | undefined
): { cols: CoreColumn[] | undefined; sourceLinks: string[] | undefined } => {
    if (!table) return { cols: undefined, sourceLinks: undefined }

    const nonRedistributableCols = table.columnsAsArray.filter(
        (col) => (col.def as OwidColumnDef).nonRedistributable
    )

    if (!nonRedistributableCols.length)
        return { cols: undefined, sourceLinks: undefined }

    const sourceLinks = nonRedistributableCols
        .map((col) => {
            const def = col.def as OwidColumnDef
            return def.sourceLink ?? def.origins?.[0]?.urlMain
        })
        .filter((link): link is string => !!link)

    return { cols: nonRedistributableCols, sourceLinks: _.uniq(sourceLinks) }
}
