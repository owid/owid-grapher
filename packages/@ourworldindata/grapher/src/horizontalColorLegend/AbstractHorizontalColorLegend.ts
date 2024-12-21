import { computed } from "mobx"
import { HorizontalAlign } from "@ourworldindata/types"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"

export interface HorizontalColorLegendProps {
    fontSize?: number
    legendX?: number
    legendAlign?: HorizontalAlign
    legendMaxWidth?: number
}

export abstract class AbstractHorizontalColorLegend<
    Props extends HorizontalColorLegendProps,
> {
    props: Props
    constructor(props: Props) {
        this.props = props
    }

    @computed get legendX(): number {
        return this.props.legendX ?? 0
    }

    @computed protected get legendAlign(): HorizontalAlign {
        // Assume center alignment if none specified, for backwards-compatibility
        return this.props.legendAlign ?? HorizontalAlign.center
    }

    @computed protected get fontSize(): number {
        return this.props.fontSize ?? BASE_FONT_SIZE
    }

    @computed protected get legendMaxWidth(): number | undefined {
        return this.props.legendMaxWidth
    }

    abstract get height(): number
    abstract get width(): number
}
