import * as cheerio from "cheerio"
import {
    DataValueConfiguration,
    DataValueQueryArgs,
    FormattedPost,
    FormattingOptions,
    KeyValueProps,
    LegacyVariableId,
} from "../clientUtils/owidTypes"
import { Country } from "../clientUtils/countries"
import { countryProfileDefaultCountryPlaceholder } from "../site/countryProfileProjects"
import { BAKED_BASE_URL, WORDPRESS_URL } from "../settings/serverSettings"
import { DATA_VALUE } from "../site/DataValue"
import { LegacyVariablesAndEntityKey } from "../grapher/core/LegacyVariableCode"
import {
    LegacyChartDimensionInterface,
    LegacyVariableDisplayConfigInterface,
} from "../clientUtils/LegacyVariableDisplayConfigInterface"
import { legacyToOwidTableAndDimensions } from "../grapher/core/LegacyToOwidTable"

export const DEEP_LINK_CLASS = "deep-link"

// Standardize urls
export const formatLinks = (html: string) =>
    html
        .replace(new RegExp(WORDPRESS_URL, "g"), BAKED_BASE_URL)
        .replace(new RegExp("https?://owid.cloud", "g"), BAKED_BASE_URL)
        .replace(new RegExp("https?://ourworldindata.org", "g"), BAKED_BASE_URL)

export const getHtmlContentWithStyles = (cheerEl: CheerioStatic) => {
    // Inline styling
    // Get the first root level <style> tag within the content as it gets
    // stripped out by $("body").html() below. Voluntarily limits to 1 as there
    // should not be a need for more.
    const style =
        cheerEl("style").length === 1
            ? `<style>${cheerEl("style").html()}</style>`
            : ""

    // This is effectively a hack within a hack, as style tags are technically
    // not allowed in the body (of the main article)
    return `${style}${cheerEl("body").html()}`
}

export const extractFormattingOptions = (html: string): FormattingOptions => {
    const formattingOptionsMatch = html.match(
        /<!--\s*formatting-options\s+(.*)\s*-->/
    )
    return formattingOptionsMatch
        ? parseFormattingOptions(formattingOptionsMatch[1])
        : {}
}

// Converts "toc:false raw somekey:somevalue" to { toc: false, raw: true, somekey: "somevalue" }
// If only the key is specified, the value is assumed to be true (e.g. "raw" above)
export const parseFormattingOptions = (text: string): FormattingOptions => {
    return parseKeyValueArgs(text)
}

export const dataValueRegex = new RegExp(
    `{{\\s*${DATA_VALUE}\\s*(.+?)\\s*}}`,
    "g"
)

export const extractDataValuesConfiguration = async (
    html: string
): Promise<Map<string, DataValueConfiguration>> => {
    const dataValueSeparator = /\s*\|\s*/
    const dataValuesConfigurations = new Map<string, DataValueConfiguration>()

    const dataValueMatches = html.matchAll(dataValueRegex)
    for (const match of dataValueMatches) {
        const dataValueConfigurationString = match[1]
        const [queryArgsString, template] =
            dataValueConfigurationString.split(dataValueSeparator)
        const queryArgs = parseDataValueArgs(queryArgsString)

        dataValuesConfigurations.set(dataValueConfigurationString, {
            queryArgs,
            template,
        })
    }
    return dataValuesConfigurations
}

export const parseDataValueArgs = (
    rawArgsString: string
): DataValueQueryArgs => {
    return Object.fromEntries(
        Object.entries(parseKeyValueArgs(rawArgsString)).map(([k, v]) => [
            k,
            Number(v),
        ])
    )
}

export const parseKeyValueArgs = (text: string): KeyValueProps => {
    const options: { [key: string]: string | boolean } = {}
    text.split(/\s+/)
        // filter out empty strings
        .filter((s) => s && s.length > 0)
        .forEach((option: string) => {
            // using regex instead of split(":") to handle ":" in value
            // e.g. {{LastUpdated timestampUrl:https://...}}
            const optionRegex = /([^:]+):?(.*)/
            const [, name, value] = option.match(optionRegex) as [
                any,
                string,
                string
            ]
            let parsedValue
            if (value === "" || value === "true") parsedValue = true
            else if (value === "false") parsedValue = false
            else parsedValue = value
            options[name] = parsedValue
        })
    return options
}

export const formatDataValue = (
    value: number,
    variableId: LegacyVariableId,
    legacyVariableDisplayConfig: LegacyVariableDisplayConfigInterface = {},
    legacyChartDimension: LegacyChartDimensionInterface | undefined
) => {
    if (!legacyChartDimension) return
    const legacyVariableConfig: LegacyVariablesAndEntityKey = {
        entityKey: {},
        variables: {
            [variableId]: {
                id: variableId,
                display: legacyVariableDisplayConfig,
                values: [value],
            },
        },
    }

    const legacyGrapherConfig = {
        dimensions: [
            {
                ...legacyChartDimension,
            },
        ],
    }

    const { table, dimensions } = legacyToOwidTableAndDimensions(
        legacyVariableConfig,
        legacyGrapherConfig
    )

    const formattedValueWithUnit = table
        .get(dimensions[0].slug)
        .formatValueLong(table.rows[0][variableId])

    return formattedValueWithUnit
}

export const formatCountryProfile = (
    post: FormattedPost,
    country: Country
): FormattedPost => {
    // Localize country selector
    const htmlWithLocalizedCountrySelector = post.html.replace(
        countryProfileDefaultCountryPlaceholder,
        country.code
    )

    const cheerioEl = cheerio.load(htmlWithLocalizedCountrySelector)

    // Inject country names on h3 headings which have been already identified as subsections
    // (filtering them out based on whether they have a deep link anchor attached to them)
    cheerioEl(`h3 a.${DEEP_LINK_CLASS}`).each((_, deepLinkAnchor) => {
        const $deepLinkAnchor = cheerioEl(deepLinkAnchor)
        $deepLinkAnchor.after(`${country.name}: `)
    })

    return { ...post, html: getHtmlContentWithStyles(cheerioEl) }
}

// Relies on formatLinks URL standardisation
export const isStandaloneInternalLink = (
    el: CheerioElement,
    $: CheerioStatic
) => {
    return (
        el.attribs.href?.startsWith(BAKED_BASE_URL) &&
        el.parent.tagName === "p" &&
        $(el.parent).contents().length === 1
    )
}
