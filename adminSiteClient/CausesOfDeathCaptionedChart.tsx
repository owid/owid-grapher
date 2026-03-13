import { useMemo } from "react"
import * as R from "remeda"
import cx from "classnames"

import { EntityName, Time } from "@ourworldindata/types"
import { articulateEntity } from "@ourworldindata/utils"

import { DataRow } from "./CausesOfDeathConstants"
import { ResponsiveCausesOfDeathTreemap } from "./CausesOfDeathTreemap"
import { formatCount } from "./CausesOfDeathHelpers.js"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import { LoadingSpinner } from "./LoadingSpinner.js"

import { ChartHeader } from "../bespoke/components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../bespoke/components/ChartFooter/ChartFooter.js"

export function CausesOfDeathCaptionedChart({
    data,
    metadata,
    ageGroup,
    sex,
    entityName,
    year,
    isLoading = false,
}: {
    data: DataRow[]
    metadata: CausesOfDeathMetadata
    ageGroup: string
    sex: string
    entityName: EntityName
    year: Time
    isLoading?: boolean
}) {
    const entityData = useMemo(
        () => data.filter((d) => d.year === year),
        [data, year]
    )

    const numTotalDeaths = useMemo(
        () => R.sumBy(entityData, (d) => d.value),
        [entityData]
    )

    return (
        <div className="causes-of-death-captioned-chart">
            <CausesOfDeathHeader
                ageGroup={ageGroup}
                sex={sex}
                entityName={entityName}
                year={year}
                numTotalDeaths={numTotalDeaths}
                isLoading={isLoading}
            />

            <div className="causes-of-death-captioned-chart__chart-area">
                {isLoading && <LoadingSpinner />}

                <ResponsiveCausesOfDeathTreemap
                    data={entityData}
                    timeSeriesData={data}
                    metadata={metadata}
                    entityName={entityName}
                    year={year}
                    ageGroup={ageGroup}
                />
            </div>
            <CausesOfDeathFooter metadata={metadata} />
        </div>
    )
}

function CausesOfDeathHeader({
    entityName,
    year,
    ageGroup,
    sex,
    numTotalDeaths,
    isLoading,
}: {
    entityName: EntityName
    year: Time
    ageGroup: string
    sex: string
    numTotalDeaths: number
    isLoading: boolean
}) {
    const ageGroupName = getAgeGroupDisplayName({ ageGroup, sex })

    const location =
        entityName === "World"
            ? "globally"
            : `in ${articulateEntity(entityName)}`

    const title =
        entityName === "World"
            ? `What did ${ageGroupName} die from in ${year}?`
            : `What did ${ageGroupName} in ${articulateEntity(entityName)} die from in ${year}?`

    return (
        <ChartHeader
            className="causes-of-death-header"
            title={title}
            subtitle={
                <>
                    The size of the entire visualization represents the total
                    number of deaths {location} in {year}:{" "}
                    <span
                        className={cx({
                            "causes-of-death-header__value--loading": isLoading,
                        })}
                    >
                        {formatCount(numTotalDeaths)}
                    </span>
                    . Each rectangle within is proportional to the share of
                    deaths due to a particular cause.
                </>
            }
        />
    )
}

function CausesOfDeathFooter({
    metadata,
}: {
    metadata: CausesOfDeathMetadata
}) {
    return (
        <ChartFooter
            className="causes-of-death-footer"
            source={metadata.source}
        />
    )
}

function getAgeGroupDisplayName({
    ageGroup,
    sex,
}: {
    ageGroup: string
    sex: string
}): string {
    const ageGroupName =
        ageGroup === "All ages" ? "people" : ageGroup.toLowerCase()

    if (sex === "Male") {
        return ageGroupName
            .replace("children", "boys")
            .replace("adults", "men")
            .replace("people", "men")
    } else if (sex === "Female") {
        return ageGroupName
            .replace("children", "girls")
            .replace("adults", "women")
            .replace("people", "women")
    }

    return ageGroupName
}
