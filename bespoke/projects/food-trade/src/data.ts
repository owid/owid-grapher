import { useQuery } from "@tanstack/react-query"
import { csvParse } from "d3-dsv"

const DATA_URL = "https://owid-public.owid.io/food-trade/trade.csv"

export type TradeRow = {
    exporter: string
    importer: string
    item: string
    unit: string
    value: number
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
                unit: d.Unit,
                value: +d.Value,
            })).map(normalizeRow)
        },
        staleTime: Infinity,
    })

// Shorten verbose FAO country names to their common forms.
const COUNTRY_RENAMES: Record<string, string> = {
    "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
    "Netherlands (Kingdom of the)": "Netherlands",
}

function renameCountry(name: string): string {
    return COUNTRY_RENAMES[name] ?? name
}

// Collapse "1000 X" units into "X" by scaling values by 1000, so all rows for a
// given item share a common unit and can be summed / aggregated meaningfully.
// Also normalize country names.
function normalizeRow(row: TradeRow): TradeRow {
    const m = row.unit.match(/^1000 (.+)$/)
    const scaled = m ? { ...row, unit: m[1], value: row.value * 1000 } : row
    return {
        ...scaled,
        exporter: renameCountry(scaled.exporter),
        importer: renameCountry(scaled.importer),
    }
}
