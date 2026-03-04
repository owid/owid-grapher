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
import { GRAPHER_FRAME_PADDING_HORIZONTAL } from "../../core/GrapherConstants"
import { MapResetButton, MapResetButtonManager } from "../MapResetButton"
import {
    DataTableFilterDropdown,
    DataTableFilterDropdownManager,
} from "../DataTableFilterDropdown"
import {
    DataTableSearchField,
    DataTableSearchFieldManager,
} from "../DataTableSearchField"
import {
    MapZoomToSelectionButton,
    MapZoomToSelectionButtonManager,
} from "../MapZoomToSelectionButton"
import { MapZoomDropdown, MapZoomDropdownManager } from "../MapZoomDropdown"

export interface ControlsRowManager
    extends
        ContentSwitchersManager,
        EntitySelectionManager,
        SettingsMenuManager,
        MapRegionDropdownManager,
        MapResetButtonManager,
        MapZoomToSelectionButtonManager,
        MapZoomDropdownManager,
        DataTableFilterDropdownManager,
        DataTableSearchFieldManager {
    sidePanelBounds?: Bounds
    isSmall?: boolean
}

interface ControlsRowProps {
    manager: ControlsRowManager
    maxWidth?: number
    popoverMaxWidth?: number
    popoverMaxHeight?: number
}

@observer
export class ControlsRow extends Component<ControlsRowProps> {
    private framePaddingHorizontal = GRAPHER_FRAME_PADDING_HORIZONTAL

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

    @computed private get showControlsRow(): boolean {
        return (
            ContentSwitchers.shouldShow(this.manager) ||
            SettingsMenu.shouldShow(this.manager) ||
            EntitySelectionToggle.shouldShow(this.manager) ||
            // Map controls
            MapRegionDropdown.shouldShow(this.manager) ||
            MapZoomDropdown.shouldShow(this.manager) ||
            MapZoomToSelectionButton.shouldShow(this.manager) ||
            MapResetButton.shouldShow(this.manager, "resetZoom") ||
            MapResetButton.shouldShow(this.manager, "resetView") ||
            // Table controls
            DataTableFilterDropdown.shouldShow(this.manager) ||
            DataTableSearchField.shouldShow(this.manager)
        )
    }

    private renderChartControls(): React.ReactElement {
        return (
            <div className="controls chart-controls">
                <EntitySelectionToggle manager={this.manager} />
                <SettingsMenu
                    manager={this.manager}
                    popoverMaxWidth={this.props.popoverMaxWidth}
                    popoverMaxHeight={this.props.popoverMaxHeight}
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
                {this.manager.isMapSelectionEnabled
                    ? this.renderMapControlsForDesktop()
                    : this.renderMapControlsForMobile()}
            </div>
        )
    }

    private renderMapControlsForDesktop(): React.ReactElement {
        return (
            <>
                <MapResetButton manager={this.manager} action="resetZoom" />
                <MapZoomToSelectionButton manager={this.manager} />
                <MapResetButton manager={this.manager} action="resetView" />
                <MapRegionDropdown manager={this.manager} />
                <EntitySelectionToggle manager={this.manager} />
            </>
        )
    }

    private renderMapControlsForMobile(): React.ReactElement {
        const shouldShowResetZoomButton = MapResetButton.shouldShow(
            this.manager,
            "resetZoom"
        )

        if (shouldShowResetZoomButton)
            return <MapResetButton manager={this.manager} action="resetZoom" />

        return this.manager.isFaceted ? (
            <MapRegionDropdown manager={this.manager} />
        ) : (
            <MapZoomDropdown manager={this.manager} />
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
