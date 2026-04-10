import * as React from "react"
import Markdown, {
    type Options as MarkdownOptions,
    type Components as MarkdownComponents,
} from "react-markdown"
import { remarkPlainLinks } from "./markdown/remarkPlainLinks.js"
import { visit } from "unist-util-visit"
import type { Plugin } from "unified"
import type { Root, ElementContent } from "hast"

type SimpleMarkdownTextProps = {
    text: string
    useParagraphs?: boolean // by default, text is wrapped in <p> tags
}

const transformDodLinks: Plugin<[], Root> = () => {
    return function (tree) {
        visit(tree, "element", function (node) {
            if (node.tagName === "a")
                if (
                    node.properties &&
                    typeof node.properties.href === "string" &&
                    node.properties.href.startsWith("#dod:")
                ) {
                    // use a regex to split the #dod: part from the term of the href. Use a named capture group
                    // to capture the term
                    const match = node.properties.href.match(/#dod:(?<term>.+)/)
                    if (match) {
                        node.tagName = "span"
                        node.properties.class = "dod-span"
                        node.properties["data-id"] = match.groups?.term
                        node.properties["aria-expanded"] = "false"
                        node.properties["tabindex"] = 0
                        delete node.properties.href
                    }
                }
        })
    }
}

/**
 * Rehype plugin that transforms `{#hex: colored text}` syntax into
 * `<span style="color: #hex">colored text</span>`.
 *
 * Example: `I am normal.{#f00: red text here}. More normal text.`
 */
const COLOR_SYNTAX_REGEX = /\{(#[0-9a-fA-F]{3,8}):\s*(.*?)\}/g

const transformColorSyntax: Plugin<[], Root> = () => {
    return function (tree) {
        visit(tree, "text", function (node, index, parent) {
            if (!parent || index === undefined) return
            const text = node.value
            if (!COLOR_SYNTAX_REGEX.test(text)) return

            // Reset regex state (it's global)
            COLOR_SYNTAX_REGEX.lastIndex = 0

            const children: ElementContent[] = []
            let lastIndex = 0
            let match: RegExpExecArray | null

            while ((match = COLOR_SYNTAX_REGEX.exec(text)) !== null) {
                // Text before the match
                if (match.index > lastIndex) {
                    children.push({
                        type: "text",
                        value: text.slice(lastIndex, match.index),
                    })
                }
                // Colored span
                children.push({
                    type: "element",
                    tagName: "span",
                    properties: { style: `color: ${match[1]}` },
                    children: [{ type: "text", value: match[2] }],
                })
                lastIndex = match.index + match[0].length
            }

            // Text after the last match
            if (lastIndex < text.length) {
                children.push({
                    type: "text",
                    value: text.slice(lastIndex),
                })
            }

            // Replace the text node with the new children
            parent.children.splice(index, 1, ...children)
        })
    }
}

// NOTE: We currently don't need to render markdown in React. We should be able
// to render it only during baking/on the server and pass the HTML as string.
// This way we could reduce the bundle size by not including a markdown library
// and improve performance.
export class SimpleMarkdownText extends React.Component<SimpleMarkdownTextProps> {
    get useParagraphs(): boolean {
        return this.props.useParagraphs ?? true
    }

    get markdownCustomComponents(): MarkdownComponents | undefined {
        if (!this.useParagraphs) {
            // "unwrap" the text by rendering <p /> as a react fragment
            return {
                p: ({ children }) => (
                    <React.Fragment>{children}</React.Fragment>
                ),
            }
        }

        return undefined
    }

    override render(): React.ReactElement | null {
        const options: Omit<MarkdownOptions, "children"> = {
            rehypePlugins: [transformDodLinks, transformColorSyntax],
            remarkPlugins: [remarkPlainLinks],
            components: this.markdownCustomComponents,
        }
        return <Markdown {...options}>{this.props.text}</Markdown>
    }
}

// TODO: remove this component once all backported indicators
// etc have switched from HTML to markdown for their sources
export const HtmlOrSimpleMarkdownText = (props: {
    text: string
}): React.ReactElement => {
    // check the text for closing a, li or p tags. If
    // one is found, render using dangerouslySetInnerHTML,
    // otherwise use SimpleMarkdownText
    const { text } = props
    const htmlRegex = /<\/(a|li|p)>/
    const match = text.match(htmlRegex)
    if (match) {
        return <span dangerouslySetInnerHTML={{ __html: text }} />
    } else {
        return <SimpleMarkdownText text={text} />
    }
}
