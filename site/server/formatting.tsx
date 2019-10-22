import * as cheerio from 'cheerio'
const urlSlug = require('url-slug')
const wpautop = require('wpautop')
import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import { HTTPS_ONLY } from 'serverSettings'
import { BAKED_BASE_URL, WORDPRESS_URL } from 'settings'
import { getTables, FullPost } from 'db/wpdb'
import Tablepress from './views/Tablepress'
import {GrapherExports} from './grapherUtil'
import * as path from 'path'
import { htmlToPlaintext } from 'utils/string'

const mjAPI = require("mathjax-node")

// A modifed FontAwesome icon
const INTERACTIVE_ICON_SVG = `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="hand-pointer" class="svg-inline--fa fa-hand-pointer fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 617">
    <path fill="currentColor" d="M448,344.59v96a40.36,40.36,0,0,1-1.06,9.16l-32,136A40,40,0,0,1,376,616.59H168a40,40,0,0,1-32.35-16.47l-128-176a40,40,0,0,1,64.7-47.06L104,420.58v-276a40,40,0,0,1,80,0v200h8v-40a40,40,0,1,1,80,0v40h8v-24a40,40,0,1,1,80,0v24h8a40,40,0,1,1,80,0Zm-256,80h-8v96h8Zm88,0h-8v96h8Zm88,0h-8v96h8Z" transform="translate(0 -0.41)"/>
    <path fill="currentColor" opacity="0.6" d="M239.76,234.78A27.5,27.5,0,0,1,217,192a87.76,87.76,0,1,0-145.9,0A27.5,27.5,0,1,1,25.37,222.6,142.17,142.17,0,0,1,1.24,143.17C1.24,64.45,65.28.41,144,.41s142.76,64,142.76,142.76a142.17,142.17,0,0,1-24.13,79.43A27.47,27.47,0,0,1,239.76,234.78Z" transform="translate(0 -0.41)"/>
</svg>`

export interface Reference {

}

export interface FormattedPost {
    id: number
    type: 'post'|'page'
    slug: string
    path: string
    title: string
    date: Date
    modifiedDate: Date
    authors: string[]
    html: string
    footnotes: string[]
    references: Reference[]
    excerpt: string
    imageUrl?: string
    acknowledgements?: string
    tocHeadings: { text: string, slug: string, isSubheading: boolean }[]
}

mjAPI.config({
    MathJax: {
      // traditional MathJax configuration
    }
})
mjAPI.start()

function extractLatex(html: string): [string, string[]] {
    const latexBlocks: string[] = []
    html = html.replace(/\[latex\]([\s\S]*?)\[\/latex\]/gm, (_, latex) => {
        latexBlocks.push(latex.replace("\\[", "").replace("\\]", "").replace(/\$\$/g, ""))
        return "[latex]"
    })
    return [html, latexBlocks]
}

async function formatLatex(html: string, latexBlocks?: string[]): Promise<string> {
    if (!latexBlocks)
        [html, latexBlocks] = extractLatex(html)

    const compiled: string[] = []
    for (const latex of latexBlocks) {
        try {
            const result = await mjAPI.typeset({
                useFontCache: false,
                useGlobalCache: false,
                math: latex,
                format: "TeX",
                svg: true
            })
            compiled.push(result.svg.replace("<svg", `<svg class="latex"`))
        } catch (err) {
            compiled.push(`${latex} (Could not format equation due to MathJax error)`)
        }
    }

    let i = -1
    return html.replace(/\[latex\]/g, () => {
        i += 1
        return compiled[i]
    })
}

