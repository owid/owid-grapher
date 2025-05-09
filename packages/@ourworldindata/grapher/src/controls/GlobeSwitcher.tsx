import React from "react"
import { observer } from "mobx-react"
import { action, computed, observable } from "mobx"
import { TabLabel, Tabs } from "../tabs/Tabs"
import { MapConfig } from "../mapCharts/MapConfig"
import { GlobeController } from "../mapCharts/GlobeController"
import { EntityName, getUserCountryInformation } from "@ourworldindata/utils"
import { MapRegionDropdownValue } from "./MapRegionDropdown"

export interface GlobeSwitcherManager {
    mapConfig?: MapConfig
    globeController?: GlobeController
    mapRegionDropdownValue?: MapRegionDropdownValue
}

@observer
export class GlobeSwitcher extends React.Component<{
    manager: GlobeSwitcherManager
}> {
    @observable private localCountryName?: EntityName

    private availableTabs = ["2D", "3D"] as const

    @computed private get manager(): GlobeSwitcherManager {
        return this.props.manager
    }

    @computed private get tabLabels(): TabLabel[] {
        return this.availableTabs.map((tabName) => ({
            element: <>{tabName}</>,
            buttonProps: { "data-track-note": "globe_switcher" },
        }))
    }

    @computed private get activeTabIndex(): number {
        return this.manager.mapConfig?.globe.isActive ? 1 : 0
    }

    @action.bound setTab(tabIndex: number): void {
        const newTab = this.availableTabs[tabIndex]

        if (newTab === "3D") {
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
                extraClassNames="GlobeSwitcher"
                variant="slim"
                labels={this.tabLabels}
                activeIndex={this.activeTabIndex}
                setActiveIndex={this.setTab}
            />
        )
    }
}
