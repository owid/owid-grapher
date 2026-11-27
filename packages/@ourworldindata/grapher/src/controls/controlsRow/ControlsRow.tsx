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
import { ControlsRowLayout, findControlsRowLayout } from "./ControlsRowHelpers"

// Keep in sync with CaptionedChart.scss and Controls.scss
const ROW_SIDES_GAP_PX = 16
const CONTROLS_GAP_PX = 8

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
}

interface ControlsRowProps {
    manager: ControlsRowManager
    maxWidth: number
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
        return shouldShowControlsRow(manager)
    }

    static measureWidth(
        manager: ControlsRowManager,
        layout: ControlsRowLayout
    ): number {
        return measureControlsRowWidth(
            ContentSwitchers.measureWidth(manager, layout.tabs),
            measureControlWidths(manager, layout)
        )
    }

    @computed private get manager(): ControlsRowManager {
        return this.props.manager
    }

    @computed private get layout(): ControlsRowLayout {
        return findControlsRowLayout(
            (layout) => ControlsRow.measureWidth(this.manager, layout),
            this.props.maxWidth,
            this.manager.availableTabs?.length ?? 0
        )
    }

    private renderChartControls(): React.ReactElement {
        return (
            <div className="controls chart-controls">
                <EntitySelectionToggle
                    manager={this.manager}
                    labelMode={this.layout.entityLabel}
                />
                <SettingsMenu
                    manager={this.manager}
                    labelMode={this.layout.settingsLabel}
                    popoverMaxWidth={this.props.popoverMaxWidth}
                    popoverMaxHeight={this.props.popoverMaxHeight}
                />
            </div>
        )
    }

    private renderTableControls(): React.ReactElement {
        return (
            <div className="controls table-controls">
                {this.layout.showTableFilter && (
                    <DataTableFilterDropdown manager={this.manager} />
                )}
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
                <EntitySelectionToggle
                    manager={this.manager}
                    labelMode={this.layout.entityLabel}
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
                style={{ padding: `0 ${this.framePaddingHorizontal}px` }}
            >
                <div>
                    <ContentSwitchers
                        manager={this.manager}
                        layout={this.layout.tabs}
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

function shouldShowControlsRow(manager: ControlsRowManager): boolean {
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

function measureControlWidths(
    manager: ControlsRowManager,
    layout: ControlsRowLayout
): (number | undefined)[] {
    if (manager.isOnMapTab) {
        if (manager.isMapSelectionEnabled)
            return [
                MapResetButton.measureWidth(manager, "resetZoom"),
                MapZoomToSelectionButton.measureWidth(manager),
                MapResetButton.measureWidth(manager, "resetView"),
                MapRegionDropdown.measureWidth(manager),
                EntitySelectionToggle.measureWidth(manager, layout.entityLabel),
            ]

        const resetZoomWidth = MapResetButton.measureWidth(manager, "resetZoom")
        if (resetZoomWidth !== undefined) return [resetZoomWidth]
        if (manager.isFaceted) return [MapRegionDropdown.measureWidth(manager)]
        return [MapZoomDropdown.measureWidth(manager)]
    }

    if (manager.isOnTableTab)
        return [
            DataTableFilterDropdown.measureWidth(
                manager,
                layout.showTableFilter
            ),
            DataTableSearchField.measureWidth(manager),
        ]

    return [
        EntitySelectionToggle.measureWidth(manager, layout.entityLabel),
        SettingsMenu.measureWidth(manager, layout.settingsLabel),
    ]
}

function measureControlsRowWidth(
    tabGroupWidth: number,
    controlWidths: (number | undefined)[]
): number {
    const shownControlWidths = controlWidths.filter(
        (width) => width !== undefined
    )
    const gapsWidth =
        Math.max(0, shownControlWidths.length - 1) * CONTROLS_GAP_PX
    const controlsWidth = shownControlWidths.reduce(
        (total, width) => total + width,
        0
    )
    return tabGroupWidth + ROW_SIDES_GAP_PX + controlsWidth + gapsWidth
}
