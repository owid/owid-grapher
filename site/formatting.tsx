import * as cheerio from "cheerio"
import * as lodash from "lodash"
import { BAKED_BASE_URL, WORDPRESS_URL } from "settings"
import { FullPost } from "db/wpdb"
import { GrapherExports } from "../baker/GrapherBakingUtils"
import {
    FormattedPost,
    FormattingOptions,
    SubNavId,
} from "clientUtils/owidTypes"
import { initMathJax } from "./MathJax"
import { Country } from "clientUtils/countries"

import { countryProfileDefaultCountryPlaceholder } from "./countryProfileProjects"
import { formatWordpressPost } from "../baker/formatWordpressPost"

// A modifed FontAwesome icon
export const INTERACTIVE_ICON_SVG = `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="hand-pointer" class="svg-inline--fa fa-hand-pointer fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 617">
    <path fill="currentColor" d="M448,344.59v96a40.36,40.36,0,0,1-1.06,9.16l-32,136A40,40,0,0,1,376,616.59H168a40,40,0,0,1-32.35-16.47l-128-176a40,40,0,0,1,64.7-47.06L104,420.58v-276a40,40,0,0,1,80,0v200h8v-40a40,40,0,1,1,80,0v40h8v-24a40,40,0,1,1,80,0v24h8a40,40,0,1,1,80,0Zm-256,80h-8v96h8Zm88,0h-8v96h8Zm88,0h-8v96h8Z" transform="translate(0 -0.41)"/>
    <path fill="currentColor" opacity="0.6" d="M239.76,234.78A27.5,27.5,0,0,1,217,192a87.76,87.76,0,1,0-145.9,0A27.5,27.5,0,1,1,25.37,222.6,142.17,142.17,0,0,1,1.24,143.17C1.24,64.45,65.28.41,144,.41s142.76,64,142.76,142.76a142.17,142.17,0,0,1-24.13,79.43A27.47,27.47,0,0,1,239.76,234.78Z" transform="translate(0 -0.41)"/>
</svg>`

export const DEEP_LINK_CLASS = "deep-link"

const formatMathJax = initMathJax()

export const extractLatex = (html: string): [string, string[]] => {
    const latexBlocks: string[] = []
    html = html.replace(/\[latex\]([\s\S]*?)\[\/latex\]/gm, (_, latex) => {
        latexBlocks.push(
            latex.replace("\\[", "").replace("\\]", "").replace(/\$\$/g, "")
        )
        return "[latex]"
    })
    return [html, latexBlocks]
}

export const formatLatex = async (
    html: string,
    latexBlocks?: string[]
): Promise<string> => {
    if (!latexBlocks) [html, latexBlocks] = extractLatex(html)

    // return early so we don't do unnecessary work for sites without latex
    if (!latexBlocks.length) return html

    const compiled: string[] = []
    for (const latex of latexBlocks) {
        try {
            compiled.push(formatMathJax(latex))
        } catch (err) {
            compiled.push(
                `${latex} (Could not format equation due to MathJax error)`
            )
        }
    }

    let i = -1
    return html.replace(/\[latex\]/g, () => {
        i += 1
        return compiled[i]
    })
}

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
const parseFormattingOptions = (text: string): FormattingOptions => {
    const options: { [key: string]: string | boolean } = {}
    text.split(/\s+/)
        // filter out empty strings
        .filter((s) => s && s.length > 0)
        // populate options object
        .forEach((option: string) => {
            const [name, value] = option.split(":") as [
                string,
                string | undefined
            ]
            let parsedValue
            if (value === undefined || value === "true") parsedValue = true
            else if (value === "false") parsedValue = false
            else parsedValue = value
            options[name] = parsedValue
        })
    return options
}

// Standardize urls
const formatLinks = (html: string) =>
    html
        .replace(new RegExp(WORDPRESS_URL, "g"), BAKED_BASE_URL)
        .replace(new RegExp("https?://owid.cloud", "g"), BAKED_BASE_URL)
        .replace(new RegExp("https?://ourworldindata.org", "g"), BAKED_BASE_URL)

export const formatReusableBlock = (html: string) => formatLinks(html)

export const formatPost = async (
    post: FullPost,
    formattingOptions: FormattingOptions,
    grapherExports?: GrapherExports
): Promise<FormattedPost> => {
    const html = formatLinks(post.content)

    // No formatting applied, plain source HTML returned
    if (formattingOptions.raw)
        return {
            ...post,
            html,
            footnotes: [],
            references: [],
            tocHeadings: [],
            excerpt: post.excerpt || "",
        }

    // Override formattingOptions if specified in the post (as an HTML comment)
    const options: FormattingOptions = Object.assign(
        {
            toc: post.type === "page",
            footnotes: true,
        },
        formattingOptions
    )
    return formatWordpressPost(post, html, options, grapherExports)
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

export const formatAuthors = (authors: string[], requireMax?: boolean) => {
    if (requireMax && authors.indexOf("Max Roser") === -1)
        authors.push("Max Roser")

    let authorsText = authors.slice(0, -1).join(", ")
    if (authorsText.length === 0) authorsText = authors[0]
    else authorsText += ` and ${lodash.last(authors)}`

    return authorsText
}

export const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "2-digit",
    })
