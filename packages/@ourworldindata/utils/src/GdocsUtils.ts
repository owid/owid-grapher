import { spansToUnformattedPlainText } from "./Util.js"
import { gdocUrlRegex } from "./GdocsConstants.js"
import { EnrichedBlockText, OwidGdocLinkJSON, Span } from "./owidTypes.js"
import { Url } from "./urls/Url.js"
import urlSlug from "url-slug"
import {
    EveryMarkdownNode,
    MarkdownRoot,
    mdParser,
} from "./MarkdownTextWrap/parser.js"
import { P, match } from "ts-pattern"

export function getLinkType(urlString: string): OwidGdocLinkJSON["linkType"] {
    const url = Url.fromURL(urlString)
    if (url.isGoogleDoc) {
        return "gdoc"
    }
    if (url.isGrapher) {
        return "grapher"
    }
    if (url.isExplorer) {
        return "explorer"
    }
    return "url"
}

export function checkIsInternalLink(url: string): boolean {
    return ["gdoc", "grapher", "explorer"].includes(getLinkType(url))
}

export function getUrlTarget(urlString: string): string {
    const url = Url.fromURL(urlString)
    if (url.isGoogleDoc) {
        const gdocsMatch = urlString.match(gdocUrlRegex)
        if (gdocsMatch) {
            const [_, gdocId] = gdocsMatch
            return gdocId
        }
    }
    if ((url.isGrapher || url.isExplorer) && url.slug) {
        return url.slug
    }
    return urlString
}

export function convertHeadingTextToId(headingText: Span[]): string {
    return urlSlug(spansToUnformattedPlainText(headingText))
}

const convertMarkdownNodeToSpan = (node: EveryMarkdownNode): Span[] => {
    return match(node)
        .with(
            {
                type: "text",
            },
            (n) => [
                {
                    spanType: "span-simple-text" as const,
                    text: n.value,
                } as Span,
            ]
        )
        .with(
            {
                type: "textSegments",
            },
            (n) => n.children.flatMap(convertMarkdownNodeToSpan) as Span[]
        )
        .with(
            {
                type: "newline",
            },
            () => [
                {
                    spanType: "span-simple-text" as const,
                    text: "\n",
                } as Span,
            ]
        )
        .with(
            {
                type: "whitespace",
            },
            () => [
                {
                    spanType: "span-simple-text" as const,
                    text: " ",
                } as Span,
            ]
        )
        .with(
            {
                type: "detailOnDemand",
            },
            (n) => [
                {
                    spanType: "span-dod" as const,
                    id: n.term,
                    children: n.children.flatMap(convertMarkdownNodeToSpan),
                } as Span,
            ]
        )
        .with(
            {
                type: "markdownLink",
            },
            (n) => [
                {
                    spanType: "span-link" as const,
                    url: n.href,
                    children: n.children.flatMap(convertMarkdownNodeToSpan),
                } as Span,
            ]
        )
        .with(
            {
                type: "plainUrl",
            },
            (n) => [
                {
                    spanType: "span-link" as const,
                    url: n.href,
                    children: [
                        {
                            spanType: "span-simple-text" as const,
                            text: n.href,
                        },
                    ],
                } as Span,
            ]
        )
        .with(
            {
                type: "bold",
            },
            (n) => [
                {
                    spanType: "span-bold" as const,
                    children: n.children.flatMap(convertMarkdownNodeToSpan),
                } as Span,
            ]
        )
        .with(
            {
                type: P.union("italic", "plainItalic", "italicWithoutBold"),
            },
            (n) => [
                {
                    spanType: "span-italic" as const,
                    children: n.children.flatMap(convertMarkdownNodeToSpan),
                } as Span,
            ]
        )
        .with(
            {
                type: P.union("bold", "plainBold", "boldWithoutItalic"),
            },
            (n) => [
                {
                    spanType: "span-bold" as const,
                    children: n.children.flatMap(convertMarkdownNodeToSpan),
                } as Span,
            ]
        )
        .exhaustive()
    //.otherwise(() => ({ spanType: "span-simple-text" as const, text: "" }))
}

const convertMarkdownNodesToSpans = (nodes: MarkdownRoot) =>
    nodes.children.flatMap(convertMarkdownNodeToSpan)

export const markdownToEnrichedTextBlock = (
    markdown: string
): EnrichedBlockText => {
    const parsedMarkdown = mdParser.markdown.parse(markdown)
    if (parsedMarkdown.status) {
        const spans = convertMarkdownNodesToSpans(parsedMarkdown.value)
        return {
            type: "text",
            value: spans,
            parseErrors: [],
        }
    } else
        return {
            type: "text",
            value: [],
            parseErrors: [
                {
                    message: `Failed to parse markdown - expected ${parsedMarkdown.expected} at ${parsedMarkdown.index}`,
                    isWarning: false,
                },
            ],
        }
}
