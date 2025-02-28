import * as React from "react"
import * as Sentry from "@sentry/react"
import { Button } from "@ourworldindata/components"
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
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                alignItems: "center",
                backgroundColor: "#ffe5e5",
                padding: "20px",
                marginTop: "20px",
                marginBottom: "20px",
            }}
        >
            <h3 style={{ margin: 0 }}>{error.name}</h3>
            {debug && (
                <>
                    <div>{error.message}</div>
                    {resetError && (
                        <Button
                            theme="solid-vermillion"
                            text="Try again"
                            ariaLabel="Reload content"
                            onClick={resetError}
                            icon={null}
                        />
                    )}
                </>
            )}
        </div>
    )
}
