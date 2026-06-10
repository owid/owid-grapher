import type { BespokeComponentModule } from "./bespokeComponentTypes.ts"

/**
 * Load a CSS stylesheet into a shadow root by appending a <link> element.
 * Resolves when the stylesheet has finished loading.
 */
export function loadCssIntoShadow(
    shadowRoot: ShadowRoot,
    cssUrl: string
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = cssUrl
        link.onload = () => resolve()
        link.onerror = () => reject(new Error(`Failed to load CSS: ${cssUrl}`))
        shadowRoot.appendChild(link)
    })
}

/**
 * Mount a bespoke component into a shadow DOM container.
 *
 * Creates (or reuses) a shadow root on the given element, loads the CSS,
 * dynamically imports the JS module, and calls its `mount` function.
 *
 * Returns a dispose function that cleans up the mounted component.
 * Respects the provided AbortSignal to cancel mid-flight.
 */
export async function mountBespokeComponentInShadow({
    container,
    scriptUrl,
    cssUrl,
    variant,
    config,
    signal,
}: {
    container: HTMLDivElement
    scriptUrl: string
    cssUrl?: string
    variant?: string
    config?: Record<string, string>
    signal?: AbortSignal
}): Promise<{ dispose?: () => void }> {
    let shadowRoot = container.shadowRoot
    if (!shadowRoot) {
        shadowRoot = container.attachShadow({ mode: "open" })
    }
    shadowRoot.replaceChildren()

    const promises = []
    if (cssUrl) {
        promises.push(loadCssIntoShadow(shadowRoot, cssUrl))
    }
    const jsPromise = import(
        /* @vite-ignore */
        scriptUrl
    ) as Promise<BespokeComponentModule>
    promises.push(jsPromise)

    await Promise.all(promises)
    const module = await jsPromise

    if (signal?.aborted) return {}

    if (typeof module.mount !== "function") {
        throw new Error("Module does not export a mount function")
    }

    const mountContainer = document.createElement("div")
    mountContainer.className = "bespoke-container"
    shadowRoot.appendChild(mountContainer)

    const result = await module.mount(mountContainer, { variant, config })
    const dispose = typeof result === "function" ? result : undefined

    return { dispose }
}
