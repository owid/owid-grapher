import cx from "classnames"
import { QueryClientProvider } from "@tanstack/react-query"

import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import { queryClient, useDemographyData } from "../helpers/fetch.js"
import type { PopulationVariantConfig } from "../config.js"

import { entityNameForSentence } from "../helpers/utils.js"

import { CountryData, DemographyMetadata } from "../helpers/types.js"
import { useSimulation } from "../helpers/useSimulation.js"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"
import { ResponsivePopulationChart } from "../components/PopulationChart.js"
import { useInitialEntityName } from "../helpers/useInitialEntityName.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../helpers/useBreakpoint.js"
import { InlineEntitySelector } from "../components/InlineEntitySelector.js"

export function PopulationVariantWithProviders(props: {
    container: HTMLDivElement
    config: PopulationVariantConfig
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
    config: PopulationVariantConfig
}): React.ReactElement {
    const [entityName, setEntityName] = useInitialEntityName(config.region)

    const { metadata, entityData, isLoadingEntityData, status } =
        useDemographyData(entityName)

    const { breakpoint, ref: rootRef } = useContainerBreakpoint()

    if (status === "pending") return <DemographySkeleton />
    if (!metadata || !entityData) return <DemographyChartError />

    return (
        <BreakpointProvider value={breakpoint}>
            <div
                ref={rootRef}
                className={cx(
                    "demography-chart demography-chart__population-variant",
                    breakpointClass(breakpoint)
                )}
            >
                <PopulationCaptionedChart
                    data={entityData}
                    metadata={metadata}
                    entityName={entityName}
                    setEntityName={setEntityName}
                    isLoading={isLoadingEntityData}
                    subtitle={config.subtitle}
                    hideControls={config.hideControls}
                    breakpoint={breakpoint}
                />
            </div>
        </BreakpointProvider>
    )
}

function PopulationCaptionedChart({
    data,
    metadata,
    entityName,
    setEntityName,
    isLoading = false,
    subtitle: subtitleOverride,
    hideControls,
    _breakpoint,
}: {
    data: CountryData
    metadata: DemographyMetadata
    entityName: string
    setEntityName: (name: string) => void
    isLoading?: boolean
    subtitle?: string
    hideControls?: boolean
    _breakpoint?: string
}) {
    const simulation = useSimulation(data)
    const countryName = data.country

    const title: React.ReactNode = (
        <>
            Population of{" "}
            {hideControls ? (
                entityNameForSentence(countryName)
            ) : (
                <InlineEntitySelector
                    metadata={metadata}
                    entityName={entityName}
                    onChange={setEntityName}
                />
            )}
            , <span style={{ whiteSpace: "nowrap" }}>1950 to 2100</span>
        </>
    )
    const subtitle =
        subtitleOverride ??
        "Historical estimates and projections of total population"

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
                source="Historical estimates and projections from the UN World Population Prospects"
            />
        </Frame>
    )
}
