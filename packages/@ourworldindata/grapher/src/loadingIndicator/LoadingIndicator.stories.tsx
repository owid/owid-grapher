import React from "react"
import { LoadingIndicator } from "./LoadingIndicator"

export default {
    title: "LoadingIndicator",
    component: LoadingIndicator,
}

export const Default = (): React.ReactElement => {
    return (
        <div>
            <LoadingIndicator />
        </div>
    )
}
