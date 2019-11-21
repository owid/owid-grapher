import { ChartConfig } from "./ChartConfig"
import { computed } from "mobx"
import { ColorSchemes, ColorScheme } from "./ColorSchemes"
import { scaleOrdinal, ScaleOrdinal } from "d3-scale"
import { Color } from "./Color"

interface ColorizerProps {
    chart: ChartConfig
    keys: string[]
    defaultColorScheme?: string
    invert?: boolean
    labelFormat?: (key: string) => string
}

export interface Colorable {
    key: string
    label: string
    color: string
}

export class Colorizer {
    props: ColorizerProps
    constructor(props: ColorizerProps) {
        this.props = props
    }

    @computed get chart(): ChartConfig {
        return this.props.chart
    }
    @computed get colorKeys(): string[] {
        return this.props.keys
    }

    labelFormat(key: string): string {
        return this.props.labelFormat ? this.props.labelFormat(key) : key
    }

    @computed get customColors() {
        return this.chart.props.customColors || {}
    }

    @computed get colorSchemeName(): string {
        return (
            this.chart.props.baseColorScheme ||
            this.props.defaultColorScheme ||
            "continents"
        )
    }

    @computed get colorSet(): string[] {
        const { colorSchemeName, colorKeys } = this
        const colorScheme = ColorSchemes[colorSchemeName] as ColorScheme
        const colors = colorScheme.getColors(colorKeys.length)

        if (this.props.invert) colors.reverse()

        if (this.chart.props.invertColorScheme) colors.reverse()

        return colors
    }

    @computed get colorScale(): ScaleOrdinal<string, Color> {
        return scaleOrdinal(this.colorSet).domain(this.colorKeys)
    }

    get(key: string) {
        return (
            this.customColors[key] ||
            this.chart.data.keyColors[key] ||
            this.colorScale(key)
        )
    }

    @computed get colorables(): Colorable[] {
        return this.colorKeys.map(d => ({
            key: d,
            label: this.labelFormat(d),
            color: this.get(d)
        }))
    }
}
