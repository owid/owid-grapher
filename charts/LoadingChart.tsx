import * as React from "react"
import { Bounds } from "./Bounds"
import { ControlsOverlay } from "./Controls"
import { LoadingIndicator } from "site/client/LoadingIndicator"

export class LoadingChart extends React.Component<{ bounds: Bounds }> {
    render() {
        // The charts are rendered within an SVG element while the initial chart loading animation
        // that we use for our charts is coded in HTML with CSS animations.
        // In order to keep the animation consistent, we render HTML in an overlay (by using a React
        // portal, ControlsOverlay).
        // -@danielgavrilov, 2020-01-07
        return (
            <ControlsOverlay id="loading-chart">
                <LoadingIndicator bounds={this.props.bounds} color="#333" />
            </ControlsOverlay>
        )
    }
}
