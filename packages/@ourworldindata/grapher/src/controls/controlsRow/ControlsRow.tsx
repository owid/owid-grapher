import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"

import { Bounds, DEFAULT_BOUNDS } from "@ourworldindata/utils"
import { ChartTypeName, GrapherTabOption } from "@ourworldindata/types"

import { ContentSwitchers, ContentSwitchersManager } from "../ContentSwitchers"
import {
    EntitySelectionToggle,
    EntitySelectionManager,
} from "../EntitySelectionToggle"
import {
    MapProjectionMenu,
    MapProjectionMenuManager,
} from "../MapProjectionMenu"
import { SettingsMenu, SettingsMenuManager } from "../SettingsMenu"
import { DEFAULT_GRAPHER_FRAME_PADDING } from "../../core/GrapherConstants"

export interface ControlsRowManager
    extends ContentSwitchersManager,
        EntitySelectionManager,
        MapProjectionMenuManager,
        SettingsMenuManager {
    sidePanelBounds?: Bounds
    sortedAvailableTabs?: GrapherTabOption[]
    showEntitySelectionToggle?: boolean
    framePaddingHorizontal?: number
    framePaddingVertical?: number
}

@observer
export class ControlsRow extends React.Component<{
    manager: ControlsRowManager
    maxWidth?: number
    settingsMenuTop?: number
}> {
    static shouldShow(manager: ControlsRowManager): boolean {
        const test = new ControlsRow({ manager })
        return test.showControlsRow
    }

    @computed private get manager(): ControlsRowManager {
        return this.props.manager
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed private get framePaddingHorizontal(): number {
        return (
            this.manager.framePaddingHorizontal ?? DEFAULT_GRAPHER_FRAME_PADDING
        )
    }

    @computed private get framePaddingVertical(): number {
        return (
            this.manager.framePaddingVertical ?? DEFAULT_GRAPHER_FRAME_PADDING
        )
    }

    @computed private get sidePanelWidth(): number {
        return this.manager.sidePanelBounds?.width ?? 0
    }

    @computed private get contentSwitchersWidth(): number {
        return ContentSwitchers.width(this.manager)
    }

    @computed private get availableWidth(): number {
        return this.maxWidth - this.contentSwitchersWidth - 16
    }

    @computed private get showControlsRow(): boolean {
        return (
            SettingsMenu.shouldShow(this.manager) ||
            EntitySelectionToggle.shouldShow(this.manager) ||
            MapProjectionMenu.shouldShow(this.manager) ||
            ContentSwitchers.shouldShow(this.manager)
        )
    }

    render(): JSX.Element {
        const { showEntitySelectionToggle } = this.manager
        return (
            <nav
                className="controlsRow"
                style={{
                    padding: `0 ${this.framePaddingHorizontal}px`,
                }}
            >
                <div>
                    <ContentSwitchers manager={this.manager} />
                </div>
                <div className="chart-controls">
                    {showEntitySelectionToggle && (
                        <EntitySelectionToggle manager={this.manager} />
                    )}

                    <SettingsMenu
                        manager={this.manager}
                        maxWidth={this.availableWidth}
                        top={this.props.settingsMenuTop ?? 0}
                        bottom={this.framePaddingVertical}
                        right={
                            this.sidePanelWidth + this.framePaddingHorizontal
                        }
                    />
                    <MapProjectionMenu
                        manager={this.manager}
                        maxWidth={this.availableWidth}
                    />
                </div>
            </nav>
        )
    }
}
