import React from "react"
import { computed } from "mobx"
import { Remark } from "react-remark"
import { visit } from "unist-util-visit"

type SimpleMarkdownTextProps = {
    text: string
}

function transformDodLinks() {
    return function (tree: any) {
        visit(tree, "element", function (node) {
            if (
                node.tagName === "a" &&
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
        return <Remark rehypePlugins={[transformDodLinks]}>{this.text}</Remark>
    }
}
