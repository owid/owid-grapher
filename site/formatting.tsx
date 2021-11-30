import * as cheerio from "cheerio"
import React from "react"
import ReactDOMServer from "react-dom/server"
import {
    FormattedPost,
    TocHeading,
    WP_PostType,
} from "../clientUtils/owidTypes"
import { last } from "../clientUtils/Util"
import { BAKED_BASE_URL, WORDPRESS_URL } from "../settings/serverSettings"
import { bakeGlobalEntitySelector } from "./bakeGlobalEntitySelector"
import {
    PROMINENT_LINK_CLASSNAME,
    renderAuthoredProminentLinks,
} from "./blocks/ProminentLink"
import { Byline } from "./Byline"
import { formatGlossaryTerms } from "./formatGlossary"
import { getMutableGlossary, glossary } from "./glossary"
import { SectionHeading } from "./SectionHeading"

export const GRAPHER_PREVIEW_CLASS = "grapherPreview"
export const SUMMARY_CLASSNAME = "wp-block-owid-summary"

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

export const splitContentIntoSectionsAndColumns = (
    cheerioEl: CheerioStatic
) => {
    interface Columns {
        wrapper: Cheerio
        first: Cheerio
        last: Cheerio
    }

    const getColumns = (style: string = "sticky-right"): Columns => {
        const emptyColumns = `<div class="wp-block-columns is-style-${style}"><div class="wp-block-column"></div><div class="wp-block-column"></div></div>`
        const cheerioEl = cheerio.load(emptyColumns)
        const $columns = cheerioEl("body").children().first()
        return {
            wrapper: $columns,
            first: $columns.children().first(),
            last: $columns.children().last(),
        }
    }

    const isColumnsEmpty = (columns: Columns) => {
        return columns.first.children().length === 0 &&
            columns.last.children().length === 0
            ? true
            : false
    }

    const flushColumns = (columns: Columns, $section: Cheerio): Columns => {
        $section.append(columns.wrapper)
        return getColumns()
    }

    // Wrap content demarcated by headings into section blocks
    // and automatically divide content into columns
    const sectionStarts = [cheerioEl("body").children().get(0)].concat(
        cheerioEl("body > h2").toArray()
    )
    for (const start of sectionStarts) {
        const $start = cheerioEl(start)
        const $section = cheerioEl("<section>")
        let columns = getColumns()
        let sideBySideColumns = getColumns("side-by-side")
        const $tempWrapper = cheerioEl("<div>")
        const $contents = $tempWrapper
            .append($start.clone(), $start.nextUntil(cheerioEl("h2")))
            .contents()

        $contents.each((i, el) => {
            const $el = cheerioEl(el)
            if (
                el.name === "h2" ||
                el.name === "h3" ||
                $el.hasClass("wp-block-columns") ||
                $el.hasClass("wp-block-owid-grid") ||
                $el.hasClass("wp-block-full-content-width") ||
                $el.find(
                    '.wp-block-owid-additional-information[data-variation="full-width"]'
                ).length !== 0
            ) {
                if (!isColumnsEmpty(columns)) {
                    columns = flushColumns(columns, $section)
                }
                $section.append($el)
            } else if (el.name === "h4") {
                if (!isColumnsEmpty(columns)) {
                    columns = flushColumns(columns, $section)
                }
                columns.first.append($el)
                columns = flushColumns(columns, $section)
            } else {
                if (
                    el.name === "figure" &&
                    $el.hasClass(GRAPHER_PREVIEW_CLASS)
                ) {
                    if (isColumnsEmpty(sideBySideColumns)) {
                        // Only fill the side by side buffer if there is an upcoming chart for a potential comparison.
                        // Otherwise let the standard process (sticky right) take over.
                        if (
                            $contents[i].nextSibling?.attribs?.class ===
                            GRAPHER_PREVIEW_CLASS
                        ) {
                            columns = flushColumns(columns, $section)
                            sideBySideColumns.first.append($el)
                        } else {
                            columns.last.append($el)
                        }
                    } else {
                        sideBySideColumns.last.append($el)
                        $section.append(sideBySideColumns.wrapper)
                        sideBySideColumns = getColumns("side-by-side")
                    }
                }

                // Move images to the right column
                else if (
                    el.name === "figure" ||
                    el.name === "iframe" ||
                    // Temporary support for old chart iframes
                    el.name === "address" ||
                    $el.hasClass("wp-block-image") ||
                    $el.hasClass("tableContainer") ||
                    // Temporary support for non-Gutenberg iframes wrapped in wpautop's <p>
                    // Also catches older iframes (e.g. https://ourworldindata.org/food-per-person#world-map-of-minimum-and-average-dietary-energy-requirement-mder-and-ader)
                    $el.find("iframe").length !== 0 ||
                    // TODO: remove temporary support for pre-Gutenberg images and associated captions
                    el.name === "h6" ||
                    ($el.find("img").length !== 0 &&
                        !$el.hasClass(PROMINENT_LINK_CLASSNAME) &&
                        !$el.find(
                            ".wp-block-owid-additional-information[data-variation='merge-left']"
                        ))
                ) {
                    columns.last.append($el)
                } else {
                    // Move non-heading, non-image content to the left column
                    columns.first.append($el)
                }
            }
        })
        if (!isColumnsEmpty(columns)) {
            $section.append(columns.wrapper)
        }
        $start.replaceWith($section)
    }
}

