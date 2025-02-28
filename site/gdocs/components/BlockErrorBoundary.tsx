import * as React from "react"
import * as Sentry from "@sentry/react"
import { useDebug } from "../DebugContext.js"

export const BlockErrorBoundary = ({
    children,
    className,
}: {
    children: React.ReactNode
    className: string
}) => {
    return (
        <Sentry.ErrorBoundary
            fallback={({ error, resetError }) => {
                if (!(error instanceof Error)) {
                    error = new Error(String(error))
                }
                return (
                    <BlockErrorFallback
                        className={className}
                        error={error as Error}
                        resetError={resetError}
                    />
                )
            }}
        >
            {children}
        </Sentry.ErrorBoundary>
    )
}

export const BlockErrorFallback = ({
    error,
    resetError,
    className = "",
}: {
    error: Error
    resetError?: VoidFunction
    className?: string
}): React.ReactElement => {
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
                    {resetError ? (
                        <div>
                            <button
                                aria-label="Reload content"
                                style={{ margin: "10px" }}
                                onClick={resetError}
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
