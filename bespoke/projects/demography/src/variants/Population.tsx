import { useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"

import { DemographyControls } from "../components/DemographyControls.js"
import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import {
    queryClient,
    useDemographyEntityData,
    useDemographyMetadata,
} from "../helpers/fetch.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"
import type { PopulationConfig } from "../config.js"
import { combineStatuses } from "../helpers/utils.js"

import { articulateEntity } from "@ourworldindata/utils"

import { CountryData } from "../helpers/types.js"
import { useSimulation } from "../helpers/useSimulation.js"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"
import { ResponsivePopulationChart } from "../components/PopulationChart.js"
import { DEFAULT_ENTITY_NAME } from "../helpers/constants.js"

export function PopulationVariantWithProviders(props: {
    container: HTMLDivElement
    config: PopulationConfig
}): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <PopulationVariant config={props.config} />
        </QueryClientProvider>
    )
}

function PopulationVariant({
    config,
}: {
    config: PopulationConfig
}): React.ReactElement {
    const showControls = !config.hideControls
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
        return <DemographyChartError />
    }

    if (loadingStatus === "pending") {
        return <DemographySkeleton />
    }

    if (!metadata || !entityData) {
        return <DemographyChartError />
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
            <PopulationCaptionedChart
                data={entityData}
                isLoading={isLoadingEntityData}
                title={config.title}
                subtitle={config.subtitle}
            />
        </div>
    )
}

function PopulationCaptionedChart({
    data,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
}: {
    data: CountryData
    isLoading?: boolean
    title?: string
    subtitle?: string
}) {
    const simulation = useSimulation(data)
    const countryName = data.country

    const title =
        titleOverride ??
        `Population of ${articulateEntity(countryName)}, 1950 to 2100`
    const subtitle =
        subtitleOverride ??
        "Past estimates and future projections based on the UN's medium scenario"

    return (
        <Frame className="demography-population-only">
            <ChartHeader title={title} subtitle={subtitle} />
            <div className="demography-population-only__chart-area">
                {isLoading && <LoadingSpinner />}
                {simulation && (
                    <ResponsivePopulationChart
                        simulation={simulation}
                        showCustomProjection={false}
                    />
                )}
            </div>
            <ChartFooter
                className="demography-footer"
                source="List of data sources"
            />
        </Frame>
    )
}
