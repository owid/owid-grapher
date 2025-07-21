import * as React from "react"
import { Bounds } from "@ourworldindata/utils"

const DEFAULT_COLOR = "#333"

export const LoadingIndicator = (props: {
    backgroundColor?: string
    bounds?: Bounds
    color?: string
    title?: string
}): React.ReactElement => {
    return (
        <div
            className="loading-indicator"
            title={props.title}
            style={{
                backgroundColor: props.backgroundColor,
                ...props.bounds?.toCSS(),
            }}
        >
            <span
                style={{
                    borderColor: props.color || DEFAULT_COLOR,
                }}
            />
        </div>
    )
}
