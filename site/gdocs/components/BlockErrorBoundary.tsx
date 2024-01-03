import React from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useDebug } from "../DebugContext.js"

export const BlockErrorBoundary = ({
    children,
    className,
}: {
    children: React.ReactNode
    className: string
}) => {
    return (
        <ErrorBoundary
            FallbackComponent={(props) => (
                <BlockErrorFallback {...props} className={className} />
            )}
        >
            {children}
        </ErrorBoundary>
    )
}

export const BlockErrorFallback = ({
    error,
    resetErrorBoundary,
    className = "",
}: {
    error: Error
    resetErrorBoundary?: VoidFunction
    className?: string
}): JSX.Element => {
    const debug = useDebug()
    return (
        <div
            className={className}
            style={{
                textAlign: "center",
                backgroundColor: "rgba(255,0,0,0.1)",
                padding: "20px",
                marginTop: "20px",
                marginBottom: "20px",
            }}
        >
            <h3 style={{ margin: 0 }}>{error.name}</h3>
            {debug ? (
                <>
                    <div>{error.message}</div>
                    {resetErrorBoundary ? (
                        <div>
                            <button
                                style={{ margin: "10px" }}
                                onClick={resetErrorBoundary}
                            >
                                Try again
                            </button>
                        </div>
                    ) : null}
                </>
            ) : null}
        </div>
    )
}
