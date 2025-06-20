import React from "react"
import { observer } from "mobx-react"
import { action, computed, observable } from "mobx"
import { TabKey, TabItem, Tabs } from "../tabs/Tabs"
import { MapConfig } from "../mapCharts/MapConfig"
import { GlobeController } from "../mapCharts/GlobeController"
import { EntityName, getUserCountryInformation } from "@ourworldindata/utils"
import { MapRegionDropdownValue } from "./MapRegionDropdown"

export interface GlobeSwitcherManager {
    mapConfig?: MapConfig
    globeController?: GlobeController
    mapRegionDropdownValue?: MapRegionDropdownValue
}

enum TabName {
    "2D" = "2D",
    "3D" = "3D",
}

const availableTabs = Object.values(TabName)

@observer
export class GlobeSwitcher extends React.Component<{
    manager: GlobeSwitcherManager
}> {
    @observable private localCountryName?: EntityName

    @computed private get manager(): GlobeSwitcherManager {
        return this.props.manager
    }

    @computed private get tabItems(): TabItem[] {
        return availableTabs.map((tabName) => ({
            key: tabName,
            element: <>{tabName}</>,
            buttonProps: { "data-track-note": "globe_switcher" },
        }))
    }

    @computed private get activeTabName(): TabName {
        return this.manager.mapConfig?.globe.isActive
            ? TabName["3D"]
            : TabName["2D"]
    }

    @action.bound setTab(activeTabName: TabName): void {
        if (activeTabName === TabName["3D"]) {
            if (this.manager.mapConfig?.selection.hasSelection) {
                // if the selection is not empty, rotate to it
                this.manager.globeController?.rotateToSelection()
            } else if (this.localCountryName) {
                // rotate to the user's current location if possible
                this.manager.globeController?.rotateToCountry(
                    this.localCountryName
                )
            } else {
                // choose a default rotation based on the time of day
                this.manager.globeController?.rotateToDefaultBasedOnTime()
            }
        } else {
            this.manager.globeController?.hideGlobe()
        }

        // reset the map region dropdown
        if (this.manager.mapRegionDropdownValue)
            this.manager.mapRegionDropdownValue = undefined
    }

    @action.bound async populateLocalCountryName(): Promise<void> {
        try {
            const localCountryInfo = await getUserCountryInformation()
            if (!localCountryInfo) return
            this.localCountryName = localCountryInfo.name
        } catch {
            // ignore
        }
    }

    componentDidMount(): void {
        void this.populateLocalCountryName()
    }

    render(): React.ReactElement | null {
        return (
            <Tabs
                className="GlobeSwitcher"
                variant="slim"
                items={this.tabItems}
                selectedKey={this.activeTabName}
                onChange={(key: TabKey) => this.setTab(key as TabName)}
            />
        )
    }
}
