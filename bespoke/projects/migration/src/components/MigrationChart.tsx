import { articulateEntity } from "@ourworldindata/utils"

import { MigrationFlow, MigrationView } from "../types.js"
import { capitalize } from "../helpers.js"
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
                    message={`No ${year} migration recorded for ${capitalize(articulateEntity(country))}.`}
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
