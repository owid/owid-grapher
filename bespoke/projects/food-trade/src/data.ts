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
            }))
        },
        staleTime: Infinity,
    })
