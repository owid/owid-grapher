import * as _ from "lodash-es"
import { match } from "ts-pattern"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import { type GrapherQueryParams } from "@ourworldindata/types"

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
    csvDownloadType: CsvDownloadType
    shortColNames: boolean
}

export interface DataDownloadContextClientSide extends DataDownloadContextBase {
    csvDownloadType: CsvDownloadType
    shortColNames: boolean
    fullTable: OwidTable
    filteredTable: OwidTable
    inputColumnSlugs: string[] | undefined
}

export const createCsvBlobLocally = async (
    ctx: DataDownloadContextClientSide
): Promise<Blob> => {
    const downloadTable =
        ctx.csvDownloadType === CsvDownloadType.Full
            ? ctx.fullTable
            : ctx.filteredTable
    const csv = downloadTable.toPrettyCsv({
        useShortNames: ctx.shortColNames,
    })

    return new Blob([csv], { type: "text/csv;charset=utf-8" })
}

export const getDownloadSearchParams = (
    ctx: DataDownloadContextServerSide
): URLSearchParams => {
    const searchParams = new URLSearchParams()
    searchParams.set("v", "1")
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
            ? ctx.searchParams
            : ctx.externalSearchParams

    const searchParamsToExclude: string[] = [
        "overlay",
    ] satisfies (keyof GrapherQueryParams)[]

    for (const [key, value] of otherParams.entries()) {
        if (searchParamsToExclude.includes(key)) continue

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

export const getDataDownloadFilename = ({
    slug,
    extension,
    csvDownloadType,
}: {
    slug: string
    extension: "csv" | "zip"
    csvDownloadType: CsvDownloadType
}): string => {
    // Keep client-side CSV fallback filenames as `slug.csv` for compatibility.
    // Only server-side ZIP downloads for the current selection use `.filtered`.
    const filteredSuffix =
        extension === "zip" &&
        csvDownloadType === CsvDownloadType.CurrentSelection
            ? ".filtered"
            : ""

    return `${slug}${filteredSuffix}.${extension}`
}

export const getNonRedistributableInfo = (
    table: OwidTable | undefined
): { cols: CoreColumn[] | undefined; sourceLinks: string[] | undefined } => {
    if (!table) return { cols: undefined, sourceLinks: undefined }

    const nonRedistributableCols = table.columnsAsArray.filter(
        (col) => col.def.nonRedistributable
    )

    if (!nonRedistributableCols.length)
        return { cols: undefined, sourceLinks: undefined }

    const sourceLinks = nonRedistributableCols
        .map((col) => {
            const def = col.def
            return def.sourceLink ?? def.origins?.[0]?.urlMain
        })
        .filter((link): link is string => !!link)

    return { cols: nonRedistributableCols, sourceLinks: _.uniq(sourceLinks) }
}