export async function formatWordpressPost(post: FullPost, html: string, formattingOptions: FormattingOptions, grapherExports?: GrapherExports): Promise<FormattedPost> {
    // Strip comments
    html = html.replace(/<!--[^>]+-->/g, "")

    // Standardize spacing
    html = html.replace(/\r\n/g, "\n").replace(/\n+/g, "\n").replace(/\n/g, "\n\n")

    // Need to skirt around wordpress formatting to get proper latex rendering
    let latexBlocks
    [html, latexBlocks] = extractLatex(html)

    // Extract acknowledgements
    let acknowledgements: string|undefined
    html = html.replace(/\[acknowledgements\]([\s\S]*?)\[\/acknowledgements\]/gm, (_, ack) => {
        acknowledgements = wpautop(ack)
        return ``
    })

    const references: Reference[] = []
    html = html.replace(/\[cite\]([\s\S]*?)\[\/cite\]/gm, (_, bibtex) => {
        references.push({}) // Todo
        return ``
    })

    // Replicate wordpress formatting (thank gods there's an npm package)
    if (formattingOptions.wpFormat) {
        html = wpautop(html)
    }

    html = await formatLatex(html, latexBlocks)

    // Footnotes
    const footnotes: string[] = []
    html = html.replace(/\[ref\]([\s\S]*?)\[\/ref\]/gm, (_, footnote) => {
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
            return ReactDOMServer.renderToStaticMarkup(<Tablepress data={table.data}/>)
        else
            return "UNKNOWN TABLE"
    })

    // No need for wordpress urls
    html = html.replace(new RegExp("/app/uploads", 'g'), "/uploads")

    const $ = cheerio.load(html)

    // Replace grapher iframes with static previews
    if (grapherExports) {
        const grapherIframes = $("iframe").toArray().filter(el => (el.attribs['src']||'').match(/\/grapher\//))
        for (const el of grapherIframes) {
            const src = el.attribs['src']
            const chart = grapherExports.get(src)
            if (chart) {
                const output = `<figure data-grapher-src="${src}" class="grapherPreview">
                    <a href="${src}" target="_blank">
                        <div><img src="${chart.svgUrl}" width="${chart.width}" height="${chart.height}" /></div>
                        <div class="interactionNotice">
                            <span class="icon">${INTERACTIVE_ICON_SVG}</span>
                            <span class="label">Click to open interactive version</span>
                        </div>
                    </a>
                </div>`
                const $p = $(el).closest('p')
                $(el).remove()
                $p.after(output)
            }
        }
    }

    // Any remaining iframes: ensure https embeds
    if (HTTPS_ONLY) {
        for (const iframe of $("iframe").toArray()) {
            iframe.attribs['src'] = iframe.attribs['src'].replace("http://", "https://")
        }
    }

    // Remove any empty elements
    for (const p of $("p").toArray()) {
        const $p = $(p)
        if ($p.contents().length === 0)
            $p.remove()
    }

    // Wrap tables so we can do overflow-x: scroll if needed
    for (const table of $("table").toArray()) {
        const $table = $(table)
        const $div = $("<div class='tableContainer'></div>")
        $table.after($div)
        $div.append($table)
    }

    // Image processing
    // Assumptions:
    // - original images are not uploaded with a suffix "-[number]x[number]"
    //   (without the quotes).
    // - variants are being generated by wordpress when the original is uploaded
    for (const el of $("img")
            .not((i, img) => $(img).attr('src').split('.').pop() === 'svg')
            .toArray()) {
        const $el = $(el)

        // Recreate source image path by removing automatically added image
        // dimensions (e.g. remove 800x600).
        const src = el.attribs['src']
        const parsedPath = path.parse(src)
        const originalFilename = parsedPath.name.replace(/-\d+x\d+$/, '')
        const originalSrc = path.format({dir: parsedPath.dir, name: originalFilename, ext: parsedPath.ext})

        // Open full-size image in new tab
        if (el.parent.tagName === "a") {
            el.parent.attribs['target'] = '_blank'
        } else {
            const $a = $(`<a href="${originalSrc}" target="_blank"></a>`)
            $el.replaceWith($a)
            $a.append($el)
        }

        // Add alt tag
        if (!el.attribs['alt']) {
            el.attribs['alt'] = _.capitalize(originalFilename.replace(/[-_]/g, ' '))
        }
    }

    // Table of contents and deep links

    interface TocHeading {
        text: string,
        slug: string,
        isSubheading: boolean
    }

    const tocHeadings: TocHeading[] = []
    const existingSlugs: string[] = []
    let parentHeading: TocHeading | null = null

    $("h1, h2, h3, h4").each((_, el) => {
        const $heading = $(el)
        const headingText = $heading.text()
        // We need both the text and the html because may contain footnote
        // let headingHtml = $heading.html() as string
        let slug = urlSlug(headingText)

        // Avoid If the slug already exists, try prepend the parent
        if (existingSlugs.indexOf(slug) !== -1 && parentHeading) {
            slug = `${parentHeading.slug}-${slug}`
        }

        existingSlugs.push(slug)

        // Table of contents
        if (formattingOptions.toc) {
            if ($heading.is("#footnotes") && footnotes.length > 0) {
                tocHeadings.push({ text: headingText, slug: "footnotes", isSubheading: false })
            } else if (!$heading.is('h1') && !$heading.is('h4')) {
                if ($heading.is('h2')) {
                    const tocHeading = { text: $heading.text(), slug: slug, isSubheading: false }
                    tocHeadings.push(tocHeading)
                    parentHeading = tocHeading
                } else {
                    tocHeadings.push({ text: $heading.text(), slug: slug, isSubheading: true })
                }
            }
        }

        // Deep link
        $heading.attr('id', slug).prepend(`<a class="deep-link" href="#${slug}"></a>`)
    })

    // Wrap content demarcated by headings into section blocks
    const sectionStarts = [$("body").children().get(0)].concat($("h2").toArray())
    const emptyColumns = "<div class=\"has-2-columns is-style-sticky-right\"><div class=\"wp-block-column\"></div><div class=\"wp-block-column\"></div></div>"
    for (const start of sectionStarts) {
        let $columns = $(emptyColumns)
        const $start = $(start)
        const $section = $("<section>")
        const $tempWrapper = $("<div>")
        const $contents = $tempWrapper.append($start.clone(), $start.nextUntil("h2")).contents()

        $contents.each(function(this: CheerioElement, i) {
            if(this.name === 'h2') {
                $section.append($(this))
            } else if(this.name === 'h3') {
                $section.append($columns, $(this))
                $columns = $(emptyColumns)
            } else {
                if(this.name === 'figure') {
                    $columns.children().last().append($(this))
                } else {
                    $columns.children().first().append($(this))
                }
            }
        })
        $section.append($columns)
        $start.replaceWith($section)
    }

    return {
        id: post.id,
        type: post.type,
        slug: post.slug,
        path: post.path,
        title: post.title,
        date: post.date,
        modifiedDate: post.modifiedDate,
        authors: post.authors,
        html: $("body").html() as string,
        footnotes: footnotes,
        acknowledgements: acknowledgements,
        references: references,
        excerpt: post.excerpt || $("p").first().text(),
        imageUrl: post.imageUrl,
        tocHeadings: tocHeadings
    }
}

export interface FormattingOptions {
    toc?: boolean,
    hideAuthors?: boolean,
    wpFormat?: boolean,
    bodyClassName?: string,
    subnavId?: string,
    subnavCurrentId?: string,
    raw?: boolean,
    hideDonateFooter?: boolean,
    [key: string]: string | boolean | undefined
}

export function extractFormattingOptions(html: string): FormattingOptions {
    const formattingOptionsMatch = html.match(/<!--\s*formatting-options\s+(.*)\s*-->/)
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
        .filter((s) => s && s.length > 0)
        // populate options object
        .forEach((option: string) => {
            const [name, value] = option.split(":") as [string, string|undefined]
            let parsedValue
            if (value === undefined || value === "true") parsedValue = true
            else if (value === "false") parsedValue = false
            else parsedValue = value
            options[name] = parsedValue
        })
    return options
}

export async function formatPost(post: FullPost, formattingOptions: FormattingOptions, grapherExports?: GrapherExports): Promise<FormattedPost> {
    let html = post.content

    // Standardize urls
    html = html.replace(new RegExp(WORDPRESS_URL, 'g'), BAKED_BASE_URL)
        .replace(new RegExp("https?://ourworldindata.org", 'g'), BAKED_BASE_URL)

    // If <!--raw--> appears at the top of a post, it signals that the author
    // wants to bypass the formatting and just write plain HTML
    const isRaw = html.match(/<!--raw-->/) || formattingOptions.raw

    if (isRaw) {
        return {
            id: post.id,
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
            excerpt: post.excerpt||"",
            imageUrl: post.imageUrl,
            tocHeadings: []
        }
    } else {
        // Override formattingOptions if specified in the post (as an HTML comment)
        const options: FormattingOptions = Object.assign({
            toc: post.type === 'page',
            wpFormat: true,
            footnotes: true
        }, formattingOptions)
        return formatWordpressPost(post, html, options, grapherExports)
    }
}

export function formatAuthors(authors: string[], requireMax?: boolean): string {
    if (requireMax && authors.indexOf("Max Roser") === -1)
        authors.push("Max Roser")

    let authorsText = authors.slice(0, -1).join(", ")
    if (authorsText.length === 0)
        authorsText = authors[0]
    else
        authorsText += ` and ${_.last(authors)}`

    return authorsText
}

export function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' })
}
