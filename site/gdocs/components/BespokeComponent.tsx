import { EnrichedBlockBespokeComponent } from "@ourworldindata/types"
import { LoadingIndicator } from "@ourworldindata/components"
import cx from "classnames"
import { useEffect, useMemo, useRef, useState } from "react"
import { BESPOKE_COMPONENT_REGISTRY } from "../../bespokeComponentRegistry.js"
import { mountBespokeComponentInShadow } from "../../../bespoke/shared/bespokeComponentShadowDom.js"
import { BESPOKE_BASE_URL } from "../../../settings/clientSettings.js"

// Use the `baseUrl` as a base for the URL constructor if set, and use just the URL (which might be host-relative) if not.
// If `url` is already absolute, it will effectively just get passed through.
const makeAbsoluteWithBaseUrlIfSet = (url: string, baseUrl?: string) => {
    baseUrl = baseUrl?.trim()
    if (baseUrl) {
        return new URL(url, baseUrl).toString()
    }
    return url
}

/**
 * Renders a bespoke component inside a Shadow DOM container.
 *
 * This is not a normal React component - it renders client-only and mounts
 * an external ES module into a Shadow DOM. This allows embedding
 * independently-built components that have their own bundled JS and CSS,
 * isolated from the rest of the page styles.
 *
 * On the server, this renders an empty div. On the client, useEffect dynamically
 * imports the module and calls its `mount` function.
 *
 * Example ArchieML:
 * {.bespoke-component}
 *   bundle: poverty-plots
 *   variant: distribution # Variant is optional, but can be useful when the bundle contains multiple charts that should be connected in state, but rendered in different places.
 *   {.config}
 *     country: "USA"
 *     year: 2020
 *   {}
 * {}
 */
export function BespokeComponent({
    className,
    block,
}: {
    className?: string
    block: EnrichedBlockBespokeComponent
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const disposeRef = useRef<(() => void) | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const definition = useMemo(
        () => BESPOKE_COMPONENT_REGISTRY[block.bundle],
        [block.bundle]
    )

    const { scriptUrl, cssUrl } = useMemo(() => {
        if (!definition) return { scriptUrl: undefined, cssUrl: undefined }

        return {
            scriptUrl: makeAbsoluteWithBaseUrlIfSet(
                definition.scriptUrl,
                BESPOKE_BASE_URL
            ),
            cssUrl: makeAbsoluteWithBaseUrlIfSet(
                definition.cssUrl,
                BESPOKE_BASE_URL
            ),
        }
    }, [definition])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        if (!definition) {
            setError(`Unknown bespoke bundle: "${block.bundle}"`)
            return
        }
        if (!scriptUrl || !cssUrl) return

        const abortController = new AbortController()

        setError(null)
        setIsLoading(true)

        mountBespokeComponentInShadow({
            container,
            scriptUrl,
            cssUrl,
            variant: block.variant,
            config: block.config,
            signal: abortController.signal,
        })
            .then(({ dispose }) => {
                if (abortController.signal.aborted) return
                if (dispose) disposeRef.current = dispose
                setIsLoading(false)
            })
            .catch((err) => {
                if (abortController.signal.aborted) return
                const message =
                    err instanceof Error ? err.message : "Unknown error"
                setError(
                    `Failed to load bespoke bundle "${block.bundle}": ${message}`
                )
                console.error(
                    `Failed to hydrate bespoke bundle "${block.bundle}":`,
                    err
                )
            })

        return () => {
            abortController.abort()
            if (disposeRef.current) {
                disposeRef.current()
                disposeRef.current = null
            }
            container.shadowRoot?.replaceChildren()
        }
    }, [
        block.bundle,
        block.variant,
        block.config,
        definition,
        scriptUrl,
        cssUrl,
    ])

    if (error) {
        return <BespokeError className={className} message={error} />
    }

    return (
        <div
            className={className}
            style={{
                position: "relative",
                minHeight: 300,
            }}
        >
            {isLoading && <LoadingIndicator />}
            <div ref={containerRef}></div>
        </div>
    )
}

function BespokeError({
    className,
    message,
}: {
    className?: string
    message: string
}) {
    return (
        <div className={cx(className, "bespoke-component__error")}>
            {message}
        </div>
    )
}
