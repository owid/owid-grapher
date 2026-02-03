import { computed, makeObservable } from "mobx"
import { Bounds, RequiredBy } from "@ourworldindata/utils"
import { canAppendTextToLastLine, TextWrap } from "@ourworldindata/components"
import { ParsedLabel, parseLabelWithSuffix } from "../core/RegionGroups.js"
import { FontSettings } from "../core/GrapherConstants.js"
import { match } from "ts-pattern"

const INFO_ICON_SIZE_FACTOR = 0.9 // Relative to font size

export interface SeriesLabelStateOptions {
    text: string
    maxWidth: number
    fontSize: number
    fontWeight?: number
    lineHeight?: number
    formattedValue?: string
    placeFormattedValueInNewLine?: boolean
    showProviderIcon?: boolean
}

interface RelativePosition {
    dx: number
    dy: number
}

export interface FragmentLayout {
    onNewLine: boolean
    position: RelativePosition
    textWrap: TextWrap
}

/**
 * Manages the layout for a series label in charts.
 *
<<<<<<< HEAD
 * A series label can consist of up to three parts:
 * 1. **Name**: The main label text (e.g. "United States")
 * 2. **Suffix**: An optional parenthetical suffix parsed from the name
 *                (e.g. "(historical)" or "(WHO)")
 * 3. **Value**: An optional formatted value to display alongside the name
 *                (e.g. "45.2%")
||||||| parent of a5426d0900 (🎉 add provider info icons to EntityLabel)
 * For entity names with trailing parenthetical suffixes like "Something (whatever)":
 * - Tracks suffix separately for muted styling
 * - Uses avoid-wrap behavior to keep the suffix with the entity name
 *
 * When a formatted value is provided (e.g., for slope charts):
 * - Computes layout for: "Entity (suffix) 1,234"
 * - Value wraps to new line if it doesn't fit
 * - placeFormattedValueInNewLine forces value to always be on new line
=======
 * For entity names with trailing parenthetical suffixes like "Something (whatever)":
 * - Tracks suffix separately for muted styling
 * - Uses avoid-wrap behavior to keep the suffix with the entity name
 * - For recognized provider suffixes, includes space for info icon
 *
 * When a formatted value is provided (e.g., for slope charts):
 * - Computes layout for: "Entity (suffix) 1,234"
 * - Value wraps to new line if it doesn't fit
 * - placeFormattedValueInNewLine forces value to always be on new line
>>>>>>> a5426d0900 (🎉 add provider info icons to EntityLabel)
 */
export class SeriesLabelState {
<<<<<<< HEAD
    private initialOptions: SeriesLabelStateOptions
||||||| parent of a5426d0900 (🎉 add provider info icons to EntityLabel)
    readonly text: string
    readonly maxWidth: number
    readonly fontSize: number
    readonly fontWeight: number
    readonly formattedValue?: string
    readonly placeFormattedValueInNewLine?: boolean
=======
    readonly text: string
    readonly maxWidth: number
    readonly fontSize: number
    readonly fontWeight: number
    readonly formattedValue?: string
    readonly placeFormattedValueInNewLine?: boolean
    readonly showProviderIcon?: boolean
>>>>>>> a5426d0900 (🎉 add provider info icons to EntityLabel)

    private defaultOptions = {
        fontWeight: 400,
        lineHeight: 1.1,
        placeFormattedValueInNewLine: false,
    } as const satisfies Partial<SeriesLabelStateOptions>

