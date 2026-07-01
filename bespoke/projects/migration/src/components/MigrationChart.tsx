import * as R from "remeda"

import { articulateEntity } from "@ourworldindata/utils"

import { Spinner } from "../../../../components/Spinner/Spinner.js"
import { MigrationFlow, MigrationView, Sex } from "../types.js"
import { getSexAdjective } from "../helpers.js"
import { MigrationSankey } from "./MigrationSankey.js"

export function MigrationChart({
    immigrants,
    emigrants,
    country,
    year,
    sex,
    immigrantsTotal,
    emigrantsTotal,
    view,
    setView,
    setCountry,
    colorMap,
    isLoading,
    entitiesToSortLast,
}: {
    immigrants: MigrationFlow[]
    emigrants: MigrationFlow[]
    country: string
    year: number
    sex: Sex
    immigrantsTotal: number
    emigrantsTotal: number
    view: MigrationView
    setView: (view: MigrationView) => void
    setCountry: (name: string) => void
    colorMap?: Map<string, string>
    isLoading?: boolean
    entitiesToSortLast?: string[]
}) {
    const hasData = immigrants.length > 0 || emigrants.length > 0

    const adjective = getSexAdjective(sex)
    const migrantsNoun = adjective ? `${adjective} migrants` : "migrants"

    return (
        <div className="migration-captioned-chart__chart-area">
            {isLoading && <Spinner />}
            {hasData ? (
                <MigrationSankey
                    immigrants={immigrants}
                    emigrants={emigrants}
                    country={country}
                    year={year}
                    sex={sex}
                    immigrantsTotal={immigrantsTotal}
                    emigrantsTotal={emigrantsTotal}
                    view={view}
                    setView={setView}
                    setCountry={setCountry}
                    colorMap={colorMap}
                    entitiesToSortLast={entitiesToSortLast}
                />
            ) : (
                <NoData
                    message={`No ${migrantsNoun} recorded in ${R.capitalize(articulateEntity(country))} in ${year}.`}
                />
            )}
        </div>
    )
}

function NoData({ message }: { message: React.ReactNode }) {
    return (
        <div className="migration-captioned-chart__empty">
            <p className="migration-captioned-chart__empty-message">
                {message}
            </p>
        </div>
    )
}
