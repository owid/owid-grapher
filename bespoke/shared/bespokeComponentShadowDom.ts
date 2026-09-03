import type { BespokeComponentModule } from "./bespokeComponentTypes.ts"

/**
 * Mount a bespoke component into a shadow DOM container.
 *
 * Creates (or reuses) a shadow root on the given element, dynamically imports
 * the JS module, and calls its `mount` function.
 *
 * Returns a dispose function that cleans up the mounted component.
 * Respects the provided AbortSignal to cancel mid-flight.
 */
export async function mountBespokeComponentInShadow({
    container,
    scriptUrl,
    variant,
    config,
    signal,
}: {
    container: HTMLDivElement
    scriptUrl: string
    variant?: string
    config?: Record<string, string>
    signal?: AbortSignal
}): Promise<{ dispose?: () => void }> {
    let shadowRoot = container.shadowRoot
    if (!shadowRoot) {
        shadowRoot = container.attachShadow({ mode: "open" })
    }
    shadowRoot.replaceChildren()

    const module = (await import(
        /* @vite-ignore */
        scriptUrl
    )) as BespokeComponentModule

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
