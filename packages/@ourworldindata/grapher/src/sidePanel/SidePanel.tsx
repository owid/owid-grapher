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
