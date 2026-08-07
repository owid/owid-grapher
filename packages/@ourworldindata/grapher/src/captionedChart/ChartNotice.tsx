import * as React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    TextWrap,
    TextWrapHtml,
    TextWrapSvg,
} from "@ourworldindata/components"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FRAME_PADDING_HORIZONTAL,
} from "../core/GrapherConstants"
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants"

const LINE_HEIGHT = 1.2

export interface ChartNoticeManager {
    /** The notice for the time currently shown, if any */
    toleranceNotice?: string
    fontSize?: number
    useBaseFontSize?: boolean
    isMedium?: boolean
    isStaticAndSmall?: boolean
}

interface ChartNoticeProps {
    manager: ChartNoticeManager
    maxWidth?: number
}

/**
 * A caveat about the data on screen, shown above the chart it describes. It
 * comes and goes with the time shown, which resizes the chart area a little as
 * the timeline moves.
 */
abstract class AbstractChartNotice<
    Props extends ChartNoticeProps = ChartNoticeProps,
> extends React.Component<Props> {
    constructor(props: Props) {
        super(props)
        makeObservable(this)
    }

    @computed protected get manager(): ChartNoticeManager {
        return this.props.manager
    }

    @computed protected get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_GRAPHER_BOUNDS.width
    }

    @computed protected get useBaseFontSize(): boolean {
        return !!this.manager.useBaseFontSize
    }

    @computed protected get baseFontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    /** Matches the footer's note, which this sentence is a sibling of */
    @computed protected get fontSize(): number {
        if (this.useBaseFontSize) {
            return (11 / BASE_FONT_SIZE) * this.baseFontSize
        }
        return this.manager.isMedium ? 11 : 12
    }

    @computed get text(): string {
        return this.manager.toleranceNotice ?? ""
    }

    @computed protected get textWrap(): TextWrap {
        return new TextWrap({
            text: this.text,
            maxWidth: this.maxWidth,
            fontSize: this.fontSize,
            lineHeight: LINE_HEIGHT,
        })
    }

    @computed get height(): number {
        return this.text ? this.textWrap.height : 0
    }
}

@observer
export class ChartNotice extends AbstractChartNotice {
    override render(): React.ReactElement | null {
        if (!this.text) return null
        // Laid out by the same TextWrap that measured it, so the two agree on
        // line count
        const style: React.CSSProperties = {
            height: this.height,
            fontSize: this.fontSize,
            lineHeight: LINE_HEIGHT,
            padding: `0 ${GRAPHER_FRAME_PADDING_HORIZONTAL}px`,
        }
        return (
            <div className="ChartNotice" style={style}>
                <TextWrapHtml textWrap={this.textWrap} />
            </div>
        )
    }
}

interface StaticChartNoticeProps extends ChartNoticeProps {
    targetX: number
    targetY: number
}

@observer
export class StaticChartNotice extends AbstractChartNotice<StaticChartNoticeProps> {
    /** Matches the static footer's note */
    protected override get fontSize(): number {
        if (this.manager.isStaticAndSmall) return 14
        return this.useBaseFontSize
            ? Math.round((13 / BASE_FONT_SIZE) * this.baseFontSize)
            : 13
    }

    override render(): React.ReactElement | null {
        if (!this.text) return null
        const { targetX, targetY } = this.props
        // Left-aligned and upright, unlike the interactive notice: here it
        // sits with the footer's small print rather than above the chart
        return (
            <TextWrapSvg
                textWrap={this.textWrap}
                x={targetX}
                y={targetY}
                fill={GRAPHER_LIGHT_TEXT}
            />
        )
    }
}
