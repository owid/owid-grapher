import { useMemo } from "react"
import { QueryStatus, useQuery } from "@tanstack/react-query"

import { ProjectionsFileJson } from "./PovertyProjectionsConstants.js"
import {
    parseProjectionsFile,
    ProjectionsData,
} from "./PovertyProjectionsData.js"

// Vite turns these into lazily-imported chunks emitted next to the bundle,
// so only the selected poverty line's data is loaded at runtime.
const dataModules = import.meta.glob<ProjectionsFileJson>(
    "../data/projections-*.json",
    { import: "default" }
)

/** Load the projections data for a specific poverty line */
export const useProjectionsData = (
    povertyLineCents: number
): {
    data?: ProjectionsData
    status: QueryStatus
    isPlaceholderData: boolean
} => {
    const result = useQuery({
        queryKey: ["poverty-projections", povertyLineCents],
        queryFn: () => {
            const loadData =
                dataModules[`../data/projections-${povertyLineCents}.json`]
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
        () => (result.data ? parseProjectionsFile(result.data) : undefined),
        [result.data]
    )

    return {
        data,
        status: result.status,
        isPlaceholderData: result.isPlaceholderData,
    }
}
