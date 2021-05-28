import * as React from "react"
import { LoadingIndicator } from "./LoadingIndicator"

export default {
    title: "LoadingIndicator",
    component: LoadingIndicator,
}

export const Default = (): JSX.Element => {
    return (
        <div>
            <LoadingIndicator />
        </div>
    )
}
