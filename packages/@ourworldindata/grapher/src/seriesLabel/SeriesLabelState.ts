import * as _ from "lodash-es"
import { match } from "ts-pattern"
import { computed, makeObservable } from "mobx"
import { Bounds, excludeUndefined, RequiredBy } from "@ourworldindata/utils"
import { canAppendTextToLastLine, TextWrap } from "@ourworldindata/components"
import { ParsedLabel, parseLabel } from "../core/RegionGroups.js"
import { FontSettings } from "../core/GrapherConstants.js"
import {
    hasProviderTooltipData,
    RegionProviderWithTooltipData,
} from "./RegionProviderTooltipData.js"

export interface SeriesLabelStateOptions {
    text: string
    maxWidth: number
    fontSize: number
    fontWeight?: number
    lineHeight?: number
    textAnchor?: "start" | "end"
    formattedValue?: string
    placeFormattedValueInNewLine?: boolean
    showRegionProviderTooltip?: boolean
}

export type TextRole = "name" | "suffix" | "value"

export interface TextSpan {
    role: TextRole
    text: string
    fontWeight: number
}

export type SpanLine = TextSpan[]

interface TextFragment extends TextSpan {
    type: "text"
    width: number
}

interface IconFragment {
    type: "icon"
    providerKey: RegionProviderWithTooltipData
    iconSize: number
    width: number
}

interface SpaceFragment {
    type: "space"
    width: number
}

type ContentFragment = TextFragment | IconFragment | SpaceFragment

/**
 * A group of fragments that belong together, e.g. a region provider suffix
 * consists of "(WHO" + icon + ")" (i.e. text + icon + text)
 */
interface FragmentGroup {
    fragments: ContentFragment[]
    onNewLine: boolean
}

type ContentLine = ContentFragment[]

interface Position {
    x: number
    y: number
}

export type PositionedTextFragment = TextFragment & Position
export type PositionedIconFragment = IconFragment & Position

export type PositionedFragment = PositionedTextFragment | PositionedIconFragment

/**
 * Computes layout and positioning for a series label typically rendered
 * in the chart area
 *
 * A series label can consist of up to three parts:
 * 1. Name: The main label text (e.g. "United States")
 * 2. Suffix: An optional parenthetical suffix parsed from the name (e.g. "(WHO)")
 * 3. Value: An optional formatted value to display alongside the name (e.g. "45.2%")
 */
export class SeriesLabelState {
    private initialOptions: SeriesLabelStateOptions

    private defaultOptions = {
        fontWeight: 400,
        lineHeight: 1.1,
        placeFormattedValueInNewLine: false,
        showRegionProviderTooltip: false,
        textAnchor: "start",
    } as const satisfies Partial<SeriesLabelStateOptions>

    constructor(options: SeriesLabelStateOptions) {
        this.initialOptions = options
        makeObservable(this)
    }

    static fromTextWrap(
        textWrap: TextWrap,
        options?: Pick<
            SeriesLabelStateOptions,
            "showRegionProviderTooltip" | "textAnchor"
        >
    ): SeriesLabelState {
        return new SeriesLabelState({
            text: textWrap.text,
            maxWidth: textWrap.maxWidth,
            fontSize: textWrap.fontSize,
            fontWeight: textWrap?.fontWeight,
            lineHeight: textWrap?.lineHeight,
            showRegionProviderTooltip: options?.showRegionProviderTooltip,
            textAnchor: options?.textAnchor,
        })
    }

