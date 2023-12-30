import React from "react"
import Select from "react-select"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import { MapProjectionName } from "@ourworldindata/types"
import { MapProjectionLabels } from "../mapCharts/MapProjections"

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
}

interface MapProjectionMenuItem {
    label: string
    value: MapProjectionName
}

@observer
export class MapProjectionMenu extends React.Component<{
    manager: MapProjectionMenuManager
}> {
    static shouldShow(manager: MapProjectionMenuManager): boolean {
        const menu = new MapProjectionMenu({ manager })
        return menu.showMenu
    }

    @computed get showMenu(): boolean {
        const { hideMapProjectionMenu, isOnMapTab, mapConfig } =
                this.props.manager,
            { projection } = mapConfig ?? {}
        return !hideMapProjectionMenu && !!(isOnMapTab && projection)
    }

    @action.bound onChange(selected: MapProjectionMenuItem | null): void {
        const { mapConfig } = this.props.manager
        if (selected && mapConfig) mapConfig.projection = selected.value
    }

    @computed get options(): MapProjectionMenuItem[] {
        return Object.values(MapProjectionName).map((projectName) => {
            return {
                value: projectName,
                label: MapProjectionLabels[projectName],
            }
        })
    }

    @computed get value(): MapProjectionMenuItem | null {
        const { projection } = this.props.manager.mapConfig ?? {}
        return this.options.find((opt) => projection === opt.value) ?? null
    }

    render(): JSX.Element | null {
        return this.showMenu ? (
            <div className="map-projection-menu">
                <Select
                    options={this.options}
                    onChange={this.onChange}
                    value={this.value}
                    menuPlacement="bottom"
                    components={{
                        IndicatorSeparator: null,
                        DropdownIndicator: null,
                    }}
                    isSearchable={false}
                    unstyled={true}
                    isMulti={false}
                    classNames={{
                        control: (state) =>
                            state.menuIsOpen ? "active control" : "control",
                        option: (state) =>
                            state.isSelected ? "active option" : "option",
                        menu: () => "menu",
                    }}
                />
            </div>
        ) : null
    }
}
