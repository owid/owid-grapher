import React, { ReactNode } from "react"
import MarkdownOriginal, { MarkdownToJSX } from "markdown-to-jsx"
import { set } from "lodash"

// A markdown-to-jsx wrapper that gives us a flag to make links open in a new tab
export const Markdown = (props: {
    shouldOpenLinksInNewTab?: boolean
    options?: MarkdownToJSX.Options
    children: string & ReactNode
}) => {
    const { shouldOpenLinksInNewTab = true } = props

    const overrides: MarkdownToJSX.Options["overrides"] = {
        ...props.options?.overrides,
    }

    if (shouldOpenLinksInNewTab) {
        set(
            overrides,
            "a",
            ({ children, ...props }: { children: JSX.Element }) => (
                <a rel="noopener noreferrer" target="_blank" {...props}>
                    {children}
                </a>
            )
        )
    }

    return (
        <MarkdownOriginal
            options={{ ...props.options, overrides: { ...overrides } }}
        >
            {props.children}
        </MarkdownOriginal>
    )
}
