// Hardcoded metadata overrides that swap in curated `descriptionKey`
// content for specific indicators on data pages. The override values may
// include ArchieML `{.callout}` blocks (since the content is authored in
// Google Docs first) — those are converted to Markdown blockquotes here
// so they can be rendered by the existing markdown pipeline downstream.

import { load } from "archieml"

const METADATA: Record<string, Record<string, unknown>> = {
    "life-expectancy": {
        descriptionKey: [
            `
[Period life expectancy](#dod:period-life-expectancy) is the number of years the average person born in a certain year would live if they experienced the same chances of dying at each age as people did that year.

{.callout}
title:
icon: info
[.+text]
**Example.** Switzerland had a life expectancy of 84 years in 2023, which means that the average person born in 2023 would live to 84 years old if the likelihood of death doesn’t change over their lifespan. In reality, the likelihood of dying is decreasing in many countries. So when this person reaches 84 years old in the year 2107, there’s a good chance the life expectancy of Switzerland will be higher than 84.

But period life expectancy is NOT trying to predict the future. Instead, it’s a summary of the population’s current health. It describes how long you would expect to live if you were born today and if the likelihood of dying throughout each year of your life doesn’t change at all during your lifespan.
[]
{}

Keep reading:
* [Life expectancy – what does this actually mean?](https://ourworldindata.org/life-expectancy-how-is-it-calculated-and-how-should-it-be-interpreted)
* [Period versus cohort measures: what’s the difference?](https://ourworldindata.org/period-versus-cohort-measures-whats-the-difference)

### Measurement

We compiled this data from multiple data sources:
* 1876-1950: we rely on the [Human Mortality Database (2025)](#ddod/source:Human Mortality Database) combined with [Zijdeman (2015)](#ddod/source:Life Expectancy at birth) for country-level data. For regional data, we use [Riley (2005)](#ddod/source:Estimates of Regional and Global Life Expectancy, 1800-2001).
* 1950-today: we use the [United Nations World Population Prospects (2024)](#ddod/source:World Population Prospects).

[This spreadsheet](https://docs.google.com/spreadsheets/d/1LnrU1V3p2wq7sAPY4AHRdH1urol3cKev7prEvlLfSU4/edit?gid=0#gid=0) lists the data source for each data point.
            `,
        ],
    },
}

type ArchieMlCalloutTextBlock = {
    type?: string
    value?:
        | string
        | string[]
        | {
              text?: string
              level?: string
          }
}

type ArchieMlCallout = {
    title?: string
    text?: ArchieMlCalloutTextBlock[] | string
}

const ARCHIEML_CALLOUT_BLOCK_REGEX = /\{\.callout\}[\s\S]*?\{\}/g

const toBlockquote = (text: string): string =>
    text
        .split("\n")
        .map((line) => (line.trim().length === 0 ? ">" : `> ${line}`))
        .join("\n")

const convertArchieMlCalloutTextBlockToMarkdown = (
    block: ArchieMlCalloutTextBlock
): string | undefined => {
    if (block.type === "text" && typeof block.value === "string") {
        return block.value.trim()
    }

    if (block.type === "list" && Array.isArray(block.value)) {
        return block.value
            .map((item) => String(item).trim())
            .filter((item) => item.length > 0)
            .map((item) => `- ${item}`)
            .join("\n")
    }

    if (block.type === "numbered-list" && Array.isArray(block.value)) {
        return block.value
            .map((item) => String(item).trim())
            .filter((item) => item.length > 0)
            .map((item, index) => `${index + 1}. ${item}`)
            .join("\n")
    }

    if (
        block.type === "heading" &&
        block.value &&
        typeof block.value === "object" &&
        "text" in block.value &&
        typeof block.value.text === "string"
    ) {
        return `**${block.value.text.trim()}**`
    }

    if (typeof block.value === "string") return block.value.trim()
    return undefined
}

const convertArchieMlCalloutBlockToMarkdown = (
    archiemlBlock: string
): string => {
    try {
        const parsed = load(archiemlBlock) as { callout?: ArchieMlCallout }
        const callout = parsed.callout
        if (!callout) return archiemlBlock

        const body =
            typeof callout.text === "string"
                ? callout.text
                : (callout.text ?? [])
                      .map(convertArchieMlCalloutTextBlockToMarkdown)
                      .filter((value): value is string => !!value)
                      .join("\n\n")

        if (!body && !callout.title) return archiemlBlock

        const markdownChunks: string[] = []
        if (callout.title?.trim()) {
            markdownChunks.push(`> **${callout.title.trim()}**`)
        }
        if (body.trim()) {
            if (markdownChunks.length > 0) markdownChunks.push(">")
            markdownChunks.push(toBlockquote(body.trim()))
        }
        return markdownChunks.join("\n")
    } catch {
        return archiemlBlock
    }
}

const parseArchieMlCalloutsInDescriptionText = (text: string): string => {
    if (!text.includes("{.callout}")) return text
    return text.replace(ARCHIEML_CALLOUT_BLOCK_REGEX, (archiemlBlock) =>
        convertArchieMlCalloutBlockToMarkdown(archiemlBlock)
    )
}

const normalizeMetadataOverride = (
    metadataOverride: Record<string, unknown>
): Record<string, unknown> => {
    const normalized: Record<string, unknown> = { ...metadataOverride }
    if (typeof normalized.descriptionKey === "string") {
        normalized.descriptionKey = [
            parseArchieMlCalloutsInDescriptionText(normalized.descriptionKey),
        ]
    } else if (Array.isArray(normalized.descriptionKey)) {
        normalized.descriptionKey = normalized.descriptionKey.map((item) =>
            typeof item === "string"
                ? parseArchieMlCalloutsInDescriptionText(item)
                : item
        )
    }
    return normalized
}

export const getMetadataOverrideForSlug = (
    slug: string | undefined
): Record<string, unknown> | undefined => {
    if (!slug) return undefined
    const override = METADATA[slug]
    return override ? normalizeMetadataOverride(override) : undefined
}
