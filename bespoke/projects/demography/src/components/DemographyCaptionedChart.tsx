import { useMemo } from "react"
import * as R from "remeda"
import cx from "classnames"
import { Link, Tooltip, TooltipTrigger } from "react-aria-components"

import { EntityName, Time } from "@ourworldindata/types"
import { articulateEntity } from "@ourworldindata/utils"

import { LoadingSpinner } from "./LoadingSpinner.js"
import { CountryData, DemographyMetadata } from "../helpers/DemographyTypes"
import { ResponsiveDemographyChartContent } from "./DemographyChartContent"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter"
import { Frame } from "../../../../components/Frame/Frame.js"

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
        <Frame className="demography-captioned-chart">
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
        </Frame>
    )
}
