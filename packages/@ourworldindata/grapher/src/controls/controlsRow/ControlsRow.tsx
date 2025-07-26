import { Component } from "react"
import { computed, makeObservable } from "mobx"
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
import {
    DataTableSearchField,
    DataTableSearchFieldManager,
} from "../DataTableSearchField"

export interface ControlsRowManager
    extends ContentSwitchersManager,
        EntitySelectionManager,
        MapRegionDropdownManager,
        MapCountryDropdownManager,
        SettingsMenuManager,
        DataTableFilterDropdownManager,
        DataTableSearchFieldManager {
    sidePanelBounds?: Bounds
    isSmall?: boolean
}

interface ControlsRowProps {
    manager: ControlsRowManager
    maxWidth?: number
    settingsMenuTop?: number
}

@observer
export class ControlsRow extends Component<ControlsRowProps> {
    private framePaddingHorizontal = GRAPHER_FRAME_PADDING_HORIZONTAL
    private framePaddingVertical = GRAPHER_FRAME_PADDING_VERTICAL

    constructor(props: ControlsRowProps) {
        super(props)
        makeObservable(this)
    }

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
            DataTableFilterDropdown.shouldShow(this.manager) ||
            DataTableSearchField.shouldShow(this.manager)
        )
    }

    @computed private get settingsMenuLayout(): React.CSSProperties {
        const top = this.props.settingsMenuTop ?? 0
        const bottom = this.framePaddingVertical
        const right = this.sidePanelWidth + this.framePaddingHorizontal

        const maxHeight = `calc(100% - ${top + bottom}px)`
        const maxWidth = `calc(100% - ${2 * right}px)`

        return { maxHeight, maxWidth, top, right }
    }

    private renderChartControls(): React.ReactElement {
        return (
            <div className="controls chart-controls">
                <EntitySelectionToggle manager={this.manager} />
                <SettingsMenu
                    manager={this.manager}
                    popoverStyle={this.settingsMenuLayout}
                />
            </div>
        )
    }

    private renderTableControls(): React.ReactElement {
        return (
            <div className="controls table-controls">
                <DataTableFilterDropdown manager={this.manager} />
                <DataTableSearchField manager={this.manager} />
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

    override render(): React.ReactElement {
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
                        : this.manager.isOnTableTab
                          ? this.renderTableControls()
                          : this.renderChartControls()}
                </div>
            </nav>
        )
    }
}
