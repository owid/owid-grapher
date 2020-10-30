import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import { ExpandableInlineBlock_name } from "site/client/ExpandableInlineBlock/ExpandableInlineBlock"
import { GlossaryExcerpt_name } from "site/client/GlossaryExcerpt/GlossaryExcerpt"
import { GlossaryItem } from "./glossary"

// Do not replace glossary terms within these tags
export const FORBIDDEN_TAGS = ["a", "h2", "h3", "h4", "h5", "h6"]

export const GlossaryLink = ({
    slug,
    excerpt,
    match,
}: {
    slug: string
    excerpt: string
    match: string
}) => (
    <span>
        <script
            data-type={ExpandableInlineBlock_name}
            data-block={GlossaryExcerpt_name}
            data-label={match}
            type="component/props"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify({ slug, excerpt }),
            }}
        ></script>
        <a className="expandable-block-button" href={`/glossary#${slug}`}>
            {match}
        </a>
    </span>
)

export const formatGlossaryTerms = (
    $: CheerioStatic,
    $contents: Cheerio,
    mutableGlossary: GlossaryItem[]
) => {
    $contents.each((i, el) => {
        if (FORBIDDEN_TAGS.includes(el.tagName)) return
        if (el.type === "text") {
            $(el).replaceWith(
                _linkGlossaryTermsInText(el.data, mutableGlossary)
            )
        } else {
            formatGlossaryTerms($, $(el).contents(), mutableGlossary)
        }
    })
}

export const _linkGlossaryTermsInText = (
    srcText: string = "",
    glossary: GlossaryItem[]
) => {
    let textWithGlossaryLinks = srcText

    const regex = new RegExp(
        `\\b(${glossary.map((item) => item.term).join("|")})\\b`,
        "ig"
    )

    const _getGlossaryLink = (match: string) => {
        const idx = glossary.findIndex(
            (item) => item.term.toLowerCase() === match.toLowerCase()
        )
        if (idx === -1) return match

        const slug = glossary[idx].slug
        const excerpt = glossary[idx].excerpt

        // Remove element in-place so that glossary items are only matched and
        // linked once per recursive traversal (at the moment, this is set to
        // once per page section)
        glossary.splice(idx, 1)

        return ReactDOMServer.renderToStaticMarkup(
            <GlossaryLink slug={slug} excerpt={excerpt} match={match} />
        )
    }

    textWithGlossaryLinks = textWithGlossaryLinks.replace(
        regex,
        _getGlossaryLink
    )
    return textWithGlossaryLinks
}
