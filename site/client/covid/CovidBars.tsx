import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { scaleLinear } from "d3"
import { bind } from "decko"

import { max, keyBy } from "charts/Util"

import {
    HIGHLIGHT_COLOR,
    CURRENT_COLOR,
    DEFAULT_FAINT_COLOR,
    DEFAULT_COLOR
} from "./CovidConstants"

export interface CovidBarsProps<T> {
    data: T[]
    x: (d: T) => number
    y: (d: T) => number | undefined
    xDomain: [number, number]
    onHover: (d: T | undefined, index: number | undefined) => void
    currentX?: number
    highlightedX?: number
    renderValue?: (d: T | undefined) => JSX.Element
}

@observer
export class CovidBars<T> extends React.Component<CovidBarsProps<T>> {
    static defaultProps = {
        onHover: () => undefined
    }

    @computed get barHeightScale() {
        const maxY = max(
            this.props.data
                .map(this.props.y)
                .filter(d => d !== undefined) as number[]
        )
        return scaleLinear()
            .domain([0, maxY !== undefined ? maxY : 1])
            .range([0, 1])
    }

    @bind barHeight(d: T | undefined) {
        if (d !== undefined) {
            const value = this.props.y(d)
            if (value !== undefined) {
                const ratio = this.barHeightScale(value)
                return `${ratio * 100}%`
            }
        }
        return "0%"
    }

    @bind barColor(d: number) {
        if (d === this.props.highlightedX) return HIGHLIGHT_COLOR
        if (d === this.props.currentX) return CURRENT_COLOR
        if (this.props.highlightedX !== undefined) return DEFAULT_FAINT_COLOR
        return DEFAULT_COLOR
    }

    @computed get bars(): (T | undefined)[] {
        const indexed = keyBy(this.props.data, this.props.x)
        const [start, end] = this.props.xDomain
        const result = []
        for (let i = start; i <= end; i++) {
            result.push(indexed[i])
        }
        return result
    }

    render() {
        return (
            <div
                className="covid-bars"
                onMouseLeave={() => this.props.onHover(undefined, undefined)}
            >
                {this.bars.map((d, i) => (
                    <div
                        key={i}
                        className="bar-wrapper"
                        onMouseEnter={() => this.props.onHover(d, i)}
                    >
                        {this.props.highlightedX === i &&
                            d !== undefined &&
                            this.props.renderValue && (
                                <div
                                    className="hanging-value"
                                    style={{ color: HIGHLIGHT_COLOR }}
                                >
                                    {this.props.renderValue(d)}
                                </div>
                            )}
                        <div
                            className="bar"
                            style={{
                                height: this.barHeight(d),
                                backgroundColor: this.barColor(i)
                            }}
                        ></div>
                    </div>
                ))}
            </div>
        )
    }
}
