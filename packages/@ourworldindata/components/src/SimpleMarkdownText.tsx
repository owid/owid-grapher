import * as React from "react"
import { computed } from "mobx"
import Markdown, {
    type Options as MarkdownOptions,
    type Components as MarkdownComponents,
} from "react-markdown"
import { remarkPlainLinks } from "./markdown/remarkPlainLinks.js"
import { visit } from "unist-util-visit"
import { type Plugin } from "unified"
import { type Root } from "hast"

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

// NOTE: We currently don't need to render markdown in React. We should be able
// to render it only during baking/on the server and pass the HTML as string.
// This way we could reduce the bundle size by not including a markdown library
// and improve performance.
export class SimpleMarkdownText extends React.Component<SimpleMarkdownTextProps> {
    @computed get text(): string {
        return this.props.text
    }

    @computed get useParagraphs(): boolean {
        return this.props.useParagraphs ?? true
    }

    @computed get markdownCustomComponents(): MarkdownComponents | undefined {
        if (!this.useParagraphs) {
            // "unwrap" the text by rendering <p /> as a react fragment
            return {
                p: (props) => <React.Fragment {...props} />,
            }
        }

        return undefined
    }

    render(): React.ReactElement | null {
        const options: MarkdownOptions = {
            rehypePlugins: [transformDodLinks],
            remarkPlugins: [remarkPlainLinks],
            components: this.markdownCustomComponents,
        }
        return <Markdown {...options}>{this.text}</Markdown>
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
