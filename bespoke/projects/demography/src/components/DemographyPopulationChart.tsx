import { useState } from "react"
import { QueryStatus } from "@tanstack/react-query"

import { DemographyPopulationOnly } from "./DemographyPopulationOnly.js"
import { DemographyControls } from "./DemographyControls.js"
import { LoadingSpinner } from "./LoadingSpinner.js"
import {
    useDemographyEntityData,
    useDemographyMetadata,
} from "../helpers/DemographyDataFetching.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"

const DEFAULT_ENTITY_NAME = "United Kingdom"

export function DemographyPopulationChart({
    config,
}: {
    config?: Record<string, string>
}): React.ReactElement {
    const showControls = config?.hideControls !== "true"
    const [entityName, setEntityName] = useState(DEFAULT_ENTITY_NAME)

    const metadataResponse = useDemographyMetadata()
    const entityDataResponse = useDemographyEntityData(
        entityName,
        metadataResponse.data
    )

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
        return <div>Population chart can't be loaded</div>
    }

    if (loadingStatus === "pending") {
        return (
            <div className="demography-skeleton">
                <LoadingSpinner />
            </div>
        )
    }

    if (!metadata || !entityData) {
        return <div>Population chart can't be loaded</div>
    }

    return (
        <div className="demography-chart demography-chart--population">
            {showControls && (
                <DemographyControls
                    metadata={metadata}
                    entityName={entityName}
                    setEntityName={setEntityName}
                />
            )}
            <DemographyPopulationOnly
                data={entityData}
                metadata={metadata}
                isLoading={isLoadingEntityData}
                title={config?.title}
                subtitle={config?.subtitle}
            />
        </div>
    )
}

function combineStatuses(...statuses: QueryStatus[]): QueryStatus {
    if (statuses.some((status) => status === "error")) return "error"
    if (statuses.some((status) => status === "pending")) return "pending"
    return "success"
}
