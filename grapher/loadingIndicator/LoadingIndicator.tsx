import * as React from "react"
import { Bounds } from "grapher/utils/Bounds"

export const LoadingIndicator = (props: {
    backgroundColor?: string
    bounds?: Bounds
    color: string
}) => {
    return (
        <div
            className="loading-indicator"
            style={{
                backgroundColor: props.backgroundColor,
                ...props.bounds?.toCSS(),
            }}
        >
            <span
                style={{
                    borderColor: props.color,
                }}
            />
        </div>
    )
}
