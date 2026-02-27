import { useMemo } from "react"
import * as R from "remeda"
import cx from "classnames"
import { Link, Tooltip, TooltipTrigger } from "react-aria-components"

import { EntityName, Time } from "@ourworldindata/types"

import { DataRow } from "./CausesOfDeathConstants"
import { ResponsiveCausesOfDeathTreemap } from "./CausesOfDeathTreemap"
import { formatCountryName, formatCount } from "./CausesOfDeathHelpers.js"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import { CausesOfDeathSpinner } from "./CausesOfDeathSpinner.js"

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
                {isLoading && <CausesOfDeathSpinner />}

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
            : `in ${formatCountryName(entityName)}`

    return (
        <div className="causes-of-death-header">
            <OwidLogo />
            <header className="causes-of-death-header__content">
                <h1>
                    {`What do ${ageGroupName} die from?`}{" "}
                    <span>
                        Causes of death {location} in {year}
                    </span>
                </h1>
                <p className="causes-of-death-header__subtitle">
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
                </p>
            </header>
        </div>
    )
}

function CausesOfDeathFooter({
    metadata,
}: {
    metadata: CausesOfDeathMetadata
}) {
    return (
        <footer className="causes-of-death-footer">
            <div>
                <b>Data source:</b> {metadata.source}
            </div>
            <TooltipTrigger>
                <Link
                    className="causes-of-death-footer__cc"
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    CC BY
                </Link>
                <Tooltip className="causes-of-death-footer__tooltip">
                    Our World in Data charts are licensed under Creative
                    Commons; you are free to use, share, and adapt this
                    material. Click through to the CC BY page for more
                    information. Please bear in mind that the underlying source
                    data for all our charts might be subject to different
                    license terms from third-party authors.
                </Tooltip>
            </TooltipTrigger>
        </footer>
    )
}

function OwidLogo() {
    return (
        <img
            src="/owid-logo.svg"
            alt="Our World in Data logo"
            className="owid-logo"
            width={52}
            height={29}
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
        ageGroup === "All ages"
            ? "people"
            : ageGroup === "Children under 5"
              ? "children"
              : ageGroup.toLowerCase()

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
