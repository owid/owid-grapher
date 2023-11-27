import React from "react"
import { computed } from "mobx"
import { Remark } from "react-remark"
import { remarkPlainLinks } from "./markdown/remarkPlainLinks.js"
import visit from "unist-util-visit"
type SimpleMarkdownTextProps = {
    text: string
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

export class SimpleMarkdownText extends React.Component<SimpleMarkdownTextProps> {
    @computed get text(): string {
        return this.props.text
    }

    render(): JSX.Element | null {
        return (
            <Remark
                rehypePlugins={[transformDodLinks]}
                remarkPlugins={[remarkPlainLinks]}
            >
                {this.text}
            </Remark>
        )
    }
}

// TODO: remove this component once all backported indicators
// etc have switched from HTML to markdown for their sources
export const HtmlOrSimpleMarkdownText = (props: {
    text: string
}): JSX.Element => {
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
