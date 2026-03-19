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
import type { ParametersVariantConfig } from "../config.js"
import { combineStatuses } from "../helpers/utils.js"

import { articulateEntity } from "@ourworldindata/utils"

import { CountryData } from "../helpers/types.js"
import { useSimulation } from "../helpers/useSimulation.js"
import { InputChartPanel } from "../components/SimulationContent.js"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"
import { DEFAULT_ENTITY_NAME } from "../helpers/constants.js"

export function ParametersVariantWithProviders(props: {
    container: HTMLDivElement
    config: ParametersVariantConfig
}): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <ParametersVariant config={props.config} />
        </QueryClientProvider>
    )
}

function ParametersVariant({
    config,
}: {
    config: ParametersVariantConfig
}): React.ReactElement {
    const showControls = !config.hideControls
    const [entityName, setEntityName] = useState(
        config.region ?? DEFAULT_ENTITY_NAME
    )

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
        <div className="demography-chart demography-chart--parameters">
            {showControls && (
                <DemographyControls
                    metadata={metadata}
                    entityName={entityName}
                    setEntityName={setEntityName}
                />
            )}
            <ParametersCaptionedChart
                data={entityData}
                isLoading={isLoadingEntityData}
                title={config.title}
                subtitle={config.subtitle}
            />
        </div>
    )
}

function ParametersCaptionedChart({
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
        `Demographic assumptions for ${articulateEntity(countryName)}`
    const subtitle =
        subtitleOverride ??
        "Drag the control points to adjust fertility, life expectancy, and migration assumptions"

    return (
        <Frame className="demography-parameters">
            <ChartHeader title={title} subtitle={subtitle} />
            <div className="demography-parameters__chart-area">
                {isLoading && <LoadingSpinner />}
                {simulation && (
                    <div className="demography-parameters__panels">
                        <InputChartPanel
                            simulation={simulation}
                            variant="fertilityRate"
                            className="parameters-panel"
                            interactive={false}
                            showProjectionLabel
                            valueLabelFontSize={10}
                        />
                        <InputChartPanel
                            simulation={simulation}
                            variant="lifeExpectancy"
                            className="parameters-panel"
                            interactive={false}
                            valueLabelFontSize={10}
                        />
                        <InputChartPanel
                            simulation={simulation}
                            variant="netMigrationRate"
                            className="parameters-panel"
                            interactive={false}
                            valueLabelFontSize={10}
                        />
                    </div>
                )}
            </div>
            <ChartFooter
                className="demography-footer"
                source="List of data sources"
            />
        </Frame>
    )
}
