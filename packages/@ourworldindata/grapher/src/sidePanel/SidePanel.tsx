import * as React from "react"
import { Bounds } from "@ourworldindata/utils"
import { GRAPHER_SIDE_PANEL_CLASS } from "../core/GrapherConstants.js"

export const SidePanel = ({
    bounds,
    children,
}: {
    bounds: Bounds
    children: React.ReactNode
}) => {
    return (
        // NOTE: site/IndicatorMetadataBox.scss narrows the indicator metadata
        // box's grid when this side panel is present, via
        // `.chart-key-info:has(.side-panel) ~ .indicator-metadata-box`. Removing
        // or renaming this class will silently break that layout.
        <div
            className={GRAPHER_SIDE_PANEL_CLASS}
            style={{
                width: bounds.width,
                height: bounds.height,
            }}
        >
            {children}
        </div>
    )
}
