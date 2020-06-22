import * as React from "react"
import { Bounds } from "charts/Bounds"

export const LoadingIndicator = (props: {
    backgroundColor?: string
    bounds?: Bounds
    color: string
    position: "absolute" | "relative"
}) => {
    return (
        <div
            className="loading-indicator"
            style={{
                backgroundColor: props.backgroundColor,
                position: props.position,
                ...props.bounds?.toCSS()
            }}
        >
            <span
                style={{
                    borderColor: props.color
                }}
            />
        </div>
    )
}
