import * as React from "react"
import { Bounds } from "grapher/utils/Bounds"
import { ControlsOverlay } from "grapher/controls/ControlsOverlay"
import { LoadingIndicator } from "grapher/loadingIndicator/LoadingIndicator"

export class LoadingOverlay extends React.Component<{ bounds: Bounds }> {
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
