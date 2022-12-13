import React from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useDebug } from "./DebugContext.js"

export const BlockErrorBoundary = ({
    children,
}: {
    children: React.ReactNode
}) => {
    const debug = useDebug()
    return debug ? (
        <ErrorBoundary FallbackComponent={BlockErrorFallback}>
            {children}
        </ErrorBoundary>
    ) : (
        <>{children}</>
    )
}

const BlockErrorFallback = ({
    error,
    resetErrorBoundary,
}: {
    error?: Error
    resetErrorBoundary: VoidFunction
}): JSX.Element => {
    return (
        <div
            style={{
                textAlign: "center",
                backgroundColor: "rgba(255,0,0,0.1)",
                padding: "20px",
            }}
        >
            <h3>Error while rendering the block</h3>
            Please check the source content.
            <div>
                <button style={{ margin: "10px" }} onClick={resetErrorBoundary}>
                    Try again
                </button>
            </div>
            <div>{error?.message}</div>
        </div>
    )
}
