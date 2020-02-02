import * as React from "react"

import { Bounds } from "./Bounds"
import { ControlsOverlay } from "./Controls"

export class LoadingChart extends React.Component<{ bounds: Bounds }> {
    render() {
        // The charts are rendered within an SVG element while the initial chart loading animation
        // that we use for our charts is coded in HTML with CSS animations.
        // In order to keep the animation consistent, we render HTML in an overlay (by using a React
        // portal, ControlsOverlay).
        // -@danielgavrilov, 2020-01-07
        const { bounds } = this.props
        return (
            <ControlsOverlay id="loading-chart">
                <div
                    className="loading-chart"
                    style={{
                        position: "absolute",
                        top: bounds.top,
                        left: bounds.left,
                        width: bounds.width,
                        height: bounds.height
                    }}
                ></div>
            </ControlsOverlay>
        )
    }
}
