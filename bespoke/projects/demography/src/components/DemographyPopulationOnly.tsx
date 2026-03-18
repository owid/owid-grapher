import { articulateEntity } from "@ourworldindata/utils"

import { CountryData, DemographyMetadata } from "../helpers/DemographyTypes"
import { useSimulation } from "../helpers/useSimulation"
import { ResponsivePopulationChart } from "./PopulationChart.js"
import { LoadingSpinner } from "./LoadingSpinner.js"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter"
import { Frame } from "../../../../components/Frame/Frame.js"

const DEFAULT_SUBTITLE =
    "Past estimates and future projections based on the UN's medium scenario"

export function DemographyPopulationOnly({
    data,
    metadata,
    isLoading = false,
    title: titleOverride,
    subtitle: subtitleOverride,
}: {
    data: CountryData
    metadata: DemographyMetadata
    isLoading?: boolean
    title?: string
    subtitle?: string
}) {
    const simulation = useSimulation(data)
    const countryName = data.country

    const title =
        titleOverride ??
        `Population of ${articulateEntity(countryName)}, 1950 to 2100`
    const subtitle = subtitleOverride ?? DEFAULT_SUBTITLE

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
                note=""
            />
        </Frame>
    )
}
