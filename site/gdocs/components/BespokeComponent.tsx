import {
    EnrichedBlockBespokeComponent,
    HIDE_IF_JS_DISABLED_CLASSNAME,
} from "@ourworldindata/types"
import { LoadingIndicator } from "@ourworldindata/components"
import cx from "clsx"
import { useEffect, useMemo, useRef, useState } from "react"
import { useIntersectionObserver } from "usehooks-ts"
import { BESPOKE_COMPONENT_REGISTRY } from "../../bespokeComponentRegistry.js"
import { mountBespokeComponentInShadow } from "../../../bespoke/shared/bespokeComponentShadowDom.js"
import { BESPOKE_BASE_URL } from "../../../settings/clientSettings.js"
import urljoin from "url-join"

// Use the `baseUrl` as a base for the URL constructor if set, and use just the URL (which might be host-relative) if not.
// If `url` is already absolute, it will effectively just get passed through.
const makeAbsoluteWithBaseUrl = (url: string, baseUrl: string | undefined) => {
    baseUrl = baseUrl?.trim()
    if (!baseUrl) return url

    // url is already absolute, so just return it as is
    if (url.startsWith("http://") || url.startsWith("https://")) return url

    return urljoin(baseUrl, url)
}

/**
 * Renders a bespoke component inside a Shadow DOM container.
 *
 * This is not a normal React component - it renders client-only and mounts
 * an external ES module into a Shadow DOM. This allows embedding
 * independently-built components that bundle their own JS and CSS,
 * isolated from the rest of the page styles.
 *
 * On the server, this renders a loading indicator and the site's no-JS warning
 * block. On the client, useEffect dynamically imports the module and calls its
 * `mount` function.
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

    // Defer loading the component's JS until it approaches the viewport
    const { ref: intersectionRef, isIntersecting: hasBeenVisible } =
        useIntersectionObserver({
            rootMargin: "400px",
            freezeOnceVisible: true,
        })

    const definition = useMemo(
        () => BESPOKE_COMPONENT_REGISTRY[block.bundle],
        [block.bundle]
    )

    const scriptUrl = useMemo(() => {
        if (!definition || !BESPOKE_BASE_URL.trim()) return undefined
        return makeAbsoluteWithBaseUrl(definition.scriptUrl, BESPOKE_BASE_URL)
    }, [definition])

    useEffect(() => {
        if (!hasBeenVisible) return

        const container = containerRef.current
        if (!container) return

        if (!definition) {
            setError(`Unknown bespoke bundle: "${block.bundle}"`)
            return
        }
        if (!scriptUrl) {
            setError("This custom component cannot be displayed on this page.")
            return
        }

        const abortController = new AbortController()

        setError(null)
        setIsLoading(true)

        mountBespokeComponentInShadow({
            container,
            scriptUrl,
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
        hasBeenVisible,
    ])

    if (error) {
        return <BespokeError className={className} message={error} />
    }

    return (
        <div className={className} ref={intersectionRef}>
            {isLoading && (
                <div className={HIDE_IF_JS_DISABLED_CLASSNAME}>
                    <LoadingIndicator />
                </div>
            )}
            <div className="js--show-warning-block-if-js-disabled" />
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