export const getBodyHtml = (cheerioEl: CheerioStatic): string => {
    return cheerioEl("body").html() || ""
}

const addGlossaryToSections = (cheerioEl: CheerioStatic) => {
    const $sections = cheerioEl("section")
    $sections.each((i, el) => {
        const $el = cheerioEl(el)
        const $contents = $el.contents()

        formatGlossaryTerms(cheerioEl, $contents, getMutableGlossary(glossary))
    })
}

const addTocToSections = (
    cheerioEl: CheerioStatic,
    tocHeadings: TocHeading[]
) => {
    cheerioEl("h2")
        .toArray()
        .map((el) => cheerioEl(el))
        .filter(($el) => {
            return $el.closest(`.${SUMMARY_CLASSNAME}`).length === 0
        })
        .forEach(($el) => {
            $el.replaceWith(
                ReactDOMServer.renderToStaticMarkup(
                    <SectionHeading
                        title={$el.text()}
                        tocHeadings={tocHeadings}
                    >
                        <div
                            dangerouslySetInnerHTML={{
                                __html: cheerioEl.html($el),
                            }}
                        />
                    </SectionHeading>
                )
            )
        })
}

const addPostHeader = (cheerioEl: CheerioStatic, post: FormattedPost) => {
    const publishedDate = formatDate(post.date)
    const modifiedDate = formatDate(post.modifiedDate)

    cheerioEl("body").prepend(
        ReactDOMServer.renderToStaticMarkup(
            <>
                <Byline
                    authors={post.authors}
                    withMax={false}
                    override={post.byline}
                />

                <>
                    <time>{publishedDate}</time>
                </>
                {modifiedDate !== publishedDate && (
                    <>
                        <span> - Last updated on </span>
                        <time>{modifiedDate}</time>
                    </>
                )}
            </>
        )
    )
}

export const addContentFeatures = (post: FormattedPost): string => {
    const cheerioEl = cheerio.load(post.html)

    if (post.type === WP_PostType.Post) addPostHeader(cheerioEl, post)
    splitContentIntoSectionsAndColumns(cheerioEl)
    bakeGlobalEntitySelector(cheerioEl)
    addTocToSections(cheerioEl, post.tocHeadings)
    if (post.glossary) addGlossaryToSections(cheerioEl)

    return getBodyHtml(cheerioEl)
}
