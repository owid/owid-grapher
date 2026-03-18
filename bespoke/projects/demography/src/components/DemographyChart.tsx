import { useEffect, useMemo, useState } from "react"
import { QueryStatus } from "@tanstack/react-query"

import { DemographyCaptionedChart } from "./DemographyCaptionedChart.js"
import { DemographyControls } from "./DemographyControls.js"
import { LoadingSpinner } from "./LoadingSpinner.js"
import {
    useDemographyEntityData,
    useDemographyMetadata,
} from "../helpers/DemographyDataFetching.js"

const DEFAULT_ENTITY_NAME = "United Kingdom"

export function DemographyChart(): React.ReactElement {
    // State
    // const [ageGroup, setAgeGroup] = useState(DEFAULT_AGE_GROUP)
    // const [sex, setSex] = useState(DEFAULT_SEX)
    const [entityName, setEntityName] = useState(DEFAULT_ENTITY_NAME)
    // const [year, setYear] = useState<Time>()

    // Fetch the metadata and the data for the selected entity
    const metadataResponse = useDemographyMetadata()
    const entityDataResponse = useDemographyEntityData(
        entityName,
        metadataResponse.data
    )

    // Only show loading overlays after 300ms delay to prevent flashing
    const isLoadingEntityData = useDelayedLoading(
        entityDataResponse.isPlaceholderData,
        300
    )

    const metadata = metadataResponse.data
    const entityData = entityDataResponse.data

    const loadingStatus = combineStatuses(
        metadataResponse.status,
        entityDataResponse.status
    )

    if (loadingStatus === "error") {
        return <DemographyChartError />
    }

    if (loadingStatus === "pending") {
        return <DemographySkeleton />
    }

    // Sanity check
    if (!metadata || !entityData) return <DemographyChartError />

    return (
        <div className="demography-chart">
            <DemographyControls
                metadata={metadata}
                entityName={entityName}
                setEntityName={setEntityName}
            />
            <DemographyCaptionedChart
                data={entityData}
                metadata={metadata}
                isLoading={isLoadingEntityData}
            />
        </div>
    )
}

function DemographyChartError() {
    return <div>Demography visualization can't be loaded</div>
}

function DemographySkeleton() {
    return (
        <div className="demography-skeleton">
            <LoadingSpinner />
        </div>
    )
}

/**
 * Hook that only returns true after a loading state has persisted for a minimum duration.
 * This prevents loading indicators from flashing for quick operations.
 */
function useDelayedLoading(isLoading: boolean, delay = 300): boolean {
    const [showLoading, setShowLoading] = useState(false)

    useEffect(() => {
        let timeoutId: NodeJS.Timeout

        if (isLoading) {
            // Start a timer to show loading after delay
            timeoutId = setTimeout(() => setShowLoading(true), delay)
        } else {
            // Immediately hide loading when not loading
            setShowLoading(false)
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [isLoading, delay])

    return showLoading
}

function combineStatuses(...statuses: QueryStatus[]): QueryStatus {
    if (statuses.some((status) => status === "error")) return "error"
    if (statuses.some((status) => status === "pending")) return "pending"
    return "success"
}
