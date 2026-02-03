import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { Bounds, RequiredBy } from "@ourworldindata/utils"
import { canAppendTextToLastLine, TextWrap } from "@ourworldindata/components"
import {
    AnyRegionDataProvider,
    ParsedLabel,
    parseLabelWithSuffix,
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
    showProviderTooltip?: boolean
    textAnchor?: "start" | "end"
}

export type TextFragmentRole = "name" | "suffix" | "value"

interface TextFragment {
    type: "text"
    role: TextFragmentRole
    text: string
    fontWeight: number
    width: number
}

interface IconFragment {
    type: "icon"
    providerKey: AnyRegionDataProvider
    iconSize: number
    width: number
}

interface SpaceFragment {
    type: "space"
    width: number
}

type ContentFragment = TextFragment | IconFragment | SpaceFragment

/**
 * A group of fragments that belong together, e.g. a provider suffix
 * consists of "(WHO" + icon + ")" (i.e. text + icon + text fragments)
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

export type TextRenderFragment = TextFragment & Position
export type IconRenderFragment = IconFragment & Position

export type RenderFragment = TextRenderFragment | IconRenderFragment

/**
 * Manages the layout for a series label in charts.
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
        showProviderTooltip: false,
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
            "showProviderTooltip" | "textAnchor"
        >
    ): SeriesLabelState {
        return new SeriesLabelState({
            text: textWrap.text,
            maxWidth: textWrap.maxWidth,
            fontSize: textWrap.fontSize,
            fontWeight: textWrap?.fontWeight,
            lineHeight: textWrap?.lineHeight,
            showProviderTooltip: options?.showProviderTooltip,
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

    @computed private get parsedText(): ParsedLabel {
        return parseLabelWithSuffix(this.options.text)
    }

    @computed private get name(): string {
        // Only split the suffix from the main text if it's a region provider
        return this.parsedText.providerKey
            ? this.parsedText.main
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

    @computed private get regionProviderSuffix(): FragmentGroup | undefined {
        if (!this.parsedText.providerKey || !this.parsedText.suffix)
            return undefined

        const text = `(${this.parsedText.suffix})`
        const fontSettings = { ...this.fontSettings, fontWeight: 400 }
        const shouldShowIcon = this.options.showProviderTooltip

        const iconWidth = shouldShowIcon ? this.iconSize + this.spaceWidth : 0
        const fitsOnSameLineAsName = canAppendTextToLastLine({
            existingTextWrap: this.nameWrap,
            textToAppend: text,
            reservedWidth: iconWidth,
        })

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
                        providerKey: this.parsedText.providerKey,
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
        const text = this.options.formattedValue
        if (!text) return undefined

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

        const fitsOnSameLineAsName = canAppendTextToLastLine({
            existingTextWrap: this.nameWrap,
            textToAppend: text,
        })
        const width = Bounds.forText(text, fontSettings).width

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

    /** Lines of content where each line consists of one or more fragments (text, icon, space) */
    @computed private get contentLines(): ContentLine[] {
        const {
            nameWrap,
            regionProviderSuffix,
            value,
            fontSettings: { fontWeight },
        } = this

        const lines: ContentLine[] = []

        // Process each line of the name
        for (let i = 0; i < nameWrap.lines.length; i++) {
            const line = nameWrap.lines[i]
            const lineFragments: ContentLine = [
                {
                    type: "text",
                    role: "name",
                    text: line.text,
                    width: line.width,
                    fontWeight: nameWrap.fontWeight ?? fontWeight,
                },
            ]

            // On the last line, append suffix or value if they fit
            const isLastLine = i === nameWrap.lines.length - 1
            if (isLastLine) {
                // Add suffix if on same line
                if (regionProviderSuffix && !regionProviderSuffix.onNewLine) {
                    lineFragments.push(this.spaceFragment)
                    lineFragments.push(...regionProviderSuffix.fragments)
                }

                // Add value if on same line (only happens when no suffix)
                if (value && !value.onNewLine) {
                    lineFragments.push(this.spaceFragment)
                    lineFragments.push(...value.fragments)
                }
            }

            lines.push(lineFragments)
        }

        // Add suffix on new line if applicable
        if (regionProviderSuffix?.onNewLine)
            lines.push(regionProviderSuffix.fragments)

        // Add value on new line if applicable
        if (value?.onNewLine) lines.push(value.fragments)

        return lines
    }

    @computed get width(): number {
        const lineWidths = this.contentLines.map((line) =>
            _.sumBy(line, (f) => f.width)
        )
        return lineWidths.length > 0 ? Math.max(...lineWidths) : 0
    }

    @computed get height(): number {
        return this.contentLines.length * this.singleLineHeight
    }

    /** List of positioned fragments ready for rendering */
    @computed get renderFragments(): RenderFragment[] {
        return this.contentLines.flatMap((line, i) =>
            positionLineFragments({
                lineFragments: line,
                y: i * this.singleLineHeight,
                textAnchor: this.options.textAnchor,
            })
        )
    }
}

function positionLineFragments({
    lineFragments,
    y,
    textAnchor,
}: {
    lineFragments: ContentLine
    y: number
    textAnchor: SeriesLabelStateOptions["textAnchor"]
}): RenderFragment[] {
    const fragments: RenderFragment[] = []

    // Calculate total line width
    const totalWidth = _.sumBy(lineFragments, (f) => f.width)

    // Starting x position based on textAnchor
    // For "start": start at 0, go right
    // For "end": start at -totalWidth, go right (so rightmost edge is at 0)
    let x = textAnchor === "end" ? -totalWidth : 0

    for (const fragment of lineFragments) {
        match(fragment)
            .with({ type: "text" }, (fragment) => {
                fragments.push({ ...fragment, x, y })
                x += fragment.width
            })
            .with({ type: "icon" }, (fragment) => {
                const iconYOffset = -fragment.iconSize + 1.5 // Small visual correction
                fragments.push({ ...fragment, x, y: y + iconYOffset })
                x += fragment.width
            })
            .with({ type: "space" }, (fragment) => {
                // Account for space width but don't render anything
                x += fragment.width
            })
            .exhaustive()
    }

    return fragments
}
