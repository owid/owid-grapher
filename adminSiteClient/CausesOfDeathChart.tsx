import { useEffect, useMemo, useState } from "react"
import { QueryStatus } from "@tanstack/react-query"

import { Time } from "@ourworldindata/types"
import { WORLD_ENTITY_NAME } from "@ourworldindata/grapher"

import {
    useCausesOfDeathEntityData,
    useCausesOfDeathMetadata,
} from "./CausesOfDeathDataFetching.js"
import { CausesOfDeathCaptionedChart } from "./CausesOfDeathCaptionedChart.js"
import { CausesOfDeathControls } from "./CausesOfDeathControls.js"
import { CausesOfDeathSpinner } from "./CausesOfDeathSpinner.js"

const DEFAULT_AGE_GROUP = "All ages"
const DEFAULT_SEX = "Both sexes"
const DEFAULT_ENTITY_NAME = WORLD_ENTITY_NAME

export function CausesOfDeathChart(): React.ReactElement {
    // State
    const [ageGroup, setAgeGroup] = useState(DEFAULT_AGE_GROUP)
    const [sex, setSex] = useState(DEFAULT_SEX)
    const [entityName, setEntityName] = useState(DEFAULT_ENTITY_NAME)
    const [year, setYear] = useState<Time>()

    // Fetch the metadata and the data for the selected entity
    const metadataResponse = useCausesOfDeathMetadata()
    const entityDataResponse = useCausesOfDeathEntityData(
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

    const activeAgeGroup = ageGroup
    const activeSex = sex
    const activeYear = year ?? metadata?.availableYears.at(-1)
    const activeData = useMemo(
        () =>
            entityData?.filter(
                (row) =>
                    row.ageGroup === activeAgeGroup && row.sex === activeSex
            ),
        [entityData, activeAgeGroup, activeSex]
    )
    const activeEntityName = activeData?.at(0)?.entityName

    const loadingStatus = combineStatuses(
        metadataResponse.status,
        entityDataResponse.status
    )

    if (loadingStatus === "error") {
        return <CausesOfDeathChartError />
    }

    if (loadingStatus === "pending") {
        return <CausesOfDeathSkeleton />
    }

    // Sanity check
    if (
        !metadata ||
        !activeData ||
        activeData.length === 0 ||
        !activeYear ||
        !activeEntityName ||
        !activeAgeGroup ||
        !activeSex
    )
        return <CausesOfDeathChartError />

    return (
        <div className="causes-of-death-chart">
            <CausesOfDeathControls
                metadata={metadata}
                ageGroup={ageGroup}
                sex={sex}
                entityName={entityName}
                year={activeYear}
                setAgeGroup={setAgeGroup}
                setSex={setSex}
                setEntityName={setEntityName}
                setYear={setYear}
            />
            <CausesOfDeathCaptionedChart
                data={activeData}
                metadata={metadata}
                ageGroup={activeAgeGroup}
                sex={activeSex}
                entityName={activeEntityName}
                year={activeYear}
                isLoading={isLoadingEntityData}
            />
        </div>
    )
}

function CausesOfDeathChartError() {
    return <div>Causes of Death visualization can't be loaded</div>
}

function CausesOfDeathSkeleton() {
    return (
        <div className="causes-of-death-skeleton">
            <CausesOfDeathSpinner />
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
