import * as R from "remeda"

import { articulateEntity } from "@ourworldindata/utils"

import { MigrationFlow, MigrationView } from "../types.js"
import { MigrationSankey } from "./MigrationSankey.js"

export function MigrationChart({
    immigrants,
    emigrants,
    country,
    year,
    immigrantsTotal,
    emigrantsTotal,
    view,
    setView,
}: {
    immigrants: MigrationFlow[]
    emigrants: MigrationFlow[]
    country: string
    year: number
    immigrantsTotal: number
    emigrantsTotal: number
    view: MigrationView
    setView: (view: MigrationView) => void
}) {
    const hasData = immigrants.length > 0 || emigrants.length > 0

    return (
        <div className="migration-captioned-chart__chart-area">
            {hasData ? (
                <MigrationSankey
                    immigrants={immigrants}
                    emigrants={emigrants}
                    country={country}
                    year={year}
                    immigrantsTotal={immigrantsTotal}
                    emigrantsTotal={emigrantsTotal}
                    view={view}
                    setView={setView}
                />
            ) : (
                <NoData
                    message={`No migrants recorded in ${R.capitalize(articulateEntity(country))} in ${year}.`}
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
