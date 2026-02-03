import { computed, makeObservable } from "mobx"
import { Bounds, RequiredBy } from "@ourworldindata/utils"
import { canAppendTextToLastLine, TextWrap } from "@ourworldindata/components"
import { ParsedLabel, parseLabelWithSuffix } from "../core/RegionGroups.js"
import { FontSettings } from "../core/GrapherConstants.js"
import { match } from "ts-pattern"

export interface SeriesLabelStateOptions {
    text: string
    maxWidth: number
    fontSize: number
    fontWeight?: number
    lineHeight?: number
    formattedValue?: string
    placeFormattedValueInNewLine?: boolean
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
 * A series label can consist of up to three parts:
 * 1. **Name**: The main label text (e.g. "United States")
 * 2. **Suffix**: An optional parenthetical suffix parsed from the name
 *                (e.g. "(historical)" or "(WHO)")
 * 3. **Value**: An optional formatted value to display alongside the name
 *                (e.g. "45.2%")
 */
export class SeriesLabelState {
    private initialOptions: SeriesLabelStateOptions

    private defaultOptions = {
        fontWeight: 400,
        lineHeight: 1.1,
        placeFormattedValueInNewLine: false,
    } as const satisfies Partial<SeriesLabelStateOptions>

    constructor(options: SeriesLabelStateOptions) {
        this.initialOptions = options
        makeObservable(this)
    }

    static fromTextWrap(textWrap: TextWrap): SeriesLabelState {
        return new SeriesLabelState({
            text: textWrap.text,
            maxWidth: textWrap.maxWidth,
            fontSize: textWrap.fontSize,
            fontWeight: textWrap?.fontWeight,
            lineHeight: textWrap?.lineHeight,
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
