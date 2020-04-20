import { observable, reaction, IReactionDisposer } from "mobx"

import { Country, countries } from "utils/countries"
import { ChartConfig } from "charts/ChartConfig"

export enum GlobalEntitySelectionStates {
    // Possibly might need the `add` state in the future to
    // add country from geolocation without clearing others.
    // One thing to figure out is what its behaviour should
    // be for single-entity charts.

    // add = "add",
    override = "override"
}

export type GlobalEntitySelectionEntity = Country

// How to send signal to chart to reset its overrides?
export class GlobalEntitySelection {
    @observable state: GlobalEntitySelectionStates =
        GlobalEntitySelectionStates.override
    @observable
    selectedEntities: GlobalEntitySelectionEntity[] = countries.filter(
        c => c.code === "GBR" || c.code === "ITA"
    )
}

export function subscribeChartToGlobalEntitySelection(
    chart: ChartConfig,
    globalSelection: GlobalEntitySelection
): IReactionDisposer {
    return reaction(
        () => chart.data.isReady && globalSelection.selectedEntities,
        () => {
            const { selectedEntities } = globalSelection
            if (!chart.data.canAddData && !chart.data.canChangeEntity) {
                // Chart doesn't support changing entities - do nothing
                return
            }

            // This implements "override" mode only!
            if (selectedEntities.length > 0) {
                chart.data.setSelectedEntitiesByCode(
                    selectedEntities.map(entity => entity.code)
                )
            } else {
                chart.data.setSelectedEntitiesDefault()
            }
        },
        { fireImmediately: true }
    )
}
