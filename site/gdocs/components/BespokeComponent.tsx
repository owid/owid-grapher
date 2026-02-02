import { EnrichedBlockBespokeComponent } from "@ourworldindata/types"
import { LoadingIndicator } from "@ourworldindata/components"
import { useEffect, useRef, useState } from "react"
import {
    BESPOKE_COMPONENT_REGISTRY,
    BespokeComponentModule,
} from "../../bespokeComponentRegistry.js"

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

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const definition = BESPOKE_COMPONENT_REGISTRY[block.bundle]
        if (!definition) {
            setError(`Unknown bespoke bundle: "${block.bundle}"`)
            return
        }

        let shadowRoot = container.shadowRoot
        if (!shadowRoot) {
            shadowRoot = container.attachShadow({ mode: "open" })
        }

        const abortController = new AbortController()

        async function hydrate() {
            setIsLoading(true)
            try {
                // Load CSS into shadow root
                await loadCssIntoShadow(shadowRoot!, definition.cssUrls)

                if (abortController.signal.aborted) return

                // Create a container div inside the shadow root for the component to render into
                const mountContainer = document.createElement("div")
                mountContainer.className = "bespoke-container"
                shadowRoot!.appendChild(mountContainer)

                // Dynamically import the ESM module
                const module = (await import(
                    definition.scriptUrl
                )) as BespokeComponentModule

                if (abortController.signal.aborted) return

                if (typeof module.mount !== "function") {
                    setError(
                        `Bespoke bundle "${block.bundle}" does not export a mount function`
                    )
                    return
                }

                // Mount the component
                const dispose = module.mount(mountContainer, {
                    variant: block.variant,
                    config: block.config,
                })
                if (typeof dispose === "function") {
                    disposeRef.current = dispose
                }
                setIsLoading(false)
            } catch (err) {
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
            }
        }

        void hydrate()

        return () => {
            abortController.abort()
            if (disposeRef.current) {
                disposeRef.current()
                disposeRef.current = null
            }
        }
    }, [block.bundle, block.variant, block.config])

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

async function loadCssIntoShadow(
    shadowRoot: ShadowRoot,
    cssUrls: string[]
): Promise<void> {
    const loadPromises = cssUrls.map((cssUrl) => {
        return new Promise<void>((resolve, reject) => {
            const link = document.createElement("link")
            link.rel = "stylesheet"
            link.href = cssUrl
            link.onload = () => resolve()
            link.onerror = () =>
                reject(new Error(`Failed to load CSS: ${cssUrl}`))
            shadowRoot.appendChild(link)
        })
    })
    await Promise.all(loadPromises)
}

function BespokeError({
    className,
    message,
}: {
    className?: string
    message: string
}) {
    return (
        <div
            className={className}
            style={{
                padding: 16,
                backgroundColor: "#fee2e2",
                border: "1px solid #ef4444",
                borderRadius: 4,
                color: "#991b1b",
                fontFamily: "system-ui, sans-serif",
                fontSize: 14,
            }}
        >
            {message}
        </div>
    )
}
