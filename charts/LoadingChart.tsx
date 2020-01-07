import * as React from "react"
import { Bounds } from "./Bounds"
import { ControlsOverlay } from "./Controls"

// For arcane reasons, the ControlsOverlay only allows passing React components as children, not
// any HTML elements.
class LoadingAnimation extends React.Component<{ bounds: Bounds }> {
    render() {
        const { bounds } = this.props
        return (
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
        )
    }
}

export class LoadingChart extends React.Component<{ bounds: Bounds }> {
    render() {
        // The charts are rendered within an SVG element while the initial chart loading animation
        // that we use for our charts is coded in HTML with CSS animations.
        // In order to keep the animation consistent, we render HTML in an overlay (by using a React
        // portal, ControlsOverlay).
        // -@danielgavrilov, 2020-01-07
        return (
            <ControlsOverlay id="loading-chart">
                <LoadingAnimation bounds={this.props.bounds} />
            </ControlsOverlay>
        )
    }
}
