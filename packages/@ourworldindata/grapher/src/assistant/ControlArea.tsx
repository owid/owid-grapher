import * as React from "react"
import { observer } from "mobx-react"
import {
    ContentSwitchers,
    ContentSwitchersManager,
} from "../controls/ContentSwitchers"
import { SettingsMenu, SettingsMenuManager } from "../controls/SettingsMenu"
import {
    MapRegionDropdown,
    MapRegionDropdownManager,
} from "../controls/MapRegionDropdown"
import {
    MapResetButton,
    MapResetButtonManager,
} from "../controls/MapResetButton"
import {
    MapZoomToSelectionButton,
    MapZoomToSelectionButtonManager,
} from "../controls/MapZoomToSelectionButton"

/**
 * Prototype: the "manual" control area of the sidebar when the AI assistant
 * is enabled. It takes over the functions of the controls row that normally
 * sits inside the chart frame between the plot and the subtitle: the
 * tab/plot-type switcher and the contextual map controls (e.g. "Zoom to
 * selection"). The in-chart controls row is hidden in that case so the plot
 * gets the reclaimed vertical space.
 */
export interface ManualControlAreaManager
    extends
        ContentSwitchersManager,
        SettingsMenuManager,
        MapRegionDropdownManager,
        MapResetButtonManager,
        MapZoomToSelectionButtonManager {
    isOnMapTab?: boolean
    isOnChartTab?: boolean
}

export const ManualControlArea = observer(function ManualControlArea({
    manager,
}: {
    manager: ManualControlAreaManager
}): React.ReactElement | null {
    const showViewSwitcher = ContentSwitchers.shouldShow(manager)

    const showContextualControls = manager.isOnMapTab
        ? MapResetButton.shouldShow(manager, "resetZoom") ||
          MapResetButton.shouldShow(manager, "resetView") ||
          MapZoomToSelectionButton.shouldShow(manager) ||
          MapRegionDropdown.shouldShow(manager)
        : SettingsMenu.shouldShow(manager)

    if (!showViewSwitcher && !showContextualControls) return null

    return (
        <div className="manual-control-area">
            {showViewSwitcher && (
                <div className="manual-control-area__view-switcher">
                    <ContentSwitchers manager={manager} />
                </div>
            )}
            {showContextualControls && (
                <div className="manual-control-area__contextual-controls">
                    {manager.isOnMapTab ? (
                        <>
                            <MapResetButton
                                manager={manager}
                                action="resetZoom"
                            />
                            <MapZoomToSelectionButton manager={manager} />
                            <MapResetButton
                                manager={manager}
                                action="resetView"
                            />
                            <MapRegionDropdown manager={manager} />
                        </>
                    ) : (
                        <SettingsMenu manager={manager} popoverMaxWidth={300} />
                    )}
                </div>
            )}
        </div>
    )
})
