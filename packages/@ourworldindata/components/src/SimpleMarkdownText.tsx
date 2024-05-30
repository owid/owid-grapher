import React from "react"
import { computed } from "mobx"
import { Remark, useRemarkSync, UseRemarkSyncOptions } from "react-remark"
import { remarkPlainLinks } from "./markdown/remarkPlainLinks.js"
import visit from "unist-util-visit"

type SimpleMarkdownTextProps = {
    text: string
    useParagraphs?: boolean // by default, text is wrapped in <p> tags
}

function transformDodLinks() {
    // TODO: try to type this properly when we have upgraded to a recent version with ESM. This is
    // going to be a HAST tree and with that typing it should be able to make the access in there typesafe.
    return function (tree: any) {
        visit(tree, "element", function (node: any) {
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
                        node.properties.class = "dod-span"
                        node.properties["data-id"] = match.groups?.term
                        node.properties["aria-expanded"] = "false"
                        delete node.properties.href
                    }
                    //node.children.push(
                }
        })
    }
}

function RemarkSync({
    children,
    ...props
}: { children: string } & UseRemarkSyncOptions) {
    return useRemarkSync(children, props)
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

    @computed get rehypeReactOptions(): any {
        if (!this.useParagraphs) {
            // "unwrap" the text by rendering <p /> as a react fragment
            return {
                components: {
                    p: (props: any) => <React.Fragment {...props} />,
                },
            }
        }

        return undefined
    }

    render(): React.ReactElement | null {
        const isServer = typeof window === "undefined"
        const options = {
            rehypePlugins: [transformDodLinks],
            remarkPlugins: [remarkPlainLinks],
            rehypeReactOptions: this.rehypeReactOptions,
        }
        return isServer ? (
            <RemarkSync {...options}>{this.text}</RemarkSync>
        ) : (
            <Remark {...options}>{this.text}</Remark>
        )
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
