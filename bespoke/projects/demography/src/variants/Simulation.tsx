import { useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"

import { DemographyControls } from "../components/DemographyControls.js"
import {
    queryClient,
    useDemographyEntityData,
    useDemographyMetadata,
} from "../helpers/fetch.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"
import type { SimulationVariantConfig } from "../config.js"
import { DEFAULT_ENTITY_NAME } from "../helpers/constants.js"
import { combineStatuses } from "../helpers/utils.js"
import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import { CountryData } from "../helpers/types.js"
import { articulateEntity } from "@ourworldindata/utils"
import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { SimulationContent } from "../components/SimulationContent.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"

export function SimulationVariantWithProviders(props: {
    container: HTMLDivElement
    config: SimulationVariantConfig
}): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <SimulationVariant config={props.config} />
        </QueryClientProvider>
    )
}

function SimulationVariant({
    config,
}: {
    config: SimulationVariantConfig
}): React.ReactElement {
    const [entityName, setEntityName] = useState(
        config.region ?? DEFAULT_ENTITY_NAME
    )

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

    const showControls = !config.hideControls

    return (
        <div className="demography-chart">
            {showControls && (
                <DemographyControls
                    metadata={metadata}
                    entityName={entityName}
                    setEntityName={setEntityName}
                />
            )}
            <SimulationCaptionedChart
                data={entityData}
                isLoading={isLoadingEntityData}
                title={config.title}
                subtitle={config.subtitle}
            />
        </div>
    )
}

function SimulationCaptionedChart({
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
    const countryName = data.country

    const title =
        titleOverride ??
        `How many people will live in ${articulateEntity(countryName)} by 2100?`
    const subtitle =
        subtitleOverride ??
        "The UN projects how every country's population will change. But what if fertility falls faster? Or migration rises? Adjust the assumptions and compare."

    return (
        <Frame className="demography-captioned-chart">
            <ChartHeader title={title} subtitle={subtitle} />
            <div className="demography-captioned-chart__chart-area">
                {isLoading && <LoadingSpinner />}
                <SimulationContent data={data} />
            </div>
            <ChartFooter
                className="demography-footer"
                source="List of data sources"
                note="Optional note; probably link to the technical documentation here?"
            />
        </Frame>
    )
}
