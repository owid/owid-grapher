import * as cheerio from "cheerio"
import urlSlug from "url-slug"
import React from "react"
import ReactDOMServer from "react-dom/server.js"
import { BAKED_BASE_URL, HTTPS_ONLY } from "../settings/serverSettings.js"
import { getTables } from "../db/wpdb.js"
import Tablepress from "../site/Tablepress.js"
import { GrapherExports } from "../baker/GrapherBakingUtils.js"
import { AllCharts, renderAllCharts } from "../site/blocks/AllCharts.js"
import {
    BLOCK_WRAPPER_DATATYPE,
    DataValueProps,
    FormattedPost,
    FormattingOptions,
    FullPost,
    JsonError,
    TocHeading,
    WP_BlockType,
} from "@ourworldindata/utils"
import { Footnote } from "../site/Footnote.js"
import { LoadingIndicator } from "@ourworldindata/grapher"
import { PROMINENT_LINK_CLASSNAME } from "../site/blocks/ProminentLink.js"
import { countryProfileSpecs } from "../site/countryProfileProjects.js"
import { DataToken } from "../site/DataToken.js"
import {
    dataValueRegex,
    DEEP_LINK_CLASS,
    extractDataValuesConfiguration,
    formatDataValue,
    formatImages,
    parseKeyValueArgs,
} from "./formatting.js"
import { mathjax } from "mathjax-full/js/mathjax.js"
import { TeX } from "mathjax-full/js/input/tex.js"
import { SVG } from "mathjax-full/js/output/svg.js"
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js"
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js"
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js"
import { replaceIframesWithExplorerRedirectsInWordPressPost } from "./replaceExplorerRedirects.js"
import { EXPLORERS_ROUTE_FOLDER } from "../explorer/ExplorerConstants.js"
import {
    getDataValue,
    getOwidChartDimensionConfigForVariable,
    getOwidVariableDisplayConfig,
} from "../db/model/Variable.js"
import { AnnotatingDataValue } from "../site/AnnotatingDataValue.js"
import {
    ADDITIONAL_INFORMATION_CLASS_NAME,
    renderAdditionalInformation,
} from "../site/blocks/AdditionalInformation.js"
import { renderHelp } from "../site/blocks/Help.js"
import { renderCodeSnippets } from "../site/blocks/CodeSnippet.js"
import { renderExpandableParagraphs } from "../site/blocks/ExpandableParagraph.js"
import {
    formatUrls,
    getBodyHtml,
    GRAPHER_PREVIEW_CLASS,
    SUMMARY_CLASSNAME,
} from "../site/formatting.js"
import { renderKeyInsights, renderProminentLinks } from "./siteRenderers.js"
import { logContentErrorAndMaybeSendToSlack } from "../serverUtils/slackLog.js"
import { KEY_INSIGHTS_CLASS_NAME } from "../site/blocks/KeyInsights.js"
import { RELATED_CHARTS_CLASS_NAME } from "../site/blocks/RelatedCharts.js"

const initMathJax = () => {
    const adaptor = liteAdaptor()
    RegisterHTMLHandler(adaptor)

    const tex = new TeX({ packages: AllPackages })
    const svg = new SVG({ fontCache: "none" })
    const doc = mathjax.document("", {
        InputJax: tex,
        OutputJax: svg,
    })

    return function format(latex: string): string {
        const node = doc.convert(latex, {
            display: true,
        })
        return adaptor.outerHTML(node) // as HTML
    }
}

const formatMathJax = initMathJax()

// A modifed FontAwesome icon
const INTERACTIVE_ICON_SVG = `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="hand-pointer" class="svg-inline--fa fa-hand-pointer fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 617">
    <path fill="currentColor" d="M448,344.59v96a40.36,40.36,0,0,1-1.06,9.16l-32,136A40,40,0,0,1,376,616.59H168a40,40,0,0,1-32.35-16.47l-128-176a40,40,0,0,1,64.7-47.06L104,420.58v-276a40,40,0,0,1,80,0v200h8v-40a40,40,0,1,1,80,0v40h8v-24a40,40,0,1,1,80,0v24h8a40,40,0,1,1,80,0Zm-256,80h-8v96h8Zm88,0h-8v96h8Zm88,0h-8v96h8Z" transform="translate(0 -0.41)"/>
    <path fill="currentColor" opacity="0.6" d="M239.76,234.78A27.5,27.5,0,0,1,217,192a87.76,87.76,0,1,0-145.9,0A27.5,27.5,0,1,1,25.37,222.6,142.17,142.17,0,0,1,1.24,143.17C1.24,64.45,65.28.41,144,.41s142.76,64,142.76,142.76a142.17,142.17,0,0,1-24.13,79.43A27.47,27.47,0,0,1,239.76,234.78Z" transform="translate(0 -0.41)"/>
</svg>`

