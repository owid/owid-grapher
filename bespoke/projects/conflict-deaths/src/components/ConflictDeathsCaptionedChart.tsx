import { useMemo } from "react"
import * as R from "remeda"
import cx from "clsx"

import { Time } from "@ourworldindata/types"

import {
    ConflictTypeMetadata,
    DataRow,
    getConflictTypePhrase,
} from "../core/ConflictDeathsConstants"
import { ResponsiveConflictDeathsTreemap } from "./ConflictDeathsTreemap"
import { formatExactCount } from "../core/ConflictDeathsHelpers.js"
import { ConflictDeathsMetadata } from "../core/ConflictDeathsMetadata.js"

import { Spinner } from "../../../../components/Spinner/Spinner.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Frame } from "../../../../components/Frame/Frame.js"

export function ConflictDeathsCaptionedChart({
    data,
    timeSeriesData,
    metadata,
    conflictType,
    year,
    isLoading = false,
}: {
    /** Deaths in the selected year */
    data: DataRow[]
    /** Deaths in all years, for the tooltip sparklines */
    timeSeriesData: DataRow[]
    metadata: ConflictDeathsMetadata
    conflictType: ConflictTypeMetadata
    year: Time
    isLoading?: boolean
}) {
    const numTotalDeaths = useMemo(() => R.sumBy(data, (d) => d.value), [data])

    return (
        <Frame className="conflict-deaths-captioned-chart">
            <ConflictDeathsHeader
                conflictType={conflictType}
                year={year}
                numTotalDeaths={numTotalDeaths}
                isLoading={isLoading}
            />

            <div className="conflict-deaths-captioned-chart__chart-area">
                {isLoading && <Spinner />}

                {numTotalDeaths > 0 ? (
                    <ResponsiveConflictDeathsTreemap
                        data={data}
                        timeSeriesData={timeSeriesData}
                        metadata={metadata}
                        year={year}
                    />
                ) : (
                    <div className="conflict-deaths-captioned-chart__no-data">
                        UCDP recorded no deaths in{" "}
                        {getConflictTypePhrase(conflictType)} in {year}.
                    </div>
                )}
            </div>
            <ChartFooter
                className="conflict-deaths-footer"
                source={metadata.source}
                note="Deaths due to disease and starvation resulting from the conflict are not included."
            />
        </Frame>
    )
}

function ConflictDeathsHeader({
    conflictType,
    year,
    numTotalDeaths,
    isLoading,
}: {
    conflictType: ConflictTypeMetadata
    year: Time
    numTotalDeaths: number
    isLoading: boolean
}) {
    const conflictTypePhrase = getConflictTypePhrase(conflictType)

    return (
        <ChartHeader
            className="conflict-deaths-header"
            title={`Where did people die in ${conflictTypePhrase} in ${year}?`}
            subtitle={
                <>
                    Reported deaths of combatants and civilians due to fighting,
                    by the country where the fighting took place.
                    {numTotalDeaths > 0 && (
                        <>
                            {" "}
                            The size of the entire visualization represents the
                            total number of deaths in {conflictTypePhrase}{" "}
                            worldwide in {year}:{" "}
                            <span
                                className={cx({
                                    "conflict-deaths-header__value--loading":
                                        isLoading,
                                })}
                            >
                                {formatExactCount(numTotalDeaths)}
                                {isLoading && <Spinner inline />}
                            </span>
                            . Each rectangle within is proportional to the share
                            of deaths in a particular country.
                        </>
                    )}
                </>
            }
        />
    )
}
