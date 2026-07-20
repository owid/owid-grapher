import { Color, CoreValueType } from "@ourworldindata/types"
import { NO_DATA_LABEL, PROJECTED_DATA_LABEL } from "./ColorScale"

interface BinProps {
    color: Color
    label?: string
    patternRef?: string
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
    // Additional values that this bin matches, on top of `value`. Set only for
    // merged legend bins (see `mergeCategoricalBinsByLabelAndColor`); when
    // omitted the bin matches its single `value`, as before.
    values?: string[]
}

abstract class AbstractColorScaleBin<T extends BinProps> {
    props: T
    constructor(props: T) {
        this.props = props
    }
    get color(): string {
        return this.props.color
    }
    get patternRef(): string | undefined {
        return this.props.patternRef
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
        if (this.props.isOpenLeft) return ""
        return this.props.displayMin
    }
    get maxText(): string {
        if (this.props.isOpenRight) return ""
        return this.props.displayMax
    }
    get text(): string {
        return this.props.label || ""
    }
    get isHidden(): boolean {
        return false
    }

    contains(value: CoreValueType | undefined): boolean {
        if (typeof value !== "number") return false

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

    /** All values this bin matches. A single-value bin matches just `value`;
     * a merged bin also matches the values it absorbed. */
    get values(): string[] {
        return this.props.values ?? [this.props.value]
    }

    contains(
        value: CoreValueType | undefined,
        { isProjection = false } = {}
    ): boolean {
        return (
            (value === undefined && this.props.value === NO_DATA_LABEL) ||
            (value !== undefined &&
                isProjection &&
                this.props.value === PROJECTED_DATA_LABEL) ||
            (value !== undefined && this.values.some((v) => v === value))
        )
    }

    equals(other: ColorScaleBin): boolean {
        return (
            other instanceof CategoricalBin &&
            this.props.index === other.props.index
        )
    }
}

/**
 * Merge categorical bins that share the same displayed label *and* color into a
 * single bin, preserving the order of first appearance. This avoids showing
 * multiple visually indistinguishable swatches in a legend when several
 * categories are given the same custom label and color.
 *
 * The merged bin keeps the first bin's props (index, color, label, pattern) and
 * additionally matches all the values of the bins it absorbs, so hovering it
 * still highlights every entity in any of the merged categories, and hovering
 * such an entity still resolves back to this one bin. Bins that differ in label
 * or color are left untouched (and single-member groups keep their original
 * object, so the default case is unchanged).
 */
export function mergeCategoricalBinsByLabelAndColor(
    bins: CategoricalBin[]
): CategoricalBin[] {
    const binsByKey = new Map<string, CategoricalBin>()
    const orderedKeys: string[] = []
    for (const bin of bins) {
        // Key on the displayed label and color together; JSON.stringify
        // keeps the two fields unambiguously separated.
        const key = JSON.stringify([bin.text, bin.color])
        const existing = binsByKey.get(key)
        if (existing) {
            binsByKey.set(
                key,
                new CategoricalBin({
                    ...existing.props,
                    values: [...existing.values, ...bin.values],
                })
            )
        } else {
            binsByKey.set(key, bin)
            orderedKeys.push(key)
        }
    }
    return orderedKeys.map((key) => binsByKey.get(key)!)
}

export function isCategoricalBin(bin: ColorScaleBin): bin is CategoricalBin {
    return bin instanceof CategoricalBin
}

export function isNumericBin(bin: ColorScaleBin): bin is NumericBin {
    return bin instanceof NumericBin
}

export function isNoDataBin(bin: ColorScaleBin): bin is CategoricalBin {
    return isCategoricalBin(bin) && bin.value === NO_DATA_LABEL
}

export function isProjectedDataBin(bin: ColorScaleBin): bin is CategoricalBin {
    return isCategoricalBin(bin) && bin.value === PROJECTED_DATA_LABEL
}

export type ColorScaleBin = CategoricalBin | NumericBin
