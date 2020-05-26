import { computed } from "mobx"

import { Color } from "./Color"

export interface NumericBinProps {
    isFirst: boolean
    isOpenLeft: boolean
    isOpenRight: boolean
    min: number
    max: number
    label?: string
    color: string
    format: (v: number) => string
}

export class NumericBin {
    props: NumericBinProps
    constructor(props: NumericBinProps) {
        this.props = props
    }

    @computed get min() {
        return this.props.min
    }
    @computed get max() {
        return this.props.max
    }
    @computed get color() {
        return this.props.color
    }
    @computed get minText() {
        const str = this.props.format(this.props.min)
        if (this.props.isOpenLeft) return `<${str}`
        else return str
    }
    @computed get maxText() {
        const str = this.props.format(this.props.max)
        if (this.props.isOpenRight) return `>${str}`
        else return str
    }
    @computed get label() {
        return this.props.label
    }
    @computed get text() {
        return this.props.label || ""
    }
    @computed get isHidden() {
        return false
    }

    contains(value: string | number | undefined): boolean {
        if (value === undefined) {
            return false
        } else if (this.props.isOpenLeft) {
            return value <= this.max
        } else if (this.props.isOpenRight) {
            return value > this.min
        } else if (this.props.isFirst) {
            return value >= this.min && value <= this.max
        } else {
            return value > this.min && value <= this.max
        }
    }

    equals(other: ColorLegendBin): boolean {
        return (
            other instanceof NumericBin &&
            this.min === other.min &&
            this.max === other.max
        )
    }
}

export interface CategoricalBinProps {
    index: number
    value: string
    color: Color
    label: string
    isHidden: boolean
}

export class CategoricalBin {
    index: number
    value: string
    color: Color
    label: string
    isHidden: boolean

    constructor({ index, value, color, label, isHidden }: CategoricalBinProps) {
        this.index = index
        this.value = value
        this.color = color
        this.label = label
        this.isHidden = isHidden
    }

    get text() {
        return this.label || this.value
    }

    contains(value: string | number | undefined): boolean {
        return (
            (value === undefined && this.value === "No data") ||
            (value !== undefined && value === this.value)
        )
    }

    equals(other: ColorLegendBin): boolean {
        return other instanceof CategoricalBin && this.index === other.index
    }
}

export type ColorLegendBin = NumericBin | CategoricalBin
