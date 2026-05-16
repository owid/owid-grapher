import { useCallback, useEffect, useMemo, useState } from "react"
import cx from "classnames"
import { QueryClientProvider } from "@tanstack/react-query"

import { queryClient, useDemographyData } from "../helpers/fetch.js"
import type {
    PopulationPyramidUnit,
    SimulationVariantConfig,
    VariantProps,
} from "../config.js"
import {
    CHART_FOOTER_SOURCES,
    DEFAULT_ENTITY_NAME,
} from "../helpers/constants.js"
import { useInitialEntityName } from "../helpers/useInitialEntityName.js"
import { parseSimulationUrlState } from "../helpers/urlState.js"
import {
    DemographyChartError,
    DemographySkeleton,
    LoadingSpinner,
} from "../components/DemographyLoadAndError.js"
import {
    CountryData,
    DemographyMetadata,
    ParameterKey,
} from "../helpers/types.js"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { SimulationContent } from "../components/SimulationContent.js"
import { EntityNameOrSelector } from "../components/EntityNameOrSelector.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import {
    BreakpointProvider,
    useContainerBreakpoint,
    breakpointClass,
} from "../helpers/useBreakpoint.js"

export function SimulationVariant({
    config,
}: VariantProps<SimulationVariantConfig>): React.ReactElement {
    const { breakpoint, ref: rootRef } = useContainerBreakpoint()

    return (
        <QueryClientProvider client={queryClient}>
            <BreakpointProvider value={breakpoint}>
                <div
                    ref={rootRef}
                    className={cx(
                        "demography-chart demography-chart__simulation-variant",
                        breakpointClass(breakpoint)
                    )}
                >
                    <FetchingSimulationVariant config={config} />
                </div>
            </BreakpointProvider>
        </QueryClientProvider>
    )
}

function FetchingSimulationVariant({
    config,
}: {
    config: SimulationVariantConfig
}): React.ReactElement {
    const urlState = useMemo(
        () => (config.urlSync ? parseSimulationUrlState() : {}),
        [config.urlSync]
    )
    const [shouldSyncEntityName, setShouldSyncEntityName] = useState(
        Boolean(urlState.entityName)
    )
    const [entityName, setEntityNameRaw] = useInitialEntityName(
        urlState.entityName ?? config.region
    )
    const setEntityName = useCallback(
        (name: string) => {
            if (config.urlSync) setShouldSyncEntityName(true)
            setEntityNameRaw(name)
        },
        [config.urlSync, setEntityNameRaw]
    )

    const { metadata, entityData, isLoadingEntityData, status } =
        useDemographyData(entityName)

    useEffect(() => {
        if (!metadata) return
        if (metadata.slugs[entityName]) return

        const fallbackEntityName =
            config.region && metadata.slugs[config.region]
                ? config.region
                : DEFAULT_ENTITY_NAME
        setEntityNameRaw(fallbackEntityName)
        setShouldSyncEntityName(false)
    }, [config.region, entityName, metadata, setEntityNameRaw])

    if (status === "pending") return <DemographySkeleton />
    if (metadata && !metadata.slugs[entityName]) return <DemographySkeleton />
    if (!metadata || !entityData) return <DemographyChartError />

    return (
        <CaptionedSimulationVariant
            data={entityData}
            metadata={metadata}
            entityName={entityName}
            setEntityName={setEntityName}
            isLoading={isLoadingEntityData}
            title={config.title}
            subtitle={config.subtitle}
            hideEntitySelector={config.hideEntitySelector}
            focusParameter={config.focusParameter}
            hidePopulationPyramid={config.hidePopulationPyramid}
            populationPyramidUnit={config.populationPyramidUnit}
            fertilityRateAssumptions={config.fertilityRateAssumptions}
            lifeExpectancyAssumptions={config.lifeExpectancyAssumptions}
            netMigrationRateAssumptions={config.netMigrationRateAssumptions}
            urlSync={config.urlSync}
            urlFertilityRateAssumptions={urlState.fertilityRateAssumptions}
            urlLifeExpectancyAssumptions={urlState.lifeExpectancyAssumptions}
            urlNetMigrationRateAssumptions={
                urlState.netMigrationRateAssumptions
            }
            baselineEntityName={getBaselineEntityName(config.region)}
            shouldSyncEntityName={shouldSyncEntityName}
        />
    )
}

