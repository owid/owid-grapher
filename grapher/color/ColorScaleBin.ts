import { Color } from "../../coreTable/CoreTableConstants"

interface BinProps {
    color: Color
    label?: string
}

interface NumericBinProps extends BinProps {
    isFirst: boolean
    isOpenLeft: boolean
    isOpenRight: boolean
    min: number
    max: number
    displayMin: string
    displayMax: string
}

interface CategoricalBinProps extends BinProps {
    index: number
    value: string
    label: string
    isHidden?: boolean
}

abstract class AbstractColorScaleBin<T extends BinProps> {
    props: T
    constructor(props: T) {
        this.props = props
    }
    get color(): string {
        return this.props.color
    }
    get label(): string | undefined {
        return this.props.label
    }
}

export class NumericBin extends AbstractColorScaleBin<NumericBinProps> {
    get min(): number {
        return this.props.min
    }
    get max(): number {
        return this.props.max
    }
    get minText(): string {
        return (this.props.isOpenLeft ? `<` : "") + this.props.displayMin
    }
    get maxText(): string {
        return (this.props.isOpenRight ? `>` : "") + this.props.displayMax
    }
    get text(): string {
        return this.props.label || ""
    }
    get isHidden(): boolean {
        return false
    }

    contains(value: string | number | undefined): boolean {
        if (value === undefined) return false

        // In looking at this code, it is important to realise that `isOpenLeft`, `isOpenRight`,
        // and `isFirst` are _not_ mutually exclusive.
        // For example, if both `isOpenRight` and `isFirst` are set, then we effectively want `value >= min`.

        // If the bin is left-open, we just need to check the right side
        if (this.props.isOpenLeft && value <= this.max) return true

        // If the bin is right-open, we just need to check the left side
        if (this.props.isOpenRight && value > this.min) return true

        // If this is the first bin of the chart, we want to include the `min` value and thus use greater-equals
        if (this.props.isFirst) {
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

export class CategoricalBin extends AbstractColorScaleBin<CategoricalBinProps> {
    get index(): number {
        return this.props.index
    }
    get value(): string {
        return this.props.value
    }
    get isHidden(): boolean | undefined {
        return this.props.isHidden
    }

    get text(): string {
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

export type ColorScaleBin = CategoricalBin | NumericBin
