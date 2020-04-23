import { observable, reaction, IReactionDisposer } from "mobx"

import { Country, countries } from "utils/countries"
import { ChartConfig } from "charts/ChartConfig"
import { excludeUndefined } from "charts/Util"
import { GlobalEntitySelectionUrl } from "./GlobalEntitySelectionUrl"
import { bindUrlToWindow } from "charts/UrlBinding"

export enum GlobalEntitySelectionStates {
    // Possibly might need the `add` state in the future to
    // add country from geolocation without clearing others.
    // One thing to figure out is what its behaviour should
    // be for single-entity charts.

    // add = "add",
    override = "override"
}

export type GlobalEntitySelectionEntity = Country

export class GlobalEntitySelection {
    private url?: GlobalEntitySelectionUrl
    private isBoundToWindow: boolean = false

    @observable state: GlobalEntitySelectionStates =
        GlobalEntitySelectionStates.override
    @observable
    selectedEntities: GlobalEntitySelectionEntity[] = []

    selectByCountryCodes(codes: string[]) {
        // We want to preserve the order, because order matters – the first entity is the "primary"
        // that is used on single-entity charts.
        this.selectedEntities = excludeUndefined(
            codes.map(code => countries.find(country => country.code === code))
        )
    }

    bindUrlParamsToWindow() {
        if (!this.isBoundToWindow) {
            this.url = new GlobalEntitySelectionUrl(this)
            this.url.populateFromQueryStr(window.location.search)
            bindUrlToWindow(this.url)
        }
    }
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
                chart.data.resetSelectedEntities()
            }
        },
        { fireImmediately: true }
    )
}

export function pageContainsGlobalEntityControl() {
    return document.querySelector("[data-global-entity-control]") !== null
}