function getBaselineEntityName(region: string | undefined): string | undefined {
    if (!region || region === "userLocation") return undefined
    return region
}

function CaptionedSimulationVariant({
    data,
    metadata,
    entityName,
    setEntityName,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
    hideEntitySelector,
    focusParameter,
    hidePopulationPyramid,
    populationPyramidUnit,
    fertilityRateAssumptions,
    lifeExpectancyAssumptions,
    netMigrationRateAssumptions,
    urlSync,
    urlFertilityRateAssumptions,
    urlLifeExpectancyAssumptions,
    urlNetMigrationRateAssumptions,
    baselineEntityName,
    shouldSyncEntityName,
}: {
    data: CountryData
    metadata: DemographyMetadata
    entityName: string
    setEntityName: (name: string) => void
    isLoading?: boolean
    title?: string
    subtitle?: string
    hideEntitySelector?: boolean
    focusParameter?: ParameterKey
    hidePopulationPyramid?: boolean
    populationPyramidUnit?: PopulationPyramidUnit
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
    urlSync?: boolean
    urlFertilityRateAssumptions?: Record<number, number>
    urlLifeExpectancyAssumptions?: Record<number, number>
    urlNetMigrationRateAssumptions?: Record<number, number>
    baselineEntityName?: string
    shouldSyncEntityName?: boolean
}) {
    const countryName = data.country

    const title: React.ReactNode = titleOverride ? (
        titleOverride
    ) : hideEntitySelector && countryName === "World" ? (
        <>How many people will there be by 2100?</>
    ) : (
        <>
            How many people will live in{" "}
            <EntityNameOrSelector
                hideEntitySelector={hideEntitySelector}
                entityName={entityName}
                countryName={countryName}
                metadata={metadata}
                onChange={setEntityName}
            />{" "}
            by 2100?
        </>
    )
    const subtitle =
        subtitleOverride ??
        "Demographers publish projections of how populations will change in the future. But what if fertility rates fall faster, or rebound? Or migration rates change? Adjust these assumptions and compare."

    return (
        <Frame className="demography-captioned-chart">
            <ChartHeader
                className="demography-header"
                title={title}
                subtitle={subtitle}
            />
            <div className="demography-captioned-chart__chart-area">
                {isLoading && <LoadingSpinner />}
                <SimulationContent
                    data={data}
                    focusParameter={focusParameter}
                    hidePopulationPyramid={hidePopulationPyramid}
                    populationPyramidUnit={populationPyramidUnit}
                    fertilityRateAssumptions={fertilityRateAssumptions}
                    lifeExpectancyAssumptions={lifeExpectancyAssumptions}
                    netMigrationRateAssumptions={netMigrationRateAssumptions}
                    urlSync={urlSync}
                    urlFertilityRateAssumptions={urlFertilityRateAssumptions}
                    urlLifeExpectancyAssumptions={urlLifeExpectancyAssumptions}
                    urlNetMigrationRateAssumptions={
                        urlNetMigrationRateAssumptions
                    }
                    baselineEntityName={baselineEntityName}
                    shouldSyncEntityName={shouldSyncEntityName}
                />
            </div>
            <ChartFooter
                className="demography-footer"
                source={CHART_FOOTER_SOURCES}
                note={
                    <>
                        Technical details and assumptions used in this
                        population model are available at{" "}
                        <a
                            href="https://docs.owid.io/projects/etl/analyses/population_tool"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            https://docs.owid.io/projects/etl/analyses/population_tool
                        </a>
                    </>
                }
            />
        </Frame>
    )
}
