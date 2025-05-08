import * as React from "react"
import { Prompt as ReactRouterPrompt } from "react-router-dom"

interface PromptProps {
    when: boolean
    message: string
}

/**
 * Wrapper around React Router's Prompt component that
 * also shows a warning if the user closes a tab.
 */
export class Prompt extends React.Component<PromptProps> {
    componentDidMount() {
        window.addEventListener("beforeunload", this.handleBeforeUnload)
    }

    componentWillUnmount() {
        window.removeEventListener("beforeunload", this.handleBeforeUnload)
    }

    private handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // show dialog that asks users to confirm they want to navigate away
        if (this.props.when) e.preventDefault()
    }

    render() {
        return <ReactRouterPrompt {...this.props} />
    }
}
