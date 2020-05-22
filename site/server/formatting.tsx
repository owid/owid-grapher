import { SectionHeading } from "./../client/SectionHeading/SectionHeading"
import * as cheerio from "cheerio"
import urlSlug from "url-slug"
import * as _ from "lodash"
import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import { HTTPS_ONLY } from "serverSettings"
import { BAKED_BASE_URL, WORDPRESS_URL } from "settings"
import { getTables, FullPost } from "db/wpdb"
import Tablepress from "./views/Tablepress"
import { GrapherExports } from "./grapherUtil"
import * as path from "path"
import { renderBlocks } from "site/client/blocks"
import {
    RelatedCharts,
    RelatedChart
} from "site/client/blocks/RelatedCharts/RelatedCharts"
import { initMathJax } from "./MathJax"
import { bakeGlobalEntityControl } from "site/client/global-entity/GlobalEntityControl"

// A modifed FontAwesome icon
const INTERACTIVE_ICON_SVG = `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="hand-pointer" class="svg-inline--fa fa-hand-pointer fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 617">
    <path fill="currentColor" d="M448,344.59v96a40.36,40.36,0,0,1-1.06,9.16l-32,136A40,40,0,0,1,376,616.59H168a40,40,0,0,1-32.35-16.47l-128-176a40,40,0,0,1,64.7-47.06L104,420.58v-276a40,40,0,0,1,80,0v200h8v-40a40,40,0,1,1,80,0v40h8v-24a40,40,0,1,1,80,0v24h8a40,40,0,1,1,80,0Zm-256,80h-8v96h8Zm88,0h-8v96h8Zm88,0h-8v96h8Z" transform="translate(0 -0.41)"/>
    <path fill="currentColor" opacity="0.6" d="M239.76,234.78A27.5,27.5,0,0,1,217,192a87.76,87.76,0,1,0-145.9,0A27.5,27.5,0,1,1,25.37,222.6,142.17,142.17,0,0,1,1.24,143.17C1.24,64.45,65.28.41,144,.41s142.76,64,142.76,142.76a142.17,142.17,0,0,1-24.13,79.43A27.47,27.47,0,0,1,239.76,234.78Z" transform="translate(0 -0.41)"/>
</svg>`

const formatMathJax = initMathJax()

export interface Reference {}

export interface FormattedPost {
    id: number
    postId?: number
    type: "post" | "page"
    slug: string
    path: string
    title: string
    subtitle?: string | null
    date: Date
    modifiedDate: Date
    lastUpdated?: string | null
    authors: string[]
    info?: string | null
    html: string
    footnotes: string[]
    references: Reference[]
    excerpt: string
    imageUrl?: string
    tocHeadings: { text: string; slug: string; isSubheading: boolean }[]
    relatedCharts?: RelatedChart[]
}

export interface TocHeading {
    text: string
    html?: string
    slug: string
    isSubheading: boolean
}

function extractLatex(html: string): [string, string[]] {
    const latexBlocks: string[] = []
    html = html.replace(/\[latex\]([\s\S]*?)\[\/latex\]/gm, (_, latex) => {
        latexBlocks.push(
            latex
                .replace("\\[", "")
                .replace("\\]", "")
                .replace(/\$\$/g, "")
        )
        return "[latex]"
    })
    return [html, latexBlocks]
}

