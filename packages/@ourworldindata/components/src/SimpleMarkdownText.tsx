import React from "react"
import { computed } from "mobx"
import { Remark } from "react-remark"
type SimpleMarkdownTextProps = {
    text: string
}

export class SimpleMarkdownText extends React.Component<SimpleMarkdownTextProps> {
    @computed get text(): string {
        return this.props.text
    }

    render(): JSX.Element | null {
        return <Remark>{this.text}</Remark>
    }
}