    constructor(options: SeriesLabelStateOptions) {
<<<<<<< HEAD
        this.initialOptions = options
        makeObservable(this)
||||||| parent of a5426d0900 (🎉 add provider info icons to EntityLabel)
        this.text = options.text
        this.maxWidth = options.maxWidth
        this.fontSize = options.fontSize
        this.fontWeight = options.fontWeight ?? 400
        this.formattedValue = options.formattedValue
        this.placeFormattedValueInNewLine = options.placeFormattedValueInNewLine

        this.parsedText = parseLabelWithSuffix(this.text)
        this.mainTextWrap = this.computeMainTextWrap()
=======
        this.text = options.text
        this.maxWidth = options.maxWidth
        this.fontSize = options.fontSize
        this.fontWeight = options.fontWeight ?? 400
        this.formattedValue = options.formattedValue
        this.placeFormattedValueInNewLine = options.placeFormattedValueInNewLine
        this.showProviderIcon = options.showProviderIcon

        this.parsedText = parseLabelWithSuffix(this.text)
        this.mainTextWrap = this.computeMainTextWrap()
>>>>>>> a5426d0900 (🎉 add provider info icons to EntityLabel)
    }

<<<<<<< HEAD
    static fromTextWrap(textWrap: TextWrap): SeriesLabelState {
||||||| parent of a5426d0900 (🎉 add provider info icons to EntityLabel)
    get lineHeight(): number {
        return 1.1
    }

    get singleLineHeight(): number {
        return this.fontSize * this.lineHeight
    }

    get shouldShowSuffix(): boolean {
        return !!this.parsedText?.suffix
    }

    /** The main entity name (without suffix if showing separately) */
    get mainName(): string {
        return this.shouldShowSuffix ? this.parsedText!.name : this.text
    }

    private get fontSettings(): {
        fontSize: number
        fontWeight?: number
        fontFamily?: FontFamily
    } {
        return {
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
        }
    }

    private get valueFontSettings(): {
        fontSize: number
        fontWeight?: number
        fontFamily?: FontFamily
    } {
        return {
            fontSize: this.fontSize,
            fontWeight: 400,
        }
    }

    /** Font settings for the suffix (always normal weight) */
    get suffixFontSettings(): {
        fontSize: number
        fontWeight: number
        fontFamily?: FontFamily
    } {
        return {
            fontSize: this.fontSize,
            fontWeight: 400,
        }
    }

    /** Width of space character */
    private get spaceWidth(): number {
        return Bounds.forText(" ", this.fontSettings).width
    }

    /** Calculate the width of the suffix "(whatever)" */
    private get suffixWidth(): number {
        if (!this.parsedText?.suffix) return 0
        return Bounds.forText(
            `(${this.parsedText.suffix})`,
            this.suffixFontSettings
        ).width
    }

    /** Calculate the width of the formatted value */
    private get valueWidth(): number {
        if (!this.formattedValue) return 0
        return Bounds.forText(this.formattedValue, this.valueFontSettings).width
    }

    /** Width of just the main name */
    private get mainNameWidth(): number {
        return Bounds.forText(this.mainName, this.fontSettings).width
    }

    /** Width needed for suffix (with leading space) if showing */
    private get suffixWithSpaceWidth(): number {
        return this.shouldShowSuffix ? this.spaceWidth + this.suffixWidth : 0
    }

    /** Width needed for value (with leading space) if present */
    private get valueWithSpaceWidth(): number {
        return this.formattedValue ? this.spaceWidth + this.valueWidth : 0
    }

    /**
     * Determine if the formatted value should be on a new line.
     * This happens if:
     * 1. placeFormattedValueInNewLine is explicitly true, OR
     * 2. There's a suffix (value always on new line with suffix), OR
     * 3. Everything doesn't fit on one line (avoid-wrap behavior)
     */
    get valueOnNewLine(): boolean {
        if (!this.formattedValue) return false
        if (this.placeFormattedValueInNewLine) return true
        // Always put value on new line when there's a suffix
        if (this.shouldShowSuffix) return true

        // Check if everything fits on one line
        const totalWidth =
            this.mainNameWidth +
            this.suffixWithSpaceWidth +
            this.valueWithSpaceWidth
        return totalWidth > this.maxWidth
    }

    /**
     * Determine the maxWidth for the main text TextWrap.
     * Reserve space on the last line for suffix (and value if on same line).
     */
    private get mainTextMaxWidth(): number {
        const { maxWidth } = this

        // If no suffix and no value, use full width
        if (!this.shouldShowSuffix && !this.formattedValue) {
            return maxWidth
        }

        // Calculate what needs to fit on the last line with the main text
        let reservedWidth = this.suffixWithSpaceWidth

        // If value is NOT on a new line, it also needs to fit on the last line
        if (this.formattedValue && !this.valueOnNewLine) {
            reservedWidth += this.valueWithSpaceWidth
        }

        // Check if everything fits on one line
        const fullWidth = this.mainNameWidth + reservedWidth
        if (fullWidth <= maxWidth) {
            return maxWidth
        }

        // Otherwise, reduce maxWidth so reserved content fits on last line
        return Math.max(maxWidth - reservedWidth, maxWidth * 0.5)
    }

    private computeMainTextWrap(): TextWrap {
        return new TextWrap({
            text: this.mainName,
            maxWidth: this.mainTextMaxWidth,
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
            lineHeight: this.lineHeight,
        })
    }

    /** Get the position where the suffix should be rendered (relative to base position) */
    get suffixPosition(): { x: number; y: number } | undefined {
        if (!this.shouldShowSuffix) return undefined

        const lastLineIndex = this.mainTextWrap.lineCount - 1
        return {
            x: this.mainTextWrap.lastLineWidth + this.spaceWidth,
            y: lastLineIndex * this.singleLineHeight,
        }
    }

    /** Get the position where the formatted value should be rendered (relative to base position) */
    get valuePosition(): { x: number; y: number } | undefined {
        if (!this.formattedValue) return undefined

        if (this.valueOnNewLine) {
            // Value on new line, starts at x=0
            const lineIndex = this.mainTextWrap.lineCount
            return {
                x: 0,
                y: lineIndex * this.singleLineHeight,
            }
        }

        // Value on same line as suffix (or main text if no suffix)
        const lastLineIndex = this.mainTextWrap.lineCount - 1
        let x = this.mainTextWrap.lastLineWidth + this.spaceWidth

        if (this.shouldShowSuffix) {
            // After suffix
            x += this.suffixWidth + this.spaceWidth
        }

        return {
            x,
            y: lastLineIndex * this.singleLineHeight,
        }
    }

    get width(): number {
        const mainWidth = this.mainTextWrap.width

        if (!this.shouldShowSuffix && !this.formattedValue) {
            return mainWidth
        }

        // Calculate width of the last line (which has suffix and possibly value)
        let lastLineWidth = this.mainTextWrap.lastLineWidth

        if (this.shouldShowSuffix) {
            lastLineWidth += this.spaceWidth + this.suffixWidth
        }

        if (this.formattedValue && !this.valueOnNewLine) {
            lastLineWidth += this.spaceWidth + this.valueWidth
        }

        // If value is on new line, also consider its width
        const valueLineWidth = this.valueOnNewLine ? this.valueWidth : 0

        return Math.max(mainWidth, lastLineWidth, valueLineWidth)
    }

    get height(): number {
        let height = this.mainTextWrap.height
        if (this.valueOnNewLine && this.formattedValue) {
            height += this.singleLineHeight
        }
        return height
    }

    /**
     * Create a SeriesLabelState from a TextWrap instance.
     * Useful when you've already computed sizing with TextWrap and want
     * SeriesLabelState's suffix styling for rendering.
     */
    static fromTextWrap(
        textWrap: TextWrap,
        options?: { fontWeight?: number; lineHeight?: number }
    ): SeriesLabelState {
=======
    get lineHeight(): number {
        return 1.1
    }

    get singleLineHeight(): number {
        return this.fontSize * this.lineHeight
    }

    get iconSize(): number {
        return Math.round(this.fontSize * INFO_ICON_SIZE_FACTOR)
    }

    get shouldShowSuffix(): boolean {
        return !!this.parsedText?.suffix
    }

    /** Whether to show the info icon (only for recognized providers) */
    get shouldShowIcon(): boolean {
        return !!(
            this.showProviderIcon &&
            this.parsedText?.type === "regionWithProviderSuffix"
        )
    }

    /** The main entity name (without suffix if showing separately) */
    get mainName(): string {
        return this.shouldShowSuffix ? this.parsedText!.name : this.text
    }

    private get fontSettings(): {
        fontSize: number
        fontWeight?: number
        fontFamily?: FontFamily
    } {
        return {
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
        }
    }

    private get valueFontSettings(): {
        fontSize: number
        fontWeight?: number
        fontFamily?: FontFamily
    } {
        return {
            fontSize: this.fontSize,
            fontWeight: 400,
        }
    }

    /** Font settings for the suffix (always normal weight) */
    get suffixFontSettings(): {
        fontSize: number
        fontWeight: number
        fontFamily?: FontFamily
    } {
        return {
            fontSize: this.fontSize,
            fontWeight: 400,
        }
    }

    /** Width of space character */
    private get spaceWidth(): number {
        return Bounds.forText(" ", this.fontSettings).width
    }

    /** Calculate the width of the suffix "(WHO ⓘ)" or "(whatever)" */
    private get suffixWidth(): number {
        if (!this.parsedText?.suffix) return 0

        if (this.shouldShowIcon) {
            // Provider suffix with icon: "(WHO ⓘ)"
            const textWidth = Bounds.forText(
                `(${this.parsedText.suffix} `,
                this.suffixFontSettings
            ).width
            const closingWidth = Bounds.forText(
                ")",
                this.suffixFontSettings
            ).width
            return textWidth + this.iconSize + closingWidth
        } else {
            // Regular suffix without icon: "(whatever)"
            return Bounds.forText(
                `(${this.parsedText.suffix})`,
                this.suffixFontSettings
            ).width
        }
    }

    /** Calculate the width of the formatted value */
    private get valueWidth(): number {
        if (!this.formattedValue) return 0
        return Bounds.forText(this.formattedValue, this.valueFontSettings).width
    }

    /** Width of just the main name */
    private get mainNameWidth(): number {
        return Bounds.forText(this.mainName, this.fontSettings).width
    }

    /** Width needed for suffix (with leading space) if showing */
    private get suffixWithSpaceWidth(): number {
        return this.shouldShowSuffix ? this.spaceWidth + this.suffixWidth : 0
    }

    /** Width needed for value (with leading space) if present */
    private get valueWithSpaceWidth(): number {
        return this.formattedValue ? this.spaceWidth + this.valueWidth : 0
    }

    /**
     * Determine if the formatted value should be on a new line.
     * This happens if:
     * 1. placeFormattedValueInNewLine is explicitly true, OR
     * 2. There's a suffix (value always on new line with suffix), OR
     * 3. Everything doesn't fit on one line (avoid-wrap behavior)
     */
    get valueOnNewLine(): boolean {
        if (!this.formattedValue) return false
        if (this.placeFormattedValueInNewLine) return true
        // Always put value on new line when there's a suffix
        if (this.shouldShowSuffix) return true

        // Check if everything fits on one line
        const totalWidth =
            this.mainNameWidth +
            this.suffixWithSpaceWidth +
            this.valueWithSpaceWidth
        return totalWidth > this.maxWidth
    }

    /**
     * Determine the maxWidth for the main text TextWrap.
     * Reserve space on the last line for suffix (and value if on same line).
     */
    private get mainTextMaxWidth(): number {
        const { maxWidth } = this

        // If no suffix and no value, use full width
        if (!this.shouldShowSuffix && !this.formattedValue) {
            return maxWidth
        }

        // Calculate what needs to fit on the last line with the main text
        let reservedWidth = this.suffixWithSpaceWidth

        // If value is NOT on a new line, it also needs to fit on the last line
        if (this.formattedValue && !this.valueOnNewLine) {
            reservedWidth += this.valueWithSpaceWidth
        }

        // Check if everything fits on one line
        const fullWidth = this.mainNameWidth + reservedWidth
        if (fullWidth <= maxWidth) {
            return maxWidth
        }

        // Otherwise, reduce maxWidth so reserved content fits on last line
        return Math.max(maxWidth - reservedWidth, maxWidth * 0.5)
    }

    private computeMainTextWrap(): TextWrap {
        return new TextWrap({
            text: this.mainName,
            maxWidth: this.mainTextMaxWidth,
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
            lineHeight: this.lineHeight,
        })
    }

    /** Get the position where the suffix should be rendered (relative to base position) */
    get suffixPosition(): { x: number; y: number } | undefined {
        if (!this.shouldShowSuffix) return undefined

        const lastLineIndex = this.mainTextWrap.lineCount - 1
        return {
            x: this.mainTextWrap.lastLineWidth + this.spaceWidth,
            y: lastLineIndex * this.singleLineHeight,
        }
    }

    /** Get the position where the formatted value should be rendered (relative to base position) */
    get valuePosition(): { x: number; y: number } | undefined {
        if (!this.formattedValue) return undefined

        if (this.valueOnNewLine) {
            // Value on new line, starts at x=0
            const lineIndex = this.mainTextWrap.lineCount
            return {
                x: 0,
                y: lineIndex * this.singleLineHeight,
            }
        }

        // Value on same line as suffix (or main text if no suffix)
        const lastLineIndex = this.mainTextWrap.lineCount - 1
        let x = this.mainTextWrap.lastLineWidth + this.spaceWidth

        if (this.shouldShowSuffix) {
            // After suffix
            x += this.suffixWidth + this.spaceWidth
        }

        return {
            x,
            y: lastLineIndex * this.singleLineHeight,
        }
    }

    get width(): number {
        const mainWidth = this.mainTextWrap.width

        if (!this.shouldShowSuffix && !this.formattedValue) {
            return mainWidth
        }

        // Calculate width of the last line (which has suffix and possibly value)
        let lastLineWidth = this.mainTextWrap.lastLineWidth

        if (this.shouldShowSuffix) {
            lastLineWidth += this.spaceWidth + this.suffixWidth
        }

        if (this.formattedValue && !this.valueOnNewLine) {
            lastLineWidth += this.spaceWidth + this.valueWidth
        }

        // If value is on new line, also consider its width
        const valueLineWidth = this.valueOnNewLine ? this.valueWidth : 0

        return Math.max(mainWidth, lastLineWidth, valueLineWidth)
    }

    get height(): number {
        let height = this.mainTextWrap.height
        if (this.valueOnNewLine && this.formattedValue) {
            height += this.singleLineHeight
        }
        return height
    }

    /**
     * Create a SeriesLabelState from a TextWrap instance.
     * Useful when you've already computed sizing with TextWrap and want
     * SeriesLabelState's suffix styling for rendering.
     */
    static fromTextWrap(
        textWrap: TextWrap,
        options?: {
            fontWeight?: number
            lineHeight?: number
            showProviderIcon?: boolean
        }
    ): SeriesLabelState {
>>>>>>> a5426d0900 (🎉 add provider info icons to EntityLabel)
        return new SeriesLabelState({
            text: textWrap.text,
            maxWidth: textWrap.maxWidth,
            fontSize: textWrap.fontSize,
<<<<<<< HEAD
            fontWeight: textWrap?.fontWeight,
            lineHeight: textWrap?.lineHeight,
||||||| parent of a5426d0900 (🎉 add provider info icons to EntityLabel)
            fontWeight: options?.fontWeight,
=======
            fontWeight: options?.fontWeight,
            showProviderIcon: options?.showProviderIcon,
>>>>>>> a5426d0900 (🎉 add provider info icons to EntityLabel)
        })
    }

    @computed private get options(): RequiredBy<
        SeriesLabelStateOptions,
        keyof typeof this.defaultOptions
    > {
        return { ...this.defaultOptions, ...this.initialOptions }
    }

    @computed get text(): string {
        return this.options.text
    }

    @computed private get parsedText(): ParsedLabel {
        return parseLabelWithSuffix(this.text)
    }

    @computed private get name(): string {
        return match(this.parsedText)
            .with({ type: "plain" }, (parsedText) => {
                const { name, suffix } = parsedText
                return suffix ? `${name} (${suffix})` : name
            })
            .with(
                { type: "regionWithProviderSuffix" },
                (parsedText) => parsedText.name
            )
            .exhaustive()
    }

    @computed get nameWrap(): TextWrap {
        return new TextWrap({
            text: this.name,
            maxWidth: this.options.maxWidth,
            ...this.fontSettings,
        })
    }

    @computed get fontSettings(): FontSettings {
        return {
            fontSize: this.options.fontSize,
            lineHeight: this.options.lineHeight,
            fontWeight: this.options.fontWeight,
        }
    }

    @computed get singleLineHeight(): number {
        return this.nameWrap.singleLineHeight
    }

    @computed private get isRegionWithProviderSuffix(): boolean {
        return this.parsedText.type === "regionWithProviderSuffix"
    }

    @computed get suffixLayout(): FragmentLayout | undefined {
        if (!this.isRegionWithProviderSuffix) return undefined

        const text = `(${this.parsedText.suffix})`

        const fitsOnSameLineAsName = canAppendTextToLastLine({
            existingTextWrap: this.nameWrap,
            textToAppend: text,
        })

        const position = calculateRelativeAppendPosition({
            existingTextWrap: this.nameWrap,
            fitsOnLastLine: fitsOnSameLineAsName,
        })

        const maxWidth = fitsOnSameLineAsName ? Infinity : this.options.maxWidth
        const fontSettings = { ...this.fontSettings, fontWeight: 400 }
        const textWrap = new TextWrap({
            text,
            maxWidth,
            ...fontSettings,
        })

        return { onNewLine: !fitsOnSameLineAsName, position, textWrap }
    }

    @computed get valueLayout(): FragmentLayout | undefined {
        const text = this.options.formattedValue

        if (!text) return undefined

        const fontSettings = { ...this.fontSettings, fontWeight: 400 }
        const fullWidthTextWrap = new TextWrap({
            text,
            maxWidth: this.options.maxWidth,
            ...fontSettings,
        })

        // Always place on new line if there is a suffix
        if (this.suffixLayout) {
            const dy = this.suffixLayout.onNewLine
                ? this.nameWrap.height + this.suffixLayout.textWrap.height
                : this.nameWrap.height

            return {
                onNewLine: true,
                position: { dx: 0, dy },
                textWrap: fullWidthTextWrap,
            }
        }

        // Always place on new line if requested
        if (this.options.placeFormattedValueInNewLine) {
            return {
                onNewLine: true,
                position: calculateRelativeAppendPosition({
                    existingTextWrap: this.nameWrap,
                    fitsOnLastLine: false,
                }),
                textWrap: fullWidthTextWrap,
            }
        }

        const fitsOnSameLineAsName = canAppendTextToLastLine({
            existingTextWrap: this.nameWrap,
            textToAppend: text,
        })

        const position = calculateRelativeAppendPosition({
            existingTextWrap: this.nameWrap,
            fitsOnLastLine: fitsOnSameLineAsName,
        })

        const maxWidth = fitsOnSameLineAsName ? Infinity : this.options.maxWidth
        const textWrap = new TextWrap({
            text,
            maxWidth,
            ...fontSettings,
        })

        return { onNewLine: !fitsOnSameLineAsName, position, textWrap }
    }

    private getFragmentWidth(layout: FragmentLayout | undefined): number {
        if (!layout) return 0

        let width = layout.textWrap.width

        // If the fragment doesn't start on a new line, add the name's last line width
        if (!layout.onNewLine) width += this.nameWrap.lastLineWidth

        return width
    }

    @computed get width(): number {
        const widths = [
            this.nameWrap.width,
            this.getFragmentWidth(this.suffixLayout),
            this.getFragmentWidth(this.valueLayout),
        ]
        return Math.max(...widths)
    }

    @computed get height(): number {
        let height = this.nameWrap.height

        if (this.suffixLayout?.onNewLine) {
            height += this.suffixLayout.textWrap.height
        }

        if (this.valueLayout?.onNewLine) {
            height += this.valueLayout.textWrap.height
        }

        return height
    }
}

/**
 * Calculate the position for appending text after an existing TextWrap.
 * Returns position on the same line if it fits, otherwise on a new line.
 */
function calculateRelativeAppendPosition({
    existingTextWrap,
    fitsOnLastLine,
}: {
    existingTextWrap: TextWrap
    fitsOnLastLine: boolean
}): RelativePosition {
    const { fontSize, lineHeight, lastLineWidth } = existingTextWrap

    const spaceWidth = Bounds.forText(" ", { fontSize }).width
    const singleLineHeight = fontSize * lineHeight

    const { lineCount } = existingTextWrap
    if (fitsOnLastLine) {
        const lastLineIndex = lineCount - 1
        return {
            dx: lastLineWidth + spaceWidth,
            dy: lastLineIndex * singleLineHeight,
        }
    } else {
        const newLineIndex = lineCount
        return { dx: 0, dy: newLineIndex * singleLineHeight }
    }
}
