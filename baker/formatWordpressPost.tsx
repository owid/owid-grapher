import { SectionHeading } from "site/SectionHeading"
import * as cheerio from "cheerio"
import urlSlug from "url-slug"
import * as lodash from "lodash"
import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import { HTTPS_ONLY } from "serverSettings"
import { getTables, FullPost } from "db/wpdb"
import Tablepress from "site/Tablepress"
import { GrapherExports } from "baker/GrapherBakingUtils"
import * as path from "path"
import { renderBlocks } from "site/blocks"
import { RelatedCharts } from "site/blocks/RelatedCharts/RelatedCharts"
import { FormattedPost, FormattingOptions } from "clientUtils/owidTypes"
import { bakeGlobalEntityControl } from "baker/bakeGlobalEntityControl"
import { Footnote } from "site/Footnote"
import { LoadingIndicator } from "grapher/loadingIndicator/LoadingIndicator"
import { PROMINENT_LINK_CLASSNAME } from "site/blocks/ProminentLink/ProminentLink"
import {
    replaceLegacyGrapherIframesWithExplorerRedirectsInWordPressPost,
    legacyCovidDashboardSlug,
} from "explorerAdmin/legacyCovidExplorerRedirects"
import { countryProfileSpecs } from "site/countryProfileProjects"
import { formatGlossaryTerms } from "site/formatGlossary"
import { getMutableGlossary, glossary } from "site/glossary"
import { DataToken } from "site/DataToken"
import {
    extractLatex,
    formatLatex,
    INTERACTIVE_ICON_SVG,
    DEEP_LINK_CLASS,
    getHtmlContentWithStyles,
} from "site/formatting"

