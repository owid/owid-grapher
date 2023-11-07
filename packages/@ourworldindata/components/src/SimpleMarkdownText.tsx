import React from "react"
import { computed } from "mobx"
import { Remark } from "react-remark"
import { remarkPlainLinks } from "./markdown/remarkPlainLinks.js"

type SimpleMarkdownTextProps = {
    text: string
}

export class SimpleMarkdownText extends React.Component<SimpleMarkdownTextProps> {
    @computed get text(): string {
        return this.props.text
    }

    render(): JSX.Element | null {
        return <Remark remarkPlugins={[remarkPlainLinks]}>{this.text}</Remark>
    }
}
