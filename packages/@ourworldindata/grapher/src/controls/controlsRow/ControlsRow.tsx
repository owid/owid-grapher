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
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FRAME_PADDING_HORIZONTAL,
} from "../../core/GrapherConstants"
import { chooseControlsRowLayout, ControlsRowLayout } from "./ControlsRowLayout"
import { CONTROLS_ROW_CSS_VARIABLES } from "./ControlsRowConstants"
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
    private readonly framePaddingHorizontal = GRAPHER_FRAME_PADDING_HORIZONTAL

    constructor(props: ControlsRowProps) {
        super(props)
        makeObservable(this)
    }

    static shouldShow(manager: ControlsRowManager): boolean {
        return (
            ContentSwitchers.shouldShow(manager) ||
            SettingsMenu.shouldShow(manager) ||
            EntitySelectionToggle.shouldShow(manager) ||
            // Map controls
            MapRegionDropdown.shouldShow(manager) ||
            MapZoomDropdown.shouldShow(manager) ||
            MapZoomToSelectionButton.shouldShow(manager) ||
            MapResetButton.shouldShow(manager, "resetZoom") ||
            MapResetButton.shouldShow(manager, "resetView") ||
            // Table controls
            DataTableFilterDropdown.shouldShow(manager) ||
            DataTableSearchField.shouldShow(manager)
        )
    }

    @computed private get manager(): ControlsRowManager {
        return this.props.manager
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_GRAPHER_BOUNDS.width
    }

    @computed private get layout(): ControlsRowLayout {
        return chooseControlsRowLayout(this.manager, this.maxWidth)
    }

    // mirrored by measureChartControlsWidth in ControlsRowLayout.ts
    private renderChartControls(): React.ReactElement {
        return (
            <div className="controls chart-controls">
                <EntitySelectionToggle
                    manager={this.manager}
                    entityLabelMode={this.layout.entityLabelMode}
                />
                <SettingsMenu
                    manager={this.manager}
                    popoverMaxWidth={this.props.popoverMaxWidth}
                    popoverMaxHeight={this.props.popoverMaxHeight}
                    showLabel={this.layout.showSettingsLabel}
                />
            </div>
        )
    }

    // mirrored by measureTableControlsWidth in ControlsRowLayout.ts
    private renderTableControls(): React.ReactElement {
        return (
            <div className="controls table-controls">
                <DataTableFilterDropdown manager={this.manager} />
                <DataTableSearchField manager={this.manager} />
            </div>
        )
    }

    // mirrored by measureMapControlsWidth in ControlsRowLayout.ts
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
                <EntitySelectionToggle
                    manager={this.manager}
                    entityLabelMode={this.layout.entityLabelMode}
                />
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
                style={{
                    padding: `0 ${this.framePaddingHorizontal}px`,
                    ...CONTROLS_ROW_CSS_VARIABLES,
                }}
            >
                <div>
                    <ContentSwitchers
                        manager={this.manager}
                        showTabLabels={this.layout.showTabLabels}
                        tabPadding={this.layout.tabPadding}
                    />
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