    getPositionForSvgRendering(x: number, y: number): [number, number] {
        return this.nameWrap.getPositionForSvgRendering(x, y)
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

    @computed get textAnchor(): "start" | "end" {
        return this.options.textAnchor
    }

    @computed private get parsedText(): ParsedLabel {
        return parseLabel(this.options.text)
    }

    @computed private get name(): string {
        // Only split the suffix from the main text if it's a region provider
        return this.parsedText.providerKey
            ? this.parsedText.name
            : this.parsedText.raw
    }

    @computed private get nameWrap(): TextWrap {
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

    @computed private get iconSize(): number {
        return Math.round(this.options.fontSize * 0.9)
    }

    @computed private get spaceWidth(): number {
        return Bounds.forText(" ", this.fontSettings).width
    }

    @computed private get spaceFragment(): SpaceFragment {
        return { type: "space", width: this.spaceWidth }
    }

    /**
     * Representation of the parenthetical region provider suffix (e.g. "(WHO)")
     *
     * Some region providers have an associated tooltip, in which case we render
     * an info icon inside the parentheses. If there is no info icon, the
     * suffix is rendered in a muted style to visually differentiate it from
     * the main name.
     */
    @computed private get regionProviderSuffix(): FragmentGroup | undefined {
        if (!this.parsedText.providerKey) return undefined

        const text = `(${this.parsedText.suffix})`
        const fontSettings = { ...this.fontSettings, fontWeight: 400 }

        const providerKey = this.parsedText.providerKey
        const shouldShowIcon =
            this.options.showRegionProviderTooltip &&
            hasProviderTooltipData(providerKey, this.options.text)

        if (shouldShowIcon) {
            const textBeforeIcon = `(${this.parsedText.suffix}`
            const textAfterIcon = `)`

            const textBeforeWidth = Bounds.forText(
                textBeforeIcon,
                fontSettings
            ).width
            const textAfterWidth = Bounds.forText(
                textAfterIcon,
                fontSettings
            ).width

            const iconWidthWithSpace = this.iconSize + this.spaceWidth
            const fitsOnSameLineAsName = canAppendTextToLastLine({
                existingTextWrap: this.nameWrap,
                textToAppend: text,
                reservedWidth: iconWidthWithSpace,
            })

            return {
                onNewLine: !fitsOnSameLineAsName,
                fragments: [
                    {
                        type: "text",
                        role: "suffix",
                        text: textBeforeIcon,
                        width: textBeforeWidth,
                        fontWeight: fontSettings.fontWeight,
                    },
                    this.spaceFragment,
                    {
                        type: "icon",
                        width: this.iconSize,
                        iconSize: this.iconSize,
                        providerKey,
                    },
                    {
                        type: "text",
                        role: "suffix",
                        text: textAfterIcon,
                        width: textAfterWidth,
                        fontWeight: fontSettings.fontWeight,
                    },
                ],
            }
        } else {
            const width = Bounds.forText(text, fontSettings).width

            const fitsOnSameLineAsName = canAppendTextToLastLine({
                existingTextWrap: this.nameWrap,
                textToAppend: text,
            })

            return {
                onNewLine: !fitsOnSameLineAsName,
                fragments: [
                    {
                        type: "text",
                        role: "suffix",
                        text,
                        width,
                        fontWeight: fontSettings.fontWeight,
                    },
                ],
            }
        }
    }

    @computed private get value(): FragmentGroup | undefined {
        if (!this.options.formattedValue) return undefined

        const text = this.options.formattedValue
        const fontSettings = { ...this.fontSettings, fontWeight: 400 }

        // Always place on new line if there is a suffix or when requested
        const forceNewLine =
            this.regionProviderSuffix ||
            this.options.placeFormattedValueInNewLine

        if (forceNewLine) {
            const width = Bounds.forText(text, fontSettings).width

            return {
                onNewLine: true,
                fragments: [
                    {
                        type: "text",
                        role: "value",
                        text,
                        width,
                        fontWeight: fontSettings.fontWeight,
                    },
                ],
            }
        }

        const width = Bounds.forText(text, fontSettings).width

        const fitsOnSameLineAsName = canAppendTextToLastLine({
            existingTextWrap: this.nameWrap,
            textToAppend: text,
        })

        return {
            onNewLine: !fitsOnSameLineAsName,
            fragments: [
                {
                    type: "text",
                    role: "value",
                    text,
                    width,
                    fontWeight: fontSettings.fontWeight,
                },
            ],
        }
    }

    /** Lines of content where each line consists of one or more fragments */
    @computed private get contentLines(): ContentLine[] {
        const {
            nameWrap,
            regionProviderSuffix: suffix,
            value,
            spaceFragment,
            fontSettings: { fontWeight },
        } = this

        // Map each line of the name to a fragment
        const lines: ContentLine[] = nameWrap.lines.map((line) => [
            {
                type: "text",
                role: "name",
                text: line.text,
                width: line.width,
                fontWeight: nameWrap.fontWeight ?? fontWeight,
            },
        ])

        // Reference to the last line of the name
        const lastNameLine = lines[lines.length - 1]

        // Append suffix and value fragments to the last line or add as new lines
        const fragmentGroups = excludeUndefined([suffix, value])
        for (const group of fragmentGroups) {
            if (group.onNewLine) lines.push(group.fragments)
            else lastNameLine.push(spaceFragment, ...group.fragments)
        }

        return lines
    }

    @computed get hasIcons(): boolean {
        return this.contentLines.some((line) =>
            line.some((f) => f.type === "icon")
        )
    }

    @computed get width(): number {
        const lineWidths = this.contentLines.map((line) =>
            _.sumBy(line, (fragment) => fragment.width)
        )
        return lineWidths.length > 0 ? Math.max(...lineWidths) : 0
    }

    @computed get height(): number {
        return this.contentLines.length * this.singleLineHeight
    }

    /** Content lines transformed for native SVG text rendering */
    @computed get spanLines(): SpanLine[] {
        return this.contentLines.map((line) => extractTextSpans(line))
    }

    /** List of positioned fragments ready for rendering */
    @computed get positionedFragments(): PositionedFragment[] {
        return this.contentLines.flatMap((fragments, lineIndex) =>
            positionLineFragments({
                fragments: fragments,
                y: lineIndex * this.singleLineHeight,
                textAnchor: this.options.textAnchor,
            })
        )
    }
}

/** Convert line fragments to text spans, merging spaces into adjacent text */
function extractTextSpans(line: ContentLine): TextSpan[] {
    const fragments = line.filter(
        (f) => f.type === "text" || f.type === "space"
    )

    return fragments
        .map((fragment, i) => {
            if (fragment.type === "space") return undefined
            const followsSpace = fragments[i - 1]?.type === "space"
            return {
                text: followsSpace ? " " + fragment.text : fragment.text,
                fontWeight: fragment.fontWeight,
                role: fragment.role,
            }
        })
        .filter((span) => span !== undefined)
}

/** Position fragments in a line based on their width and the textAnchor */
function positionLineFragments({
    fragments,
    y,
    textAnchor,
}: {
    fragments: ContentLine
    y: number
    textAnchor: SeriesLabelStateOptions["textAnchor"]
}): PositionedFragment[] {
    const positionedFragments: PositionedFragment[] = []

    // Calculate total line width
    const totalWidth = _.sumBy(fragments, (f) => f.width)

    // Starting x position based on textAnchor
    let x = textAnchor === "end" ? -totalWidth : 0

    for (const fragment of fragments) {
        match(fragment)
            .with({ type: "text" }, (fragment) => {
                positionedFragments.push({ ...fragment, x, y })
                x += fragment.width
            })
            .with({ type: "icon" }, (fragment) => {
                const iconYOffset = -fragment.iconSize + 1.5 // Small visual correction
                positionedFragments.push({ ...fragment, x, y: y + iconYOffset })
                x += fragment.width
            })
            .with({ type: "space" }, (fragment) => {
                // Account for space width but don't render anything
                x += fragment.width
            })
            .exhaustive()
    }

    return positionedFragments
}
