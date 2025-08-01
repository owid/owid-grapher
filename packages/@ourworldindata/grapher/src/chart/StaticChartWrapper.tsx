import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "@ourworldindata/utils"
import { DEFAULT_GRAPHER_BOUNDS } from "../core/GrapherConstants.js"
import { CaptionedChartManager } from "../captionedChart/CaptionedChart.js"
import { GRAPHER_BACKGROUND_DEFAULT } from "../color/ColorConstants.js"
import { getChartSvgProps, NoDataPattern } from "./ChartUtils.js"

interface StaticChartWrapperProps {
    manager: CaptionedChartManager
    bounds?: Bounds
    children: React.ReactNode
}

@observer
export class StaticChartWrapper extends React.Component<StaticChartWrapperProps> {
    constructor(props: StaticChartWrapperProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get manager(): CaptionedChartManager {
        return this.props.manager
    }

    @computed protected get bounds(): Bounds {
        return (
            this.props.bounds ??
            this.manager.staticBounds ??
            DEFAULT_GRAPHER_BOUNDS
        )
    }

    @computed private get fonts(): React.ReactElement {
        let origin = ""
        try {
            if (this.manager.bakedGrapherURL)
                origin = new URL(this.manager.bakedGrapherURL).origin
        } catch {
            // ignore
        }
        const css = `@import url(${origin}/fonts.css)`
        return (
            <defs>
                <style>{css}</style>
            </defs>
        )
    }

    @computed private get backgroundColor(): string {
        return this.manager.backgroundColor ?? GRAPHER_BACKGROUND_DEFAULT
    }

    @computed private get noDataPattern(): React.ReactElement {
        return (
            <defs>
                <NoDataPattern />
            </defs>
        )
    }

    override render(): React.ReactElement {
        const { manager } = this

        const bounds = this.manager.staticBoundsWithDetails ?? this.bounds
        const width = bounds.width
        const height = bounds.height

        const includeFontsStyle = !manager.isExportingForWikimedia
        const includeBackgroundRect = !!manager.isExportingForWikimedia

        return (
            <svg
                {...getChartSvgProps(this.manager)}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
            >
                {includeFontsStyle && this.fonts}
                {this.noDataPattern}
                {includeBackgroundRect && (
                    <rect
                        className="background-fill"
                        fill={this.backgroundColor}
                        width={width}
                        height={height}
                    />
                )}
                {this.props.children}
            </svg>
        )
    }
}
