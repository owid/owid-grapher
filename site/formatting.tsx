import * as cheerio from "cheerio"
import { last } from "../clientUtils/Util"
import { BAKED_BASE_URL, WORDPRESS_URL } from "../settings/serverSettings"
import { renderAuthoredProminentLinks } from "./blocks/ProminentLink"

// Standardize urls
const formatLinks = (html: string) =>
    html
        .replace(new RegExp(WORDPRESS_URL, "g"), BAKED_BASE_URL)
        .replace(new RegExp("https?://owid.cloud", "g"), BAKED_BASE_URL)
        .replace(new RegExp("https?://ourworldindata.org", "g"), BAKED_BASE_URL)

export const formatReusableBlock = (html: string): string => {
    const cheerioEl = cheerio.load(html)
    renderAuthoredProminentLinks(cheerioEl)
    const rendered = cheerioEl("body").html()
    if (!rendered) return ""

    const formatted = formatLinks(rendered)
    return formatted
}

export const formatAuthors = (authors: string[], requireMax?: boolean) => {
    if (requireMax && authors.indexOf("Max Roser") === -1)
        authors.push("Max Roser")

    let authorsText = authors.slice(0, -1).join(", ")
    if (authorsText.length === 0) authorsText = authors[0]
    else authorsText += ` and ${last(authors)}`

    return authorsText
}

export const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "2-digit",
    })
