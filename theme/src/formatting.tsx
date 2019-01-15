import * as cheerio from 'cheerio'
const urlSlug = require('url-slug')
const wpautop = require('wpautop')
import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import {HTTPS_ONLY, WORDPRESS_URL, BAKED_URL}  from './settings'
import { getTables, getUploadedImages, FullPost } from './wpdb'
import Tablepress from './views/Tablepress'
import {GrapherExports} from './grapherUtil'
import * as path from 'path'

const mjAPI = require("mathjax-node");

export interface Reference {

}

export interface FormattedPost {
    id: number
    type: 'post'|'page'
    slug: string
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
});
mjAPI.start();

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
    for (let latex of latexBlocks) {
        try {
            const result = await mjAPI.typeset({ math: latex, format: "TeX", svg: true })
            compiled.push(result.svg.replace("<svg", `<svg class="latex"`))
        } catch (err) {
            compiled.push(`${latex} (parse error: ${err})`)
        }
    }

    let i = -1
    return html.replace(/\[latex\]/g, _ => {
        i += 1
        return compiled[i]
    })
}

export async function formatWordpressPost(post: FullPost, html: string, formattingOptions: FormattingOptions, grapherExports?: GrapherExports): Promise<FormattedPost> {
    // Strip comments
    html = html.replace(/<!--[^>]+-->/g, "")

    // Standardize spacing
    html = html.replace(/&nbsp;/g, "").replace(/\r\n/g, "\n").replace(/\n+/g, "\n").replace(/\n/g, "\n\n")

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
        footnotes.push(footnote)
        const i = footnotes.length
        return `<a id="ref-${i}" class="ref" href="#note-${i}"><sup>${i}</sup></a>`
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

    // These old things don't work with static generation, link them through to maxroser.com
    html = html.replace(new RegExp("https://ourworldindata.org/wp-content/uploads/nvd3", 'g'), "https://www.maxroser.com/owidUploads/nvd3")
            .replace(new RegExp("https://ourworldindata.org/wp-content/uploads/datamaps", 'g'), "https://www.maxroser.com/owidUploads/datamaps")

    const $ = cheerio.load(html)

    // Wrap content demarcated by headings into section blocks
    const sectionStarts = [$("body").children().get(0)].concat($("h2").toArray())
    for (const start of sectionStarts) {
        const $start = $(start)
        const $contents = $start.nextUntil("h2")
        const $wrapNode = $("<section></section>");

        $contents.remove();
        $wrapNode.append($start.clone())
        $wrapNode.append($contents)
        $start.replaceWith($wrapNode)
    }

    // Replace grapher iframes with static previews
    if (grapherExports) {
        const grapherIframes = $("iframe").toArray().filter(el => (el.attribs['src']||'').match(/\/grapher\//))
        for (const el of grapherIframes) {
            const src = el.attribs['src']
            const chart = grapherExports.get(src)
            if (chart) {
                const output = `<figure data-grapher-src="${src}" class="grapherPreview"><a href="${src}" target="_blank"><div><img src="${chart.svgUrl}"/></div></a></div>`
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
    const uploadDex = await getUploadedImages()
    for (const el of $("img").toArray()) {
        const $el = $(el)

        // Open full-size image in new tab
        if (el.parent.tagName === "a") {
            el.parent.attribs['target'] = '_blank'
        }


        // Set srcset to load image responsively
        const src = el.attribs['src']||""
        const upload = uploadDex.get(path.basename(src))

        // Add alt tag
        if (upload && !el.attribs['alt']) {
            el.attribs['alt'] = _.capitalize(upload.slug.replace(/[-_]/g, ' '))
        }

        if (upload && upload.variants.length) {
            el.attribs['srcset'] = upload.variants.map(v => `${v.url} ${v.width}w`).join(", ")
            el.attribs['sizes'] = "(min-width: 800px) 50vw, 100vw"

            // Link through to full size image
            if (el.parent.tagName !== "a") {
                const $a = $(`<a href="${upload.originalUrl}" target="_blank"></a>`)
                $el.replaceWith($a)
                $a.append($el)
            }
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
        const $heading = $(el);
        const headingText = $heading.text()
        // We need both the text and the html because may contain footnote
        // let headingHtml = $heading.html() as string
        let slug = urlSlug(headingText)

        // Avoid If the slug already exists, try prepend the parent
        if (existingSlugs.indexOf(slug) !== -1 && parentHeading != null) {
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

    return {
        id: post.id,
        type: post.type,
        slug: post.slug,
        title: post.title,
        date: post.date,
        modifiedDate: post.modifiedDate,
        authors: post.authors,
        html: $("body").html() as string,
        footnotes: footnotes,
        acknowledgements: acknowledgements,
        references: references,
        excerpt: post.excerpt || $($("p")[0]).text(),
        imageUrl: post.imageUrl,
        tocHeadings: tocHeadings
    }
}

export interface FormattingOptions {
    toc?: boolean,
    wpFormat?: boolean,
    bodyClassName?: string,
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
            const [name, value] = option.split(":")
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
    html = html.replace(new RegExp(WORDPRESS_URL, 'g'), BAKED_URL)
        .replace(new RegExp("https?://ourworldindata.org", 'g'), BAKED_URL)

    // If <!--raw--> appears at the top of a post, it signals that the author
    // wants to bypass the formatting and just write plain HTML
    const isRaw = html.match(/<!--raw-->/)

    if (isRaw) {
        return {
            id: post.id,
            type: post.type,
            slug: post.slug,
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
            wpFormat: true
        }, formattingOptions)
        return formatWordpressPost(post, html, options, grapherExports)
    }
}

export function formatAuthors(authors: string[], requireMax?: boolean): string {
    if (requireMax && authors.indexOf("Max Roser") === -1)
        authors.push("Max Roser")

    let authorsText = authors.slice(0, -1).join(", ")
    if (authorsText.length == 0)
        authorsText = authors[0]
    else
        authorsText += ` and ${_.last(authors)}`

    return authorsText
}

export function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' })
}
