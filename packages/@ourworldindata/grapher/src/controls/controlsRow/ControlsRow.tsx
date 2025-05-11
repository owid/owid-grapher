import { Component } from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"

import { Bounds } from "@ourworldindata/utils"

import { ContentSwitchers, ContentSwitchersManager } from "../ContentSwitchers"
import {
    EntitySelectionToggle,
    EntitySelectionManager,
} from "../EntitySelectionToggle"
import {
    MapRegionDropdown,
    MapRegionDropdownManager,
} from "../MapRegionDropdown"
import { SettingsMenu, SettingsMenuManager } from "../SettingsMenu"
import {
    GRAPHER_FRAME_PADDING_HORIZONTAL,
    GRAPHER_FRAME_PADDING_VERTICAL,
} from "../../core/GrapherConstants"
import {
    MapCountryDropdown,
    MapCountryDropdownManager,
} from "../MapCountryDropdown"
import { CloseGlobeViewButton } from "../CloseGlobeViewButton"
import { GlobeSwitcher } from "../GlobeSwitcher"
import {
    DataTableFilterDropdown,
    DataTableFilterDropdownManager,
} from "../DataTableFilterDropdown"

export interface ControlsRowManager
    extends ContentSwitchersManager,
        EntitySelectionManager,
        MapRegionDropdownManager,
        MapCountryDropdownManager,
        SettingsMenuManager,
        DataTableFilterDropdownManager {
    sidePanelBounds?: Bounds
    isSmall?: boolean
}

@observer
export class ControlsRow extends Component<{
    manager: ControlsRowManager
    maxWidth?: number
    settingsMenuTop?: number
}> {
    private framePaddingHorizontal = GRAPHER_FRAME_PADDING_HORIZONTAL
    private framePaddingVertical = GRAPHER_FRAME_PADDING_VERTICAL

    static shouldShow(manager: ControlsRowManager): boolean {
        const test = new ControlsRow({ manager })
        return test.showControlsRow
    }

    @computed private get manager(): ControlsRowManager {
        return this.props.manager
    }

    @computed private get sidePanelWidth(): number {
        return this.manager.sidePanelBounds?.width ?? 0
    }

    @computed private get showControlsRow(): boolean {
        return (
            SettingsMenu.shouldShow(this.manager) ||
            EntitySelectionToggle.shouldShow(this.manager) ||
            MapRegionDropdown.shouldShow(this.manager) ||
            MapCountryDropdown.shouldShow(this.manager) ||
            CloseGlobeViewButton.shouldShow(this.manager) ||
            ContentSwitchers.shouldShow(this.manager) ||
            DataTableFilterDropdown.shouldShow(this.manager)
        )
    }

    private renderChartAndTableControls(): React.ReactElement {
        return (
            <div className="controls chart-controls">
                <EntitySelectionToggle manager={this.manager} />

                <SettingsMenu
                    manager={this.manager}
                    top={this.props.settingsMenuTop ?? 0}
                    bottom={this.framePaddingVertical}
                    right={this.sidePanelWidth + this.framePaddingHorizontal}
                />

                <DataTableFilterDropdown manager={this.manager} />
            </div>
        )
    }

    private renderMapControls(): React.ReactElement {
        return (
            <div className="controls map-controls">
                {this.manager.isMapSelectionEnabled ? (
                    <>
                        <MapRegionDropdown manager={this.manager} />
                        <GlobeSwitcher manager={this.manager} />
                        <EntitySelectionToggle manager={this.manager} />
                    </>
                ) : (
                    <>
                        <MapCountryDropdown manager={this.manager} />
                        <CloseGlobeViewButton manager={this.manager} />
                    </>
                )}
            </div>
        )
    }

    render(): React.ReactElement {
        return (
            <nav
                className="controlsRow"
                style={{ padding: `0 ${this.framePaddingHorizontal}px` }}
            >
                <div>
                    <ContentSwitchers manager={this.manager} />
                </div>
                <div className="controls">
                    {this.manager.isOnMapTab
                        ? this.renderMapControls()
                        : this.renderChartAndTableControls()}
                </div>
            </nav>
        )
    }
}
