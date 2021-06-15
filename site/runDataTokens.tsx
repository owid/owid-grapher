import React from "react"
import ReactDOM from "react-dom"
import { DataToken_name } from "../site/DataToken"
import { LastUpdated } from "./covid/LastUpdated"

interface ComponentDictionary {
    [key: string]: any
}

const dictionary: ComponentDictionary = {
    LastUpdated,
}

export const runDataTokens = () => {
    const dataTokens = document.querySelectorAll(
        `[data-type=${DataToken_name}]`
    )
    dataTokens.forEach((dataToken) => {
        const token = dataToken.getAttribute("data-token")
        if (!token) return

        const componentProps = JSON.parse(dataToken.innerHTML)

        const Component = dictionary[token]
        if (!Component) return

        ReactDOM.render(
            <Component {...componentProps} />,
            dataToken.parentElement
        )
    })
}
