import { Grapher } from "grapher/core/Grapher"
import React from "react"
import { computed, action } from "mobx"
import { Header, HeaderHTML } from "grapher/chart/Header"
import { SourcesFooter, SourcesFooterHTML } from "grapher/chart/Footer"
import { Bounds } from "grapher/utils/Bounds"
import { GrapherView } from "grapher/core/GrapherView"
import { observer } from "mobx-react"
import { ControlsRow } from "grapher/controls/ControlsRow"

@observer
class ControlsOverlayView extends React.Component<{
    grapherView: GrapherView
    children: JSX.Element
}> {
    @action.bound onDataSelect() {
        this.props.grapherView.grapher.isSelectingData = true
    }

    render() {
        const { overlayPadding } = this.props.grapherView
        const containerStyle: React.CSSProperties = {
            position: "relative",
            clear: "both",
            paddingTop: `${overlayPadding.top}px`,
            paddingRight: `${overlayPadding.right}px`,
            paddingBottom: `${overlayPadding.bottom}px`,
            paddingLeft: `${overlayPadding.left}px`,
        }
        const overlayStyle: React.CSSProperties = {
            position: "absolute",
            // Overlays should be positioned relative to the same origin
            // as the <svg>
            top: `${overlayPadding.top}px`,
            left: `${overlayPadding.left}px`,
            // Create 0px element to avoid capturing events.
            // Can achieve the same with `pointer-events: none`, but then control
            // has to override `pointer-events` to capture events.
            width: "0px",
            height: "0px",
        }
        return (
            <div style={containerStyle}>
                {this.props.children}
                <div className="ControlsOverlay" style={overlayStyle}>
                    {Object.entries(this.props.grapherView.overlays).map(
                        ([key, overlay]) => (
                            <React.Fragment key={key}>
                                {overlay.props.children}
                            </React.Fragment>
                        )
                    )}
                </div>
            </div>
        )
    }
}

interface ChartLayoutProps {
    grapher: Grapher
    grapherView: GrapherView
    bounds: Bounds
}

export class ChartLayout {
    props: ChartLayoutProps
    constructor(props: ChartLayoutProps) {
        this.props = props
    }

    @computed get paddedBounds() {
        return this.props.bounds.pad(15)
    }

    @computed get header() {
        const that = this
        return new Header({
            get grapher() {
                return that.props.grapher
            },
            get maxWidth() {
                return that.paddedBounds.width
            },
        })
    }

    @computed get footer() {
        const that = this
        return new SourcesFooter({
            get grapher() {
                return that.props.grapher
            },
            get maxWidth() {
                return that.paddedBounds.width
            },
        })
    }

    @computed get isExporting(): boolean {
        return !!this.props.grapher.isExporting
    }

    @computed get svgWidth() {
        if (this.isExporting) return this.props.bounds.width

        const { overlayPadding } = this.props.grapherView
        return (
            this.props.bounds.width - overlayPadding.left - overlayPadding.right
        )
    }

    // TEMP: will be removed when ControlsRow is rendered by individual charts
    @computed private get hasControlsRow() {
        const { grapher } = this.props
        return (
            grapher.primaryTab === "chart" &&
            ((grapher.canAddData && !grapher.hasFloatingAddButton) ||
                grapher.isScatter ||
                grapher.canChangeEntity ||
                (grapher.isStackedArea && grapher.canToggleRelativeMode) ||
                (grapher.isLineChart &&
                    grapher.lineChartTransform.canToggleRelativeMode))
        )
    }

    @computed get svgHeight() {
        if (this.isExporting) return this.props.bounds.height

        const { overlayPadding } = this.props.grapherView
        return (
            this.props.bounds.height -
            this.header.height -
            (this.hasControlsRow ? ControlsRow.height : 0) -
            this.footer.height -
            overlayPadding.top -
            overlayPadding.bottom -
            25
        )
    }

    @computed get innerBounds() {
        if (this.isExporting)
            return this.paddedBounds
                .padTop(this.header.height)
                .padBottom(this.footer.height)

        return new Bounds(0, 0, this.svgWidth, this.svgHeight).padWidth(15)
    }
}

export class ChartLayoutView extends React.Component<{
    layout: ChartLayout
    children: any
}> {
    @computed get svgStyle() {
        return {
            fontFamily: "Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: this.props.layout.props.grapher.baseFontSize,
            backgroundColor: "white",
            textRendering: "optimizeLegibility",
            WebkitFontSmoothing: "antialiased",
        }
    }

    renderWithSVGText() {
        const { layout } = this.props
        const { paddedBounds } = layout

        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                version="1.1"
                style={this.svgStyle as any}
                width={layout.svgWidth}
                height={layout.svgHeight}
                viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
            >
                {layout.header.render(paddedBounds.x, paddedBounds.y)}
                {this.props.children}
                {layout.footer.render(
                    paddedBounds.x,
                    paddedBounds.bottom - layout.footer.height
                )}
            </svg>
        )
    }

    renderWithHTMLText() {
        const { layout } = this.props
        const { grapher, grapherView } = layout.props

        return (
            <React.Fragment>
                <HeaderHTML grapher={grapher} header={layout.header} />
                <ControlsRow grapher={grapher} />
                <ControlsOverlayView grapherView={grapherView}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        version="1.1"
                        style={this.svgStyle as any}
                        width={layout.svgWidth}
                        height={layout.svgHeight}
                        viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
                    >
                        {this.props.children}
                    </svg>
                </ControlsOverlayView>
                <SourcesFooterHTML
                    grapher={layout.props.grapher}
                    footer={layout.footer}
                />
            </React.Fragment>
        )
    }

    render() {
        return this.props.layout.isExporting
            ? this.renderWithSVGText()
            : this.renderWithHTMLText()
    }
}
