import { Component } from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"

import { Bounds, DEFAULT_BOUNDS } from "@ourworldindata/utils"

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
import { GlobeSwitcher, GlobeSwitcherManager } from "../GlobeSwitcher"

export interface ControlsRowManager
    extends ContentSwitchersManager,
        EntitySelectionManager,
        MapRegionDropdownManager,
        MapCountryDropdownManager,
        GlobeSwitcherManager,
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

    @computed private get globeSwitcherWidth(): number {
        return GlobeSwitcher.width(this.manager)
    }

    @computed private get maxWidthSettingsMenu(): number {
        return this.maxWidth - this.contentSwitchersWidth - 16
    }

    @computed private get maxWidthMapRegionDropdown(): number {
        return this.maxWidthSettingsMenu - this.globeSwitcherWidth - 8
    }

    @computed private get showContentSwitchers(): boolean {
        return ContentSwitchers.shouldShow(this.manager)
    }

    @computed private get showControlsRow(): boolean {
        return (
            SettingsMenu.shouldShow(this.manager) ||
            EntitySelectionToggle.shouldShow(this.manager) ||
            MapRegionDropdown.shouldShow(this.manager) ||
            MapCountryDropdown.shouldShow(this.manager) ||
            CloseGlobeViewButton.shouldShow(this.manager) ||
            GlobeSwitcher.shouldShow(this.manager) ||
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
                        maxWidth={this.maxWidthSettingsMenu}
                        top={this.props.settingsMenuTop ?? 0}
                        bottom={this.framePaddingVertical}
                        right={
                            this.sidePanelWidth + this.framePaddingHorizontal
                        }
                    />

                    {/* rendered if the entity selector is shown on the map tab */}
                    <GlobeSwitcher manager={this.manager} />
                    <MapRegionDropdown
                        manager={this.manager}
                        maxWidth={this.maxWidthMapRegionDropdown}
                    />

                    {/* rendered on mobile; only one of the following is shown at any given time */}
                    <MapCountryDropdown
                        manager={this.manager}
                        maxWidth={this.maxWidthSettingsMenu}
                    />
                    <CloseGlobeViewButton
                        manager={this.manager}
                        maxWidth={this.maxWidthSettingsMenu}
                    />
                </div>
            </nav>
        )
    }
}
