import { useMemo } from "react"
import { QueryStatus, useQuery } from "@tanstack/react-query"

import { DataRow, HeadcountFileJson } from "./PovertyConstants.js"
import { parseHeadcountFile } from "./PovertyData.js"

// Vite turns these into lazily-imported chunks emitted next to the bundle,
// so only the selected poverty line's data is loaded at runtime.
const dataModules = import.meta.glob<HeadcountFileJson>(
    "../data/headcounts-*.json",
    { import: "default" }
)

/** Load the headcount data for a specific poverty line */
export const useHeadcountData = (
    povertyLineCents: number
): {
    data?: DataRow[]
    years?: number[]
    status: QueryStatus
    isPlaceholderData: boolean
} => {
    const result = useQuery({
        queryKey: ["where-are-the-poor", "headcounts", povertyLineCents],
        queryFn: () => {
            const loadData =
                dataModules[`../data/headcounts-${povertyLineCents}.json`]
            if (!loadData)
                throw new Error(
                    `No data file for poverty line ${povertyLineCents}`
                )
            return loadData()
        },
        // Keep previous data while fetching new data
        placeholderData: (previousData) => previousData,
    })

    const data = useMemo(
        () => (result.data ? parseHeadcountFile(result.data) : undefined),
        [result.data]
    )

    return {
        data,
        years: result.data?.years,
        status: result.status,
        isPlaceholderData: result.isPlaceholderData,
    }
}
