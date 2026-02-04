import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { Bounds, RequiredBy } from "@ourworldindata/utils"
import { canAppendTextToLastLine, TextWrap } from "@ourworldindata/components"
import {
    ParsedLabel,
    parseLabelWithSuffix,
    RegionWithProviderSuffixParsedLabel,
} from "../core/RegionGroups.js"
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
    showProviderIcon?: boolean
}

interface RelativePosition {
    dx: number
    dy: number
}

interface BaseLayout {
    position: RelativePosition
    dimensions: { width: number; height: number }
}

interface IconLayout extends BaseLayout {
    type: "icon"
}

interface SpaceLayout extends BaseLayout {
    type: "space"
}

export interface TextLayout extends BaseLayout {
    type: "text"
    textWrap: TextWrap
    onNewLine?: boolean
}

export interface SuffixLayoutWithIcon extends BaseLayout {
    type: "suffix-with-icon"
    onNewLine: boolean
    parts: [TextLayout, SpaceLayout, IconLayout, TextLayout]
    providerKey: RegionWithProviderSuffixParsedLabel["providerKey"]
}

type SuffixLayout = TextLayout | SuffixLayoutWithIcon

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
        showProviderIcon: false,
    } as const satisfies Partial<SeriesLabelStateOptions>

    constructor(options: SeriesLabelStateOptions) {
        this.initialOptions = options
        makeObservable(this)
    }

    static fromTextWrap(
        textWrap: TextWrap,
        options?: { showProviderIcon?: boolean }
    ): SeriesLabelState {
        return new SeriesLabelState({
            text: textWrap.text,
            maxWidth: textWrap.maxWidth,
            fontSize: textWrap.fontSize,
            fontWeight: textWrap?.fontWeight,
            lineHeight: textWrap?.lineHeight,
            showProviderIcon: options?.showProviderIcon,
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

    @computed private get iconSize(): number {
        return Math.round(this.options.fontSize * 0.9)
    }

    @computed get suffixLayout(): SuffixLayout | undefined {
        if (!this.isRegionWithProviderSuffix) return undefined

        const text = `(${this.parsedText.suffix})`
        const fontSettings = { ...this.fontSettings, fontWeight: 400 }

        const hasIcon =
            this.options.showProviderIcon &&
            this.parsedText.type === "regionWithProviderSuffix"

        // When there's an icon, we need extra space for it
        const spaceWidth = Bounds.forText(" ", this.fontSettings).width
        const iconWidth = hasIcon ? this.iconSize + spaceWidth : 0

        const fitsOnSameLineAsName = canAppendTextToLastLine({
            existingTextWrap: this.nameWrap,
            textToAppend: text,
            reservedWidth: iconWidth,
        })

        const position = calculateRelativeAppendPosition({
            existingTextWrap: this.nameWrap,
            fitsOnLastLine: fitsOnSameLineAsName,
        })

        if (hasIcon) {
            const maxWidth = Infinity
            const textWrapBeforeIcon = new TextWrap({
                text: `(${this.parsedText.suffix}`,
                maxWidth,
                ...fontSettings,
            })
            const textWrapAfterIcon = new TextWrap({
                text: `)`,
                maxWidth,
                ...fontSettings,
            })

            const { dx, dy } = position
            const dxBeforeIcon = dx
            const dxSpace = dxBeforeIcon + textWrapBeforeIcon.width
            const dxIcon = dxSpace + spaceWidth
            const dxAfterIcon = dxIcon + this.iconSize

            const height = textWrapBeforeIcon.height

            const parts: [TextLayout, SpaceLayout, IconLayout, TextLayout] = [
                {
                    type: "text",
                    position: { dx: dxBeforeIcon, dy },
                    textWrap: textWrapBeforeIcon,
                    dimensions: textWrapBeforeIcon.dimensions,
                },
                {
                    type: "space",
                    position: { dx: dxIcon, dy },
                    dimensions: { width: spaceWidth, height },
                },
                {
                    type: "icon",
                    position: { dx: dxIcon, dy: dy + 1 }, // Small visual correction
                    dimensions: { width: this.iconSize, height: this.iconSize },
                },
                {
                    type: "text",
                    position: { dx: dxAfterIcon, dy },
                    textWrap: textWrapAfterIcon,
                    dimensions: textWrapAfterIcon.dimensions,
                },
            ]

            const width = _.sumBy(parts, (part) => part.dimensions.width)

            return {
                type: "suffix-with-icon",
                onNewLine: !fitsOnSameLineAsName,
                position,
                dimensions: { width, height },
                parts,
                providerKey: this.parsedText.providerKey,
            }
        } else {
            const maxWidth = fitsOnSameLineAsName
                ? Infinity
                : this.options.maxWidth
            const textWrap = new TextWrap({
                text,
                maxWidth,
                ...fontSettings,
            })

            return {
                type: "text",
                onNewLine: !fitsOnSameLineAsName,
                position,
                textWrap,
                dimensions: textWrap.dimensions,
            }
        }
    }

    @computed get valueLayout(): TextLayout | undefined {
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
                ? this.nameWrap.height + this.suffixLayout.dimensions.height
                : this.nameWrap.height

            return {
                type: "text",
                onNewLine: true,
                position: { dx: 0, dy },
                textWrap: fullWidthTextWrap,
                dimensions: fullWidthTextWrap.dimensions,
            }
        }

        // Always place on new line if requested
        if (this.options.placeFormattedValueInNewLine) {
            return {
                type: "text",
                onNewLine: true,
                position: calculateRelativeAppendPosition({
                    existingTextWrap: this.nameWrap,
                    fitsOnLastLine: false,
                }),
                textWrap: fullWidthTextWrap,
                dimensions: fullWidthTextWrap.dimensions,
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

        return {
            type: "text",
            onNewLine: !fitsOnSameLineAsName,
            position,
            textWrap,
            dimensions: textWrap.dimensions,
        }
    }

    private getFragmentWidth(
        layout?: TextLayout | SuffixLayoutWithIcon
    ): number {
        if (!layout) return 0

        let width = layout.dimensions.width

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
            height += this.suffixLayout.dimensions.height
        }

        if (this.valueLayout?.onNewLine) {
            height += this.valueLayout.dimensions.height
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
