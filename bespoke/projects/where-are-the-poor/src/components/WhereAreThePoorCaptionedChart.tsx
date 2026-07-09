import { useMemo } from "react"
import * as R from "remeda"
import cx from "classnames"

import { Time } from "@ourworldindata/types"

import {
    DataRow,
    EXTREME_POVERTY_LINE_CENTS,
    formatGroupLabel,
    GroupBy,
    POVERTY_LINES,
    PovertyLine,
    WORLD_SELECTION,
} from "../helpers/PovertyConstants.js"
import { ResponsivePovertyTreemap } from "./PovertyTreemap.js"
import { formatCount, formatShare } from "../helpers/PovertyHelpers.js"
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
    aggregateRatios,
    populationByCountry,
    isLoading = false,
}: {
    data: DataRow[]
    povertyLineCents: number
    groupBy: GroupBy
    region: string
    year: Time
    aggregateRatios?: Map<string, Map<number, number>>
    populationByCountry?: Map<string, Map<number, number>>
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

    // Share of the population in poverty for the selected region. The
    // published headcount_ratio is used for the World and World Bank region
    // aggregates; for scopes without a published aggregate (continents, and
    // years before 1990), it is computed from the countries' headcounts and
    // populations.
    const shareOfPopulation = useMemo(() => {
        const aggregateName =
            region === WORLD_SELECTION
                ? WORLD_SELECTION
                : groupBy === "wbRegion"
                  ? region
                  : undefined
        const publishedRatio = aggregateName
            ? aggregateRatios?.get(aggregateName)?.get(year)
            : undefined
        if (publishedRatio !== undefined) return publishedRatio / 100

        if (!populationByCountry) return undefined
        const totalPopulation = R.sumBy(
            yearData,
            (d) => populationByCountry.get(d.countryName)?.get(year) ?? 0
        )
        return totalPopulation > 0 ? numTotalPoor / totalPopulation : undefined
    }, [
        region,
        groupBy,
        aggregateRatios,
        populationByCountry,
        yearData,
        numTotalPoor,
        year,
    ])

    return (
        <Frame className="where-are-the-poor-captioned-chart">
            <WhereAreThePoorHeader
                povertyLine={povertyLine}
                groupBy={groupBy}
                region={region}
                year={year}
            />

            <WhereAreThePoorStats
                povertyLine={povertyLine}
                region={region}
                numTotalPoor={numTotalPoor}
                shareOfPopulation={shareOfPopulation}
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

function WhereAreThePoorStats({
    povertyLine,
    region,
    numTotalPoor,
    shareOfPopulation,
    isLoading,
}: {
    povertyLine: PovertyLine
    region: string
    numTotalPoor: number
    shareOfPopulation?: number
    isLoading: boolean
}) {
    const isWorld = region === WORLD_SELECTION
    const isExtremePoverty = povertyLine.cents === EXTREME_POVERTY_LINE_CENTS

    const countLabel = isExtremePoverty
        ? "people live in extreme poverty"
        : `people live below ${povertyLine.label}`
    const shareLabel = isWorld
        ? "of the world's population"
        : `of the population of ${formatGroupLabel(region)}`

    const valueClassName = cx("where-are-the-poor-stats__value", {
        "where-are-the-poor-stats__value--loading": isLoading,
    })

    return (
        <div className="where-are-the-poor-stats">
            <div className="where-are-the-poor-stats__stat">
                <div className={valueClassName}>
                    {formatCount(numTotalPoor)}
                    {isLoading && <PovertyTreemapSpinner inline />}
                </div>
                <div className="where-are-the-poor-stats__label">
                    {countLabel}
                </div>
            </div>
            {shareOfPopulation !== undefined && (
                <div className="where-are-the-poor-stats__stat">
                    <div className={valueClassName}>
                        {formatShare(shareOfPopulation)}
                    </div>
                    <div className="where-are-the-poor-stats__label">
                        {shareLabel}
                    </div>
                </div>
            )}
        </div>
    )
}

function WhereAreThePoorHeader({
    povertyLine,
    groupBy,
    region,
    year,
}: {
    povertyLine: PovertyLine
    groupBy: GroupBy
    region: string
    year: Time
}) {
    const groupingLabel =
        groupBy === "continent" ? "continent" : "World Bank region"

    const isWorld = region === WORLD_SELECTION
    const regionLabel = formatGroupLabel(region)
    const isExtremePoverty = povertyLine.cents === EXTREME_POVERTY_LINE_CENTS

    // Mirrors the headcount_title of the world_bank_pip grapher configs:
    // the International Poverty Line is phrased as extreme poverty, the
    // other lines mention the poverty line itself
    const livingBelow = isExtremePoverty
        ? "living in extreme poverty"
        : `living below ${povertyLine.label}`

    const title = `Where are the people ${livingBelow}${isWorld ? "" : ` in ${regionLabel}`} in ${year}?`

    return (
        <ChartHeader
            className="where-are-the-poor-header"
            title={title}
            subtitle={
                <>
                    {povertyLine.definition && `${povertyLine.definition} `}
                    Each rectangle is proportional to the number of people{" "}
                    {livingBelow} in that country, grouped and colored by{" "}
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
