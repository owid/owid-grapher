import { Component } from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"

import { Bounds, DEFAULT_BOUNDS } from "@ourworldindata/utils"

import { ContentSwitchers, ContentSwitchersManager } from "../ContentSwitchers"
import {
    EntitySelectionToggle,
    EntitySelectionManager,
} from "../EntitySelectionToggle"
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

export interface ControlsRowManager
    extends ContentSwitchersManager,
        EntitySelectionManager,
        MapCountryDropdownManager,
        SettingsMenuManager {
    sidePanelBounds?: Bounds
    showEntitySelectionToggle?: boolean
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

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
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

    @computed private get showContentSwitchers(): boolean {
        return ContentSwitchers.shouldShow(this.manager)
    }

    @computed private get showControlsRow(): boolean {
        return (
            SettingsMenu.shouldShow(this.manager) ||
            EntitySelectionToggle.shouldShow(this.manager) ||
            MapCountryDropdown.shouldShow(this.manager) ||
            CloseGlobeViewButton.shouldShow(this.manager) ||
            this.showContentSwitchers
        )
    }

    render(): JSX.Element {
        const { showEntitySelectionToggle } = this.manager
        return (
            <nav
                className="controlsRow"
                style={{ padding: `0 ${this.framePaddingHorizontal}px` }}
            >
                <div>
                    {this.showContentSwitchers && (
                        <ContentSwitchers manager={this.manager} />
                    )}
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

                    {/* only one of the following will be rendered */}
                    <MapCountryDropdown
                        manager={this.manager}
                        maxWidth={this.availableWidth}
                    />
                    <CloseGlobeViewButton
                        manager={this.manager}
                        maxWidth={this.availableWidth}
                    />
                </div>
            </nav>
        )
    }
}
