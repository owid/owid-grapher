import { useQuery } from "@tanstack/react-query"
import { csvParse } from "d3-dsv"

const DATA_URL =
    "https://owid-public.owid.io/food-trade/trade.preview.csv?nocache"

export type TradeRow = {
    exporter: string
    importer: string
    item: string
    value: number
    exporterProduction?: number
    importerSupply?: number
}

const queryKeys = {
    tradeData: () => ["food-trade", "trade-data"],
}

export const useTradeData = () =>
    useQuery({
        queryKey: queryKeys.tradeData(),
        queryFn: async (): Promise<TradeRow[]> => {
            const res = await fetch(DATA_URL)
            if (!res.ok)
                throw new Error(
                    `Failed to fetch trade data: HTTP ${res.status}`
                )
            const text = await res.text()
            return csvParse(text, (d) => ({
                exporter: d.Exporter,
                importer: d.Importer,
                item: d.Item,
                value: +d.Value,
                exporterProduction: parseOptionalNumber(d.ExporterProduction),
                importerSupply: parseOptionalNumber(d.ImporterSupply),
            })).map(normalizeRow)
        },
        staleTime: Infinity,
    })

function parseOptionalNumber(value: string | undefined): number | undefined {
    if (value === undefined || value === "") return undefined
    const n = +value
    return Number.isFinite(n) ? n : undefined
}

// Shorten verbose FAO country names to their common forms.
const COUNTRY_RENAMES: Record<string, string> = {
    "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
    "Netherlands (Kingdom of the)": "Netherlands",
}

function renameCountry(name: string): string {
    return COUNTRY_RENAMES[name] ?? name
}

function normalizeRow(row: TradeRow): TradeRow {
    return {
        ...row,
        exporter: renameCountry(row.exporter),
        importer: renameCountry(row.importer),
    }
}
