import cx from "classnames"
import { QueryClientProvider } from "@tanstack/react-query"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"

import type { PopulationVariantConfig, VariantProps } from "../config.js"
import type { CountryData, DemographyMetadata } from "../helpers/types.js"

import { queryClient, useDemographyData } from "../helpers/fetch.js"
import { START_YEAR, END_YEAR } from "../helpers/constants.js"
import { useSimulation } from "../helpers/useSimulation.js"
import { useInitialEntityName } from "../helpers/useInitialEntityName.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../helpers/useBreakpoint.js"

import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import { PopulationChart } from "../components/PopulationChart.js"
import { EntityNameOrSelector } from "../components/EntityNameOrSelector.js"

export function PopulationVariant({
    config,
}: VariantProps<PopulationVariantConfig>): React.ReactElement {
    const { breakpoint, ref: rootRef } = useContainerBreakpoint()

    return (
        <QueryClientProvider client={queryClient}>
            <BreakpointProvider value={breakpoint}>
                <div
                    ref={rootRef}
                    className={cx(
                        "demography-chart demography-chart__population-variant",
                        breakpointClass(breakpoint)
                    )}
                >
                    <FetchingPopulationVariant config={config} />
                </div>
            </BreakpointProvider>
        </QueryClientProvider>
    )
}

function FetchingPopulationVariant({
    config,
}: {
    config: PopulationVariantConfig
}): React.ReactElement {
    const [entityName, setEntityName] = useInitialEntityName(config.region)

    const { metadata, entityData, isLoadingEntityData, status } =
        useDemographyData(entityName)

    if (status === "pending") return <DemographySkeleton />
    if (!metadata || !entityData) return <DemographyChartError />

    return (
        <CaptionedPopulationVariant
            data={entityData}
            metadata={metadata}
            entityName={entityName}
            setEntityName={setEntityName}
            title={config.title}
            subtitle={config.subtitle}
            hideControls={config.hideControls}
            isLoading={isLoadingEntityData}
        />
    )
}

function CaptionedPopulationVariant({
    data,
    metadata,
    entityName,
    setEntityName,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
    hideControls,
}: {
    data: CountryData
    metadata: DemographyMetadata
    entityName: string
    setEntityName: (name: string) => void
    isLoading?: boolean
    title?: string
    subtitle?: string
    hideControls?: boolean
}) {
    const simulation = useSimulation(data)
    const countryName = data.country

    const title: React.ReactNode = titleOverride ?? (
        <>
            Population of{" "}
            <EntityNameOrSelector
                hideControls={hideControls}
                entityName={entityName}
                countryName={countryName}
                metadata={metadata}
                onChange={setEntityName}
            />
            ,{" "}
            <span className="demography-chart__nowrap">
                {START_YEAR} to {END_YEAR}
            </span>
        </>
    )
    const subtitle =
        subtitleOverride ??
        "Historical estimates and projections of total population"

    return (
        <Frame className="demography-population-variant">
            <ChartHeader title={title} subtitle={subtitle} />

            <div className="demography-population-variant__chart-area">
                {isLoading && <LoadingSpinner />}
                {simulation && (
                    <PopulationChart
                        simulation={simulation}
                        showCustomProjection={false}
                    />
                )}
            </div>

            <ChartFooter
                className="demography-footer"
                source="Historical estimates and projections from the UN World Population Prospects"
            />
        </Frame>
    )
}
