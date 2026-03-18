import { useMemo } from "react"
import * as R from "remeda"
import cx from "classnames"
import { Link, Tooltip, TooltipTrigger } from "react-aria-components"

import { EntityName, Time } from "@ourworldindata/types"
import { articulateEntity } from "@ourworldindata/utils"

import { DataRow } from "./CausesOfDeathConstants"
import { ResponsiveCausesOfDeathTreemap } from "./CausesOfDeathTreemap"
import { formatCount } from "./CausesOfDeathHelpers.js"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import { LoadingSpinner } from "./LoadingSpinner.js"
import { CountryData, DemographyMetadata } from "./DemographyTypes"
import { ResponsiveDemographyChartContent } from "./DemographyChartContent"

import { ChartHeader } from "../bespoke/components/ChartHeader/ChartHeader"
import { ChartFooter } from "../bespoke/components/ChartFooter/ChartFooter"

export function DemographyCaptionedChart({
    data,
    metadata,
    isLoading = false,
}: {
    data: CountryData
    metadata: DemographyMetadata
    isLoading?: boolean
}) {
    const countryName = data.country

    const title = `How many people will live in ${articulateEntity(countryName)} by 2100?`

    return (
        <div className="demography-captioned-chart">
            <ChartHeader
                title={title}
                subtitle="The UN projects how every country's population will change. But what if fertility falls faster? Or migration rises? Adjust the assumptions and compare."
            />
            <div className="demography-captioned-chart__chart-area">
                {isLoading && <LoadingSpinner />}
                <ResponsiveDemographyChartContent
                    data={data}
                    metadata={metadata}
                />
            </div>
            <ChartFooter
                className="demography-footer"
                source="List of data sources"
                note="Optional note; probably link to the technical documentation here?"
            />
        </div>
    )
}
