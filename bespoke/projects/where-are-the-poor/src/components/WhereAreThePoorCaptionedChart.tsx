import { useMemo } from "react"
import * as R from "remeda"
import cx from "classnames"

import { Time } from "@ourworldindata/types"

import {
    DataRow,
    formatGroupLabel,
    GroupBy,
    POVERTY_LINES,
    PovertyLine,
    WORLD_SELECTION,
} from "../helpers/PovertyConstants.js"
import { ResponsivePovertyTreemap } from "./PovertyTreemap.js"
import { formatCount } from "../helpers/PovertyHelpers.js"
import { PovertyTreemapSpinner } from "./PovertyTreemapSpinner.js"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"

const DATA_SOURCE = "World Bank Poverty and Inequality Platform (2026)"

const FOOTER_NOTE =
    "Poverty lines are expressed in international-$ at 2021 prices. " +
    "Depending on the country and year, the data relates to income or " +
    "consumption. Values between surveys are interpolated; values beyond " +
    "the most recent survey — including the most recent years — are " +
    "extrapolated using growth projections."

export function WhereAreThePoorCaptionedChart({
    data,
    povertyLineCents,
    groupBy,
    region,
    year,
    isLoading = false,
}: {
    data: DataRow[]
    povertyLineCents: number
    groupBy: GroupBy
    region: string
    year: Time
    isLoading?: boolean
}) {
    const povertyLine =
        POVERTY_LINES.find((line) => line.cents === povertyLineCents) ??
        POVERTY_LINES[0]

    const yearData = useMemo(
        () => data.filter((d) => d.year === year),
        [data, year]
    )

    const numTotalPoor = useMemo(
        () => R.sumBy(yearData, (d) => d.headcount),
        [yearData]
    )

    return (
        <Frame className="where-are-the-poor-captioned-chart">
            <WhereAreThePoorHeader
                povertyLine={povertyLine}
                groupBy={groupBy}
                region={region}
                year={year}
                numTotalPoor={numTotalPoor}
                isLoading={isLoading}
            />

            <div className="where-are-the-poor-captioned-chart__chart-area">
                {isLoading && <PovertyTreemapSpinner />}

                <ResponsivePovertyTreemap
                    data={yearData}
                    timeSeriesData={data}
                    povertyLine={povertyLine}
                    groupBy={groupBy}
                    region={region}
                    year={year}
                />
            </div>
            <WhereAreThePoorFooter />
        </Frame>
    )
}

function WhereAreThePoorHeader({
    povertyLine,
    groupBy,
    region,
    year,
    numTotalPoor,
    isLoading,
}: {
    povertyLine: PovertyLine
    groupBy: GroupBy
    region: string
    year: Time
    numTotalPoor: number
    isLoading: boolean
}) {
    const groupingLabel =
        groupBy === "continent" ? "continent" : "World Bank region"

    const isWorld = region === WORLD_SELECTION
    const regionLabel = formatGroupLabel(region)
    const title = isWorld
        ? "Where are the poor in the world?"
        : `Where are the poor in ${regionLabel}?`
    const location = isWorld ? "" : ` in ${regionLabel}`

    return (
        <ChartHeader
            className="where-are-the-poor-header"
            title={title}
            subtitle={
                <>
                    The size of the entire visualization represents the number
                    of people living below {povertyLine.label}
                    {location} in {year}:{" "}
                    <span
                        className={cx({
                            "where-are-the-poor-header__value--loading":
                                isLoading,
                        })}
                    >
                        {formatCount(numTotalPoor)}
                        {isLoading && <PovertyTreemapSpinner inline />}
                    </span>
                    . Each rectangle within is proportional to the number of
                    people in poverty in that country, grouped and colored by{" "}
                    {groupingLabel}.
                </>
            }
        />
    )
}

function WhereAreThePoorFooter() {
    return (
        <ChartFooter
            className="where-are-the-poor-footer"
            source={DATA_SOURCE}
            note={FOOTER_NOTE}
        />
    )
}
