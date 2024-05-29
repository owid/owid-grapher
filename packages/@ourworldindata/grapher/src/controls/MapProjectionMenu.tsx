import React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { MapProjectionName } from "@ourworldindata/types"
import { MapProjectionLabels } from "../mapCharts/MapProjections"
import { Dropdown } from "./Dropdown"
import { DEFAULT_BOUNDS } from "@ourworldindata/utils"
import { GlobeController } from "../mapCharts/GlobeController"

export { AbsRelToggle } from "./settings/AbsRelToggle"
export { FacetStrategySelector } from "./settings/FacetStrategySelector"
export { FacetYDomainToggle } from "./settings/FacetYDomainToggle"
export { NoDataAreaToggle } from "./settings/NoDataAreaToggle"
export { TableFilterToggle } from "./settings/TableFilterToggle"
export { ZoomToggle } from "./settings/ZoomToggle"

export interface MapProjectionMenuManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    hideMapProjectionMenu?: boolean
    globeController?: GlobeController
    isGlobe?: boolean
}

interface MapProjectionMenuItem {
    label: string
    value: MapProjectionName
}

@observer
export class MapProjectionMenu extends React.Component<{
    manager: MapProjectionMenuManager
    maxWidth?: number
}> {
    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @action.bound onChange(selected: unknown): void {
        const { mapConfig } = this.props.manager
        if (selected && mapConfig) {
            const projection = (selected as MapProjectionMenuItem).value
            mapConfig.projection = projection

            void this.props.manager.globeController?.rotateToProjection(
                projection
            )
        }
    }

    @computed get options(): MapProjectionMenuItem[] {
        return Object.values(MapProjectionName)
            .filter((projectionName) =>
                this.props.manager.isGlobe
                    ? projectionName !== MapProjectionName.World
                    : true
            )
            .map((projectionName) => {
                return {
                    value: projectionName,
                    label: MapProjectionLabels[projectionName],
                }
            })
    }

    @computed get value(): MapProjectionMenuItem | null {
        const { projection } = this.props.manager.mapConfig ?? {}
        const option =
            this.options.find((opt) => projection === opt.value) ?? null
        if (this.props.manager.isGlobe) return option
        const world =
            this.options.find((opt) => opt.value === MapProjectionName.World) ??
            null
        return option ?? world
    }

    render(): React.ReactElement | null {
        return (
            <div
                className="map-projection-menu"
                style={{ maxWidth: this.maxWidth }}
            >
                <Dropdown
                    placeholder="Select continent..."
                    options={this.options}
                    onChange={this.onChange}
                    value={this.value}
                />
            </div>
        )
    }
}
