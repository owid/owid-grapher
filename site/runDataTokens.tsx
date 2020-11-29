import React from "react"
import ReactDOM from "react-dom"
import { DataToken_name } from "site/server/DataToken"
import { CovidLastUpdated } from "../covid/CovidLastUpdated"

interface ComponentDictionary {
    [key: string]: any
}

const dictionary: ComponentDictionary = {
    COVID_LAST_UPDATED: CovidLastUpdated,
}

export const runDataTokens = () => {
    const dataTokens = document.querySelectorAll(
        `[data-type=${DataToken_name}]`
    )
    dataTokens.forEach((dataToken) => {
        const token = dataToken.getAttribute("data-token")
        if (!token) return

        const Component = dictionary[token]
        if (!Component) return

        ReactDOM.render(<Component />, dataToken.parentElement)
    })
}
