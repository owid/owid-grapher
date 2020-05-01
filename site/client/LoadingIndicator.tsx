import * as React from "react"
import { Bounds } from "charts/Bounds"

export const LoadingIndicator = (props: { color: string; bounds?: Bounds }) => {
    return (
        <div className="loading-indicator" style={{ ...props.bounds?.toCSS() }}>
            <span
                style={{
                    borderColor: props.color
                }}
            />
        </div>
    )
}