const extractLatex = (html: string): [string, string[]] => {
    const latexBlocks: string[] = []
    html = html.replace(/\[latex\]([\s\S]*?)\[\/latex\]/gm, (_, latex) => {
        latexBlocks.push(
            latex.replace("\\[", "").replace("\\]", "").replace(/\$\$/g, "")
        )
        return "[latex]"
    })
    return [html, latexBlocks]
}

const formatLatex = async (
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

export const formatWordpressPost = async (
    post: FullPost,
    formattingOptions: FormattingOptions,
    grapherExports?: GrapherExports
): Promise<FormattedPost> => {
    let html = post.content

    // Inject key insights early so they can be formatted by the embedding
    // article. Another option would be to format the content independently,
    // which would allow for inclusion further down the formatting pipeline.
    // This is however creating issues by running non-idempotent formatting
    // functions twice on the same content (e.g. table processing double wraps
    // in "tableContainer" divs). On the other hand, rendering key insights last
    // would require special care for footnotes.
    html = await renderKeyInsights(html, post.id)

    // Standardize urls
    html = formatUrls(html)

    // Strip comments
    html = html.replace(/<!--[^>]+-->/g, "")

    // Need to skirt around wordpress formatting to get proper latex rendering
    let latexBlocks
    ;[html, latexBlocks] = extractLatex(html)

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

    const dataValuesConfigurationsMap = await extractDataValuesConfiguration(
        html
    )
    const dataValues = new Map<string, DataValueProps>()
    for (const [
        dataValueConfigurationString,
        dataValueConfiguration,
    ] of dataValuesConfigurationsMap) {
        const { queryArgs, template } = dataValueConfiguration
        const { variableId, chartId } = queryArgs
        const { value, year, unit, entityName } =
            (await getDataValue(queryArgs)) || {}

        if (!value || !year || !entityName || !template) continue

        let formattedValue
        if (variableId && chartId) {
            const legacyVariableDisplayConfig =
                await getOwidVariableDisplayConfig(variableId)
            const legacyChartDimension =
                await getOwidChartDimensionConfigForVariable(
                    variableId,
                    chartId
                )
            formattedValue = formatDataValue(
                value,
                variableId,
                legacyVariableDisplayConfig,
                legacyChartDimension
            )
        }

        dataValues.set(dataValueConfigurationString, {
            value,
            formattedValue,
            template,
            year,
            unit,
            entityName,
        })
    }

    html = html.replace(dataValueRegex, (_, dataValueConfigurationString) => {
        const dataValueProps: DataValueProps | undefined = dataValues.get(
            dataValueConfigurationString
        )
        if (!dataValueProps) {
            logContentErrorAndMaybeSendToSlack(
                new JsonError(
                    `Missing data value for {{DataValue ${dataValueConfigurationString}}}" in ${BAKED_BASE_URL}/${post.slug}`
                )
            )
            return "{ ⚠️ Value pending update }"
        }
        return ReactDOMServer.renderToString(
            <span data-type={BLOCK_WRAPPER_DATATYPE}>
                <AnnotatingDataValue dataValueProps={dataValueProps} />
            </span>
        )
    })

    // Needs to be happen after DataValue replacements, as the DataToken regex
    // would otherwise capture DataValue tags
    const dataTokenRegex = /{{\s*([a-zA-Z]+)\s*(.+?)\s*}}/g

    html = html.replace(
        dataTokenRegex,
        (_, token, dataTokenConfigurationString) => {
            return ReactDOMServer.renderToString(
                <DataToken
                    token={token}
                    {...parseKeyValueArgs(dataTokenConfigurationString)}
                />
            )
        }
    )

    // Insert [table id=foo] tablepress tables
    const tables = await getTables()
    html = html.replace(/\[table\s+id=(\d+)\s*\/\]/g, (match, tableId) => {
        const table = tables.get(tableId)
        if (table)
            return ReactDOMServer.renderToStaticMarkup(
                <Tablepress data={table.data} />
            )
        return "UNKNOWN TABLE"
    })

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
    if (
        !countryProfileSpecs.some(
            (spec) => post.slug === spec.landingPageSlug
        ) &&
        post.relatedCharts?.length &&
        // Render fallback "All charts" block at the top of entries only if
        // manual "All charts" block not present in the rest of the document.
        // This is to help transitioning towards topic pages, where this block
        // is manually added in the content. In that case, we don't want to
        // inject it at the top too.
        !cheerioEl(`block[type='${WP_BlockType.AllCharts}']`).length
    ) {
        // Mimicking SSR output of additional information block from PHP
        const allCharts = `
        <block type="additional-information" default-open="false">
            <content>
            ${ReactDOMServer.renderToStaticMarkup(<AllCharts post={post} />)}
            </content>
        </block>
        `
        const $summary = cheerioEl(`.${SUMMARY_CLASSNAME}`)
        if ($summary.length !== 0) {
            $summary.after(allCharts)
        } else {
            cheerioEl("body > h2:first-of-type, body > h3:first-of-type")
                .first()
                .before(allCharts)
        }
    }

    // SSR rendering of Gutenberg blocks, before hydration on client
    //
    // - Note: any post-processing on these blocks runs the risk of hydration
    //   discrepancies. E.g. the ToC post-processing further below add an "id"
    //   attribute to elibigle heading tags. In an unbridled version of that
    //   script, the AdditionalInformation block title (h3) would be altered and
    //   receive an "id" attribute (<h3 id="some-title">). When this block is
    //   then hydrated on the client, the "id" attribute is missing, since it
    //   wasn't generated by the isomorphic React component code (but rather
    //   added by the external ToC post-processing code). So from React's
    //   perspective, the server rendered version is different from the client
    //   one, hence the discrepancy.
    renderAdditionalInformation(cheerioEl)
    renderExpandableParagraphs(cheerioEl)
    renderCodeSnippets(cheerioEl)
    renderHelp(cheerioEl)
    renderAllCharts(cheerioEl, post)
    await renderProminentLinks(cheerioEl, post.id)

    // Extract inline styling
    let style
    const $style = cheerioEl("style")
    if ($style.length) {
        style = $style
            .toArray()
            .map((el) => cheerioEl(el).html() || "")
            .reduce((prev, curr) => prev + curr)
        $style.remove()
    }

    // Extract blog info content
    let info
    const $info = cheerioEl(".blog-info")
    if ($info.length) {
        info = $info.html() ?? undefined
        $info.remove()
    }

    // Extract last updated
    let lastUpdated
    const $lastUpdated = cheerioEl(".wp-block-last-updated")
    if ($lastUpdated.length) {
        lastUpdated = $lastUpdated.find("p").first().html() ?? undefined
        $lastUpdated.remove()
    }

    // Extract page supertitle
    let supertitle
    const $supertitle = cheerioEl(".wp-block-owid-supertitle")
    if ($supertitle.length) {
        supertitle = $supertitle.text()
        $supertitle.remove()
    }

    // Extract page byline
    let byline
    const $byline = cheerioEl(".wp-block-owid-byline")
    if ($byline.length) {
        byline = $byline.html() ?? undefined
        $byline.remove()
    }

    // Replace URLs pointing to Explorer redirect URLs with the destination URLs
    replaceIframesWithExplorerRedirectsInWordPressPost(cheerioEl)

    // Replace grapher iframes with static previews
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
            (el.attribs["src"] || "").includes(`/${EXPLORERS_ROUTE_FOLDER}/`)
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

    // Due to CSS Grid, we need to nest a container _inside_ the sticky column
    // then put the children of that column inside the container
    function nestStickyContainer(
        $columns: Cheerio,
        side: "left" | "right" = "right"
    ) {
        const parent =
            side === "left"
                ? $columns.children().first()
                : $columns.children().last()
        const container = cheerioEl(`<div class="wp-sticky-container"></div>`)
        container.append(parent.children())
        parent.append(container)
    }

    // Nesting for sticky columns that have been manually created
    ;(["left", "right"] as const).forEach((side) => {
        cheerioEl(`.wp-block-columns.is-style-sticky-${side}`).each(
            (_, columns) => {
                // don't nest the columns when inside related-charts
                const parentClassName = columns.parent.attribs.class
                if (parentClassName === RELATED_CHARTS_CLASS_NAME) {
                    return
                }
                nestStickyContainer(cheerioEl(columns), side)
            }
        )
    })

    // Make sticky-right layout the default for columns
    cheerioEl(".wp-block-columns").each((_, columns) => {
        const $columns = cheerioEl(columns)
        if (columns.attribs.class === "wp-block-columns") {
            $columns.addClass("is-style-sticky-right")
            nestStickyContainer($columns)
        }
    })

    formatImages(cheerioEl)

    // Table of contents and deep links
    const tocHeadings: TocHeading[] = []
    const existingSlugs: string[] = []
    let parentSlug: string | null = null

    cheerioEl("h1, h2, h3, h4").each((_, el) => {
        const $heading = cheerioEl(el)
        const headingText = $heading.text()

        let slug = $heading.attr("id") ?? urlSlug(headingText)

        if (existingSlugs.indexOf(slug) !== -1 && parentSlug) {
            slug = `${parentSlug}-${slug}`
        }

        existingSlugs.push(slug)
        if ($heading.is("h2")) parentSlug = slug

        // Table of contents
        if (formattingOptions.toc) {
            if ($heading.is("#footnotes") && footnotes.length > 0) {
                tocHeadings.push({
                    text: headingText,
                    slug: "footnotes",
                    isSubheading: false,
                })
            } else if ($heading.is("h2")) {
                const tocHeading = {
                    text: headingText,
                    slug: slug,
                    isSubheading: false,
                }
                tocHeadings.push(tocHeading)
            } else if (
                $heading.is("h3") &&
                $heading.closest(`.${PROMINENT_LINK_CLASSNAME}`).length === 0 &&
                $heading.closest(`.${ADDITIONAL_INFORMATION_CLASS_NAME}`)
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

        if (
            $heading.closest(`.${PROMINENT_LINK_CLASSNAME}`).length || // already wrapped in <a>
            $heading.closest(`.${ADDITIONAL_INFORMATION_CLASS_NAME}`).length || // prioritize clean SSR of AdditionalInformation
            $heading.closest(".wp-block-help").length
        )
            return

        $heading.attr("id", slug)

        if ($heading.closest(`.${KEY_INSIGHTS_CLASS_NAME}`).length) return

        $heading.append(`<a class="${DEEP_LINK_CLASS}" href="#${slug}"></a>`)
    })

    // Extracting the useful information from the HTML
    const stickyNavLinks: { text: string; target: string }[] = []
    const $stickyNavContents = cheerioEl(".sticky-nav-contents")
    const $stickyNavLinks = $stickyNavContents.children().children()
    $stickyNavLinks.each((_, element) => {
        const $elem = cheerioEl(element)
        const text = $elem.text()
        const target = $elem.attr("href")
        if (text && target) stickyNavLinks.push({ text, target })
    })
    $stickyNavContents.remove()

    return {
        ...post,
        supertitle,
        stickyNavLinks,
        lastUpdated,
        byline,
        info,
        style,
        footnotes: footnotes,
        tocHeadings: tocHeadings,
        pageDesc: post.excerpt || cheerioEl("p").first().text(),
        html: getBodyHtml(cheerioEl),
    }
}

export const formatPost = async (
    post: FullPost,
    formattingOptions: FormattingOptions,
    grapherExports?: GrapherExports
): Promise<FormattedPost> => {
    // No formatting applied, plain source HTML returned
    if (formattingOptions.raw)
        return {
            ...post,
            html: formatUrls(post.content),
            footnotes: [],
            tocHeadings: [],
            pageDesc: post.excerpt || "",
        }

    // Override formattingOptions if specified in the post (as an HTML comment)
    const options: FormattingOptions = {
        toc: post.type === "page",
        footnotes: true,
        ...formattingOptions,
    }

    return formatWordpressPost(post, options, grapherExports)
}
