import React from "react"
import { observer } from "mobx-react"
import { action, computed, observable, makeObservable } from "mobx"
import { TabItem, Tabs } from "../tabs/Tabs"
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

    private availableTabs = ["2D", "3D"] as const

    constructor(props: { manager: GlobeSwitcherManager }) {
        super(props)
        makeObservable(this)
    }

    @computed private get manager(): GlobeSwitcherManager {
        return this.props.manager
    }

    @computed get mapConfig(): MapConfig {
        return this.manager.mapConfig ?? new MapConfig()
    }

    @computed private get tabItems(): TabItem<TabName>[] {
        return availableTabs.map((tabName) => ({
            key: tabName,
            element: <>{tabName}</>,
            buttonProps: { "data-track-note": "globe_switcher" },
        }))
    }

    @computed private get activeTabName(): TabName {
        return this.mapConfig?.globe.isActive ? TabName["3D"] : TabName["2D"]
    }

    @action.bound setTab(activeTab: TabName): void {
        if (activeTab === TabName["3D"]) {
            if (this.mapConfig.selection.hasSelection) {
                // if the selection is not empty, rotate to it
                this.manager.globeController?.rotateToSelection()
            } else if (this.mapConfig.isContinentActive()) {
                // If a region is provided, rotate to it
                this.manager.globeController?.rotateToOwidContinent(
                    this.mapConfig.region
                )
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
            this.manager.globeController?.resetGlobe()
        }
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
                onChange={this.setTab}
            />
        )
    }
}
