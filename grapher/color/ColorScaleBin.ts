import { Color } from "grapher/core/GrapherConstants"

interface NumericBinProps {
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
    props: Readonly<NumericBinProps>
    constructor(props: NumericBinProps) {
        this.props = props
    }

    get min() {
        return this.props.min
    }
    get max() {
        return this.props.max
    }
    get color() {
        return this.props.color
    }
    get minText() {
        const str = this.props.format(this.props.min)
        if (this.props.isOpenLeft) return `<${str}`
        else return str
    }
    get maxText() {
        const str = this.props.format(this.props.max)
        if (this.props.isOpenRight) return `>${str}`
        else return str
    }
    get label() {
        return this.props.label
    }
    get text() {
        return this.props.label || ""
    }
    get isHidden() {
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

    equals(other: ColorScaleBin): boolean {
        return (
            other instanceof NumericBin &&
            this.min === other.min &&
            this.max === other.max
        )
    }
}

interface CategoricalBinProps {
    index: number
    value: string
    color: Color
    label: string
    isHidden: boolean
}

export class CategoricalBin {
    private props: Readonly<CategoricalBinProps>
    constructor(props: CategoricalBinProps) {
        this.props = props
    }

    get index() {
        return this.props.index
    }
    get value() {
        return this.props.value
    }
    get color() {
        return this.props.color
    }
    get label() {
        return this.props.label
    }
    get isHidden() {
        return this.props.isHidden
    }

    get text() {
        return this.props.label || this.props.value
    }

    contains(value: string | number | undefined): boolean {
        return (
            (value === undefined && this.props.value === "No data") ||
            (value !== undefined && value === this.props.value)
        )
    }

    equals(other: ColorScaleBin): boolean {
        return (
            other instanceof CategoricalBin &&
            this.props.index === other.props.index
        )
    }
}

export type ColorScaleBin = NumericBin | CategoricalBin
