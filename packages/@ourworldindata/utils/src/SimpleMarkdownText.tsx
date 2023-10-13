import React from "react"
import { computed } from "mobx"
import {
    IRToken,
    parsimmonToTextTokens,
    recursiveMergeTextTokens,
} from "./MarkdownTextWrap/MarkdownTextWrap.js"
import { MarkdownRoot, mdParser } from "./MarkdownTextWrap/parser.js"
type SimpleMarkdownTextProps = {
    text: string
}

export class SimpleMarkdownText extends React.Component<SimpleMarkdownTextProps> {
    @computed get text(): string {
        return this.props.text
    }

    @computed get ast(): MarkdownRoot["children"] {
        if (!this.text) return []
        const result = mdParser.markdown.parse(this.props.text)
        if (result.status) {
            return result.value.children
        }
        return []
    }

    @computed get tokens(): IRToken[] {
        const tokens = parsimmonToTextTokens(this.ast, {})
        return recursiveMergeTextTokens(tokens)
    }

    render(): JSX.Element | null {
        const { tokens } = this
        return <>{tokens.map((token, index) => token.toHTML(index))}</>
    }
}
