import React from "react"
import ReactDOM from "react-dom"
import { DataToken_name } from "../site/DataToken.js"
import { LastUpdated } from "./covid/LastUpdated.js"
import { FullWidthRawHtml } from "./covid/FullWidthRawHtml.js"

interface ComponentDictionary {
    [key: string]: {
        component: any
        wrapper: DataTokenWrapper
    }
}

type DataTokenWrapper = (children: React.ReactElement) => React.ReactElement

export const dictionary: ComponentDictionary = {
    LastUpdated: {
        component: LastUpdated,
        wrapper: (children) => <span>{children}</span>,
    },

    FullWidthRawHtml: {
        component: FullWidthRawHtml,
        // todo: replace by BlockType.FullContentWidth when merged
        wrapper: (children) => (
            <div className="wp-block-full-content-width">{children}</div>
        ),
    },
}

export const runDataTokens = () => {
    const dataTokens = document.querySelectorAll(
        `[data-type=${DataToken_name}]`
    )
    dataTokens.forEach((dataToken) => {
        const token = dataToken.getAttribute("data-token")
        if (!token) return

        const componentProps = JSON.parse(dataToken.innerHTML)

        const Component = dictionary[token]?.component
        if (!Component) return

        ReactDOM.render(
            <Component {...componentProps} />,
            dataToken.parentElement
        )
    })
}