export const formatWordpressPost = async (
    post: FullPost,
    html: string,
    formattingOptions: FormattingOptions,
    grapherExports?: GrapherExports
): Promise<FormattedPost> => {
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
            const href = `#note-${i}`

            return ReactDOMServer.renderToStaticMarkup(
                <a id={`ref-${i}`} className="ref" href={href}>
                    <Footnote index={i} />
                </a>
            )
        } else {
            return ""
        }
    })

    html = html.replace(/{{([A-Z_]+)}}/gm, (_, token) => {
        return ReactDOMServer.renderToString(<DataToken token={token} />)
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

    const cheerioEl = cheerio.load(html)

    // Related charts
    // Mimicking SSR output of additional information block from PHP
    if (
        !countryProfileSpecs.some(
            (spec) => post.slug === spec.landingPageSlug
        ) &&
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
        const $summary = cheerioEl(".wp-block-owid-summary")
        if ($summary.length !== 0) {
            $summary.after(allCharts)
        } else {
            cheerioEl("body > h2:first-of-type, body > h3:first-of-type")
                .first()
                .before(allCharts)
        }
    }

    // SSR rendering of Gutenberg blocks, before hydration on client
    renderBlocks(cheerioEl)

    // Extract blog info content
    let info = null
    const $info = cheerioEl(".blog-info")
    if ($info.length) {
        info = $info.html()
        $info.remove()
    }

    // Extract last updated
    let lastUpdated
    const $lastUpdated = cheerioEl(".wp-block-last-updated")
    if ($lastUpdated.length) {
        lastUpdated = $lastUpdated.html()
        $lastUpdated.remove()
    }

    // Extract page subtitle
    let pageSubtitle
    const $pageSubtitle = cheerioEl(".wp-block-page-subtitle")
    if ($pageSubtitle.length) {
        pageSubtitle = $pageSubtitle.text()
        $pageSubtitle.remove()
    }

    // Extract page byline
    let byline
    const $byline = cheerioEl(".wp-block-owid-byline")
    if ($byline.length) {
        byline = $byline.html()
        $byline.remove()
    }

    // Replace grapher iframes with explorer iframes. todo: remove this.
    replaceLegacyGrapherIframesWithExplorerRedirectsInWordPressPost(cheerioEl)

    // Replace grapher iframes with static previews
    const GRAPHER_PREVIEW_CLASS = "grapherPreview"
    if (grapherExports) {
        const grapherIframes = cheerioEl("iframe")
            .toArray()
            .filter((el) => (el.attribs["src"] || "").match(/\/grapher\//))
        for (const el of grapherIframes) {
            const $el = cheerioEl(el)
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

    // Replace explorer iframes with iframeless embed
    const explorerIframes = cheerioEl("iframe")
        .toArray()
        .filter((el) =>
            (el.attribs["src"] || "").includes(legacyCovidDashboardSlug)
        )
    for (const el of explorerIframes) {
        const $el = cheerioEl(el)
        const src = el.attribs["src"].trim()
        // set a default style if none exists on the existing iframe
        const style = el.attribs["style"] || "width: 100%; height: 600px;"
        const cssClass = el.attribs["class"]
        const $figure = cheerioEl(
            ReactDOMServer.renderToStaticMarkup(
                <figure data-explorer-src={src} className={cssClass}>
                    <LoadingIndicator />
                </figure>
            )
        )
        $figure.attr("style", style)
        $el.after($figure)
        $el.remove()
    }

    // Any remaining iframes
    for (const iframe of cheerioEl("iframe").toArray()) {
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
    for (const p of cheerioEl("p").toArray()) {
        const $p = cheerioEl(p)
        if ($p.contents().length === 0) $p.remove()
    }

    // Wrap tables so we can do overflow-x: scroll if needed
    for (const table of cheerioEl("table").toArray()) {
        const $table = cheerioEl(table)
        const $div = cheerioEl("<div class='tableContainer'></div>")
        $table.after($div)
        $div.append($table)
    }

    // Make sticky-right layout the default for columns
    cheerioEl(".wp-block-columns").each((_, columns) => {
        const $columns = cheerioEl(columns)
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
    for (const el of cheerioEl("img").toArray()) {
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
                ext: parsedPath.ext,
            })
            el.attribs["data-high-res-src"] = originalSrc
        } else {
            originalFilename = parsedPath.name
        }

        // Remove wrapping <a> tag, conflicting with lightbox (cf. assumptions above)
        if (el.parent.tagName === "a") {
            const $a = cheerioEl(el.parent)
            $a.replaceWith(cheerioEl(el))
        }

        // Add alt attribute
        if (!el.attribs["alt"]) {
            el.attribs["alt"] = lodash.capitalize(
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

    cheerioEl("h1, h2, h3, h4").each((_, el) => {
        const $heading = cheerioEl(el)
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
                    isSubheading: false,
                })
            } else if (!$heading.is("h1") && !$heading.is("h4")) {
                if ($heading.is("h2")) {
                    const tocHeading = {
                        text: headingText,
                        slug: slug,
                        isSubheading: false,
                    }
                    tocHeadings.push(tocHeading)
                    parentHeading = tocHeading
                } else if (
                    $heading.closest(`.${PROMINENT_LINK_CLASSNAME}`).length ===
                        0 &&
                    $heading.closest(".wp-block-owid-additional-information")
                        .length === 0
                ) {
                    tocHeadings.push({
                        text: headingText,
                        html: $heading.html() || undefined,
                        slug: slug,
                        isSubheading: true,
                    })
                }
            }
        }

        $heading.attr("id", slug)
        // Add deep link for headings not contained in <a> tags already
        // (e.g. within a prominent link block)
        if (
            !$heading.closest(`.${PROMINENT_LINK_CLASSNAME}`).length && // already wrapped in <a>
            !$heading.closest(".wp-block-owid-additional-information").length && // prioritize clean SSR of AdditionalInformation
            !$heading.closest(".wp-block-help").length
        ) {
            $heading.prepend(
                `<a class="${DEEP_LINK_CLASS}" href="#${slug}"></a>`
            )
        }
    })

    interface Columns {
        wrapper: Cheerio
        first: Cheerio
        last: Cheerio
    }

    const getColumns = (style: string = "sticky-right"): Columns => {
        const emptyColumns = `<div class="wp-block-columns is-style-${style}"><div class="wp-block-column"></div><div class="wp-block-column"></div></div>`
        const $columns = cheerioEl(emptyColumns)
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

        if (post.glossary) {
            formatGlossaryTerms(
                cheerioEl,
                $contents,
                getMutableGlossary(glossary)
            )
        }

        $contents.each((i, el) => {
            const $el = cheerioEl(el)
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
                                    __html: cheerioEl.html($el),
                                }}
                            />
                        </SectionHeading>
                    )
                )
            } else if (
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

    // Render global country selection component.
    // Injects a <section>, which is why it executes last.
    bakeGlobalEntityControl(cheerioEl)

    return {
        id: post.id,
        type: post.type,
        slug: post.slug,
        path: post.path,
        title: post.title,
        subtitle: pageSubtitle,
        date: post.date,
        modifiedDate: post.modifiedDate,
        lastUpdated: lastUpdated,
        authors: post.authors,
        byline: byline,
        info: info,
        html: getHtmlContentWithStyles(cheerioEl),
        footnotes: footnotes,
        references: references,
        excerpt: post.excerpt || cheerioEl("p").first().text(),
        imageUrl: post.imageUrl,
        tocHeadings: tocHeadings,
        relatedCharts: post.relatedCharts,
    }
}
