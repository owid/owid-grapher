import { useMemo } from "react"
import * as R from "remeda"
import { DataRow, getRegionColor } from "../core/ConflictDeathsConstants"
import { ConflictDeathsMetadata } from "../core/ConflictDeathsMetadata"

/** Region legend, shown on small screens instead of the region annotations */
export function ConflictDeathsLegend({
    data,
    metadata,
}: {
    data: DataRow[]
    metadata: ConflictDeathsMetadata
}) {
    const regions = useMemo(() => {
        const deathsByRegion = R.pipe(
            data,
            R.groupBy((row) => row.region),
            R.mapValues((rows) => R.sumBy(rows, (row) => row.value))
        )

        return R.pipe(
            metadata.regions,
            R.filter((region) => (deathsByRegion[region.name] ?? 0) > 0),
            R.sortBy((region) => -(deathsByRegion[region.name] ?? 0)),
            R.map((region) => ({
                name: region.name,
                color: getRegionColor(region.name),
            }))
        )
    }, [data, metadata])

    return (
        <div className="conflict-deaths-legend">
            {regions.map((region) => (
                <div key={region.name} className="conflict-deaths-legend__item">
                    <div
                        className="conflict-deaths-legend__swatch"
                        style={{ backgroundColor: region.color }}
                    />
                    <span className="conflict-deaths-legend__label">
                        {region.name}
                    </span>
                </div>
            ))}
        </div>
    )
}