async function formatLatex(
    html: string,
    latexBlocks?: string[]
): Promise<string> {
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

export async function formatWordpressPost(
    post: FullPost,
    html: string,
    formattingOptions: FormattingOptions,
    grapherExports?: GrapherExports
): Promise<FormattedPost> {
    // Strip comments
    html = html.replace(/<!--[^>]+-->/g, "")

    // Need to skirt around wordpress formatting to get proper latex rendering
    let latexBlocks
    ;[html, latexBlocks] = extractLatex(html)

    const references: Reference[] = []
    html = html.replace(/\[cite\]([\s\S]*?)\[\/cite\]/gm, () => {
        references.push({}) // Todo
        return ``
    })

    html = await formatLatex(html, latexBlocks)

    // Footnotes
    const footnotes: string[] = []
    html = html.replace(/{ref}([\s\S]*?){\/ref}/gm, (_, footnote) => {
        if (formattingOptions.footnotes) {
            footnotes.push(footnote)
            const i = footnotes.length
            return `<a id="ref-${i}" class="ref" href="#note-${i}"><sup>${i}</sup></a>`
        } else {
            return ""
        }
    })

    // Insert [table id=foo] tablepress tables
    const tables = await getTables()
    html = html.replace(/\[table\s+id=(\d+)\s*\/\]/g, (match, tableId) => {
        const table = tables.get(tableId)
        if (table)
            return ReactDOMServer.renderToStaticMarkup(
                <Tablepress data={table.data} />
            )
        else return "UNKNOWN TABLE"
    })

    // No need for wordpress urls
    html = html.replace(new RegExp("/app/uploads", "g"), "/uploads")

    // Give "Add country" text (and variations) the appearance of "+ Add Country" chart control
    html = html.replace(
        /(\+ )?[a|A]dd [c|C]ountry/g,
        `<span class="add-country">
            <span class="icon">
                <svg width="16" height="16"><path d="M3,8 h10 m-5,-5 v10"></path></svg>
            </span>
            Add country
        </span>`
    )

    const $ = cheerio.load(html)

    // Related charts
    // Mimicking SSR output of additional information block from PHP
    if (
        // HACK
        post.slug !== "coronavirus" &&
        post.relatedCharts &&
        post.relatedCharts.length !== 0
    ) {
        const allCharts = `
        <block type="additional-information">
            <content>
                <h3>All our charts on ${post.title}</h3>
                ${ReactDOMServer.renderToStaticMarkup(
                    <div>
                        <RelatedCharts charts={post.relatedCharts} />
                    </div>
                )}
            </content>
        </block>
        `
        const $summary = $(".wp-block-owid-summary")
        if ($summary.length !== 0) {
            $summary.after(allCharts)
        } else {
            $("body > h2:first-of-type, body > h3:first-of-type")
                .first()
                .before(allCharts)
        }
    }

    // SSR rendering of Gutenberg blocks, before hydration on client
    renderBlocks($)

    // Extract blog info content
    let info = null
    const $info = $(".blog-info")
    if ($info.length) {
        info = $info.html()
        $info.remove()
    }

    // Extract last updated
    let lastUpdated
    const $lastUpdated = $(".wp-block-last-updated")
    if ($lastUpdated.length) {
        lastUpdated = $lastUpdated.html()
        $lastUpdated.remove()
    }

    // Extract page subtitle
    let pageSubtitle
    const $pageSubtitle = $(".wp-block-page-subtitle")
    if ($pageSubtitle.length) {
        pageSubtitle = $pageSubtitle.text()
        $pageSubtitle.remove()
    }

    // Replace grapher iframes with static previews
    const GRAPHER_PREVIEW_CLASS = "grapherPreview"
    if (grapherExports) {
        const grapherIframes = $("iframe")
            .toArray()
            .filter(el => (el.attribs["src"] || "").match(/\/grapher\//))
        for (const el of grapherIframes) {
            const $el = $(el)
            const src = el.attribs["src"].trim()
            const chart = grapherExports.get(src)
            if (chart) {
                const output = `
                <figure data-grapher-src="${src}" class="${GRAPHER_PREVIEW_CLASS}">
                    <a href="${src}" target="_blank">
                        <div><img src="${chart.svgUrl}" width="${chart.width}" height="${chart.height}" loading="lazy" data-no-lightbox /></div>
                        <div class="interactionNotice">
                            <span class="icon">${INTERACTIVE_ICON_SVG}</span>
                            <span class="label">Click to open interactive version</span>
                        </div>
                    </a>
                </figure>`
                if (el.parent.tagName === "p") {
                    // We are about to replace <iframe> with <figure>. However, there cannot be <figure> within <p>,
                    // so we are lifting the <figure> out.
                    // Where does this markup  come from? Historically, wpautop wrapped <iframe> in <p>. Some non-Gutengerg
                    // posts will still show that, until they are converted. As a reminder, wpautop is not being used
                    // on the overall post content anymore, neither on the Wordpress side nor on the grapher side (through
                    // the wpautop npm package), but its effects are still "present" after the result of wpautop were committed
                    // to the DB during a one-time refactoring session.
                    // <p><iframe></iframe></p>  -->  <p></p><figure></figure>
                    const $p = $el.parent()
                    $p.after(output)
                    $el.remove()
                } else if (el.parent.tagName === "figure") {
                    // Support for <iframe> wrapped in <figure>
                    // <figure> automatically added by Gutenberg on copy / paste <iframe>
                    // Lifting up <iframe> out of <figure>, before it becomes a <figure> itself.
                    // <figure><iframe></iframe></figure>  -->  <figure></figure>
                    const $figure = $el.parent()
                    $figure.after(output)
                    $figure.remove()
                } else {
                    // No lifting up otherwise, just replacing <iframe> with <figure>
                    // <iframe></iframe>  -->  <figure></figure>
                    $el.after(output)
                    $el.remove()
                }
            }
        }
    }

    // Any remaining iframes
    for (const iframe of $("iframe").toArray()) {
        // Ensure https embeds
        if (HTTPS_ONLY && iframe.attribs["src"]) {
            iframe.attribs["src"] = iframe.attribs["src"].replace(
                "http://",
                "https://"
            )
        }
        // Lazy load unless "loading" attribute already specified
        if (!iframe.attribs["loading"]) {
            iframe.attribs["loading"] = "lazy"
        }
    }

    // Remove any empty elements
    for (const p of $("p").toArray()) {
        const $p = $(p)
        if ($p.contents().length === 0) $p.remove()
    }

    // Wrap tables so we can do overflow-x: scroll if needed
    for (const table of $("table").toArray()) {
        const $table = $(table)
        const $div = $("<div class='tableContainer'></div>")
        $table.after($div)
        $div.append($table)
    }

    // Make sticky-right layout the default for columns
    $(".wp-block-columns").each((_, columns) => {
        const $columns = $(columns)
        if (columns.attribs.class === "wp-block-columns") {
            $columns.addClass("is-style-sticky-right")
        }
    })

    // Image processing
    // Assumptions:
    // - original images are not uploaded with a suffix "-[number]x[number]"
    //   (without the quotes).
    // - variants are being generated by wordpress when the original is uploaded
    // - images are never legitimate direct descendants of <a> tags.
    //   <a><img /></a> is considered deprecated (was used to create direct links to
    //   the full resolution variant) and wrapping <a> will be removed to prevent
    //   conflicts with lightboxes. Chosen over preventDefault() in front-end code
    //   to avoid clicks before javascript executes.
    for (const el of $("img").toArray()) {
        // Recreate source image path by removing automatically added image
        // dimensions (e.g. remove 800x600).
        const src = el.attribs["src"]
        const parsedPath = path.parse(src)
        let originalFilename = ""
        if (parsedPath.ext !== ".svg") {
            originalFilename = parsedPath.name.replace(/-\d+x\d+$/, "")
            const originalSrc = path.format({
                dir: parsedPath.dir,
                name: originalFilename,
                ext: parsedPath.ext
            })
            el.attribs["data-high-res-src"] = originalSrc
        } else {
            originalFilename = parsedPath.name
        }

        // Remove wrapping <a> tag, conflicting with lightbox (cf. assumptions above)
        if (el.parent.tagName === "a") {
            const $a = $(el.parent)
            $a.replaceWith($(el))
        }

        // Add alt attribute
        if (!el.attribs["alt"]) {
            el.attribs["alt"] = _.capitalize(
                originalFilename.replace(/[-_]/g, " ")
            )
        }

        // Lazy load all images, unless they already have a "loading" attribute.
        if (!el.attribs["loading"]) {
            el.attribs["loading"] = "lazy"
        }
    }

    // Table of contents and deep links

    const tocHeadings: TocHeading[] = []
    const existingSlugs: string[] = []
    let parentHeading: TocHeading | null = null

    $("h1, h2, h3, h4").each((_, el) => {
        const $heading = $(el)
        const headingText = $heading.text()

        let slug = urlSlug(headingText)

        // Avoid If the slug already exists, try prepend the parent
        if (existingSlugs.indexOf(slug) !== -1 && parentHeading) {
            slug = `${parentHeading.slug}-${slug}`
        }

        existingSlugs.push(slug)

        // Table of contents
        if (formattingOptions.toc) {
            if ($heading.is("#footnotes") && footnotes.length > 0) {
                tocHeadings.push({
                    text: headingText,
                    slug: "footnotes",
                    isSubheading: false
                })
            } else if (!$heading.is("h1") && !$heading.is("h4")) {
                if ($heading.is("h2")) {
                    const tocHeading = {
                        text: headingText,
                        slug: slug,
                        isSubheading: false
                    }
                    tocHeadings.push(tocHeading)
                    parentHeading = tocHeading
                } else if (
                    $heading.closest(".wp-block-owid-prominent-link").length ===
                        0 &&
                    $heading.closest(".wp-block-owid-additional-information")
                        .length === 0
                ) {
                    tocHeadings.push({
                        text: headingText,
                        html: $heading.html() || undefined,
                        slug: slug,
                        isSubheading: true
                    })
                }
            }
        }

        $heading.attr("id", slug)
        // Add deep link for headings not contained in <a> tags already
        // (e.g. within a prominent link block)
        if (
            !$heading.closest(".wp-block-owid-prominent-link").length && // already wrapped in <a>
            !$heading.closest(".wp-block-owid-additional-information").length && // prioritize clean SSR of AdditionalInformation
            !$heading.closest(".wp-block-help").length
        ) {
            $heading.prepend(`<a class="deep-link" href="#${slug}"></a>`)
        }
    })

    interface Columns {
        wrapper: Cheerio
        first: Cheerio
        last: Cheerio
    }

    const getColumns = (style: string = "sticky-right"): Columns => {
        const emptyColumns = `<div class="wp-block-columns is-style-${style}"><div class="wp-block-column"></div><div class="wp-block-column"></div></div>`
        const $columns = $(emptyColumns)
        return {
            wrapper: $columns,
            first: $columns.children().first(),
            last: $columns.children().last()
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
    const sectionStarts = [
        $("body")
            .children()
            .get(0)
    ].concat($("body > h2").toArray())
    for (const start of sectionStarts) {
        const $start = $(start)
        const $section = $("<section>")
        let columns = getColumns()
        let sideBySideColumns = getColumns("side-by-side")
        const $tempWrapper = $("<div>")
        const $contents = $tempWrapper
            .append($start.clone(), $start.nextUntil($("h2")))
            .contents()

        $contents.each((i, el) => {
            const $el = $(el)
            // Leave h2 at the section level, do not move into columns
            if (el.name === "h2") {
                $section.append(
                    ReactDOMServer.renderToStaticMarkup(
                        <SectionHeading
                            title={$el.text()}
                            tocHeadings={tocHeadings}
                        >
                            <div
                                dangerouslySetInnerHTML={{
                                    __html: $.html($el)
                                }}
                            />
                        </SectionHeading>
                    )
                )
            } else if (
                el.name === "h3" ||
                $el.hasClass("wp-block-columns") ||
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
                        !$el.hasClass("wp-block-owid-prominent-link") &&
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

    // Render global country selection component.
    // Injects a <section>, which is why it executes last.
    bakeGlobalEntityControl($)

    return {
        id: post.id,
        postId: post.postId,
        type: post.type,
        slug: post.slug,
        path: post.path,
        title: post.title,
        subtitle: pageSubtitle,
        date: post.date,
        modifiedDate: post.modifiedDate,
        lastUpdated: lastUpdated,
        authors: post.authors,
        info: info,
        html: $.html(),
        footnotes: footnotes,
        references: references,
        excerpt:
            post.excerpt ||
            $("p")
                .first()
                .text(),
        imageUrl: post.imageUrl,
        tocHeadings: tocHeadings,
        relatedCharts: post.relatedCharts
    }
}

export interface FormattingOptions {
    toc?: boolean
    hideAuthors?: boolean
    bodyClassName?: string
    subnavId?: string
    subnavCurrentId?: string
    raw?: boolean
    hideDonateFooter?: boolean
    [key: string]: string | boolean | undefined
}

export function extractFormattingOptions(html: string): FormattingOptions {
    const formattingOptionsMatch = html.match(
        /<!--\s*formatting-options\s+(.*)\s*-->/
    )
    if (formattingOptionsMatch) {
        return parseFormattingOptions(formattingOptionsMatch[1])
    } else {
        return {}
    }
}

// Converts "toc:false raw somekey:somevalue" to { toc: false, raw: true, somekey: "somevalue" }
// If only the key is specified, the value is assumed to be true (e.g. "raw" above)
function parseFormattingOptions(text: string): FormattingOptions {
    const options: { [key: string]: string | boolean } = {}
    text.split(/\s+/)
        // filter out empty strings
        .filter(s => s && s.length > 0)
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

export async function formatPost(
    post: FullPost,
    formattingOptions: FormattingOptions,
    grapherExports?: GrapherExports
): Promise<FormattedPost> {
    let html = post.content

    // Standardize urls
    html = html
        .replace(new RegExp(WORDPRESS_URL, "g"), BAKED_BASE_URL)
        .replace(new RegExp("https?://owid.cloud", "g"), BAKED_BASE_URL)
        .replace(new RegExp("https?://ourworldindata.org", "g"), BAKED_BASE_URL)

    // No formatting applied, plain source HTML returned
    if (formattingOptions.raw) {
        return {
            id: post.id,
            postId: post.postId,
            type: post.type,
            slug: post.slug,
            path: post.path,
            title: post.title,
            date: post.date,
            modifiedDate: post.modifiedDate,
            authors: post.authors,
            html: html,
            footnotes: [],
            references: [],
            excerpt: post.excerpt || "",
            imageUrl: post.imageUrl,
            tocHeadings: [],
            relatedCharts: post.relatedCharts
        }
    } else {
        // Override formattingOptions if specified in the post (as an HTML comment)
        const options: FormattingOptions = Object.assign(
            {
                toc: post.type === "page",
                footnotes: true
            },
            formattingOptions
        )
        return formatWordpressPost(post, html, options, grapherExports)
    }
}

export function formatAuthors(authors: string[], requireMax?: boolean): string {
    if (requireMax && authors.indexOf("Max Roser") === -1)
        authors.push("Max Roser")

    let authorsText = authors.slice(0, -1).join(", ")
    if (authorsText.length === 0) authorsText = authors[0]
    else authorsText += ` and ${_.last(authors)}`

    return authorsText
}

export function formatDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "2-digit"
    })
}
