import {
    BESPOKE_COMPONENT_REGISTRY,
    BespokeComponentModule,
} from "./bespokeComponentRegistry.js"

/**
 * Hydrates all bespoke components on the page.
 * Finds elements with [data-bespoke-bundle], looks up their definition
 * in the registry, creates a shadow root, loads CSS, and mounts the component.
 */
export async function hydrateBespokeComponents(): Promise<void> {
    const elements = document.querySelectorAll<HTMLElement>(
        "[data-bespoke-bundle]"
    )

    const hydrationPromises = Array.from(elements).map((element) =>
        hydrateSingleComponent(element)
    )

    await Promise.all(hydrationPromises)
}

async function hydrateSingleComponent(element: HTMLElement): Promise<void> {
    const bundle = element.dataset.bespokeBundle
    if (!bundle) return

    const variant = element.dataset.bespokeVariant

    const definition = BESPOKE_COMPONENT_REGISTRY[bundle]
    if (!definition) {
        renderError(element, `Unknown bespoke bundle: "${bundle}"`)
        return
    }

    try {
        const shadowRoot = element.attachShadow({ mode: "open" })

        // Load CSS into shadow root
        await loadCssIntoShadow(shadowRoot, definition.cssUrls)

        // Create a container div inside the shadow root for the component to render into
        const container = document.createElement("div")
        container.className = "bespoke-container"
        shadowRoot.appendChild(container)

        // Dynamically import the ESM module
        const module = (await import(
            /* webpackIgnore: true */ definition.scriptUrl
        )) as BespokeComponentModule

        if (typeof module.mount !== "function") {
            renderError(
                element,
                `Bespoke bundle "${bundle}" does not export a mount function`
            )
            return
        }

        // Parse the config from data attribute
        const configStr = element.dataset.bespokeConfig
        const config: Record<string, unknown> = configStr
            ? JSON.parse(configStr)
            : {}

        // Mount the component into the container (Shadow DOM is an implementation detail)
        module.mount(container, { config, variant })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        renderError(
            element,
            `Failed to load bespoke bundle "${bundle}": ${message}`
        )
        console.error(`Failed to hydrate bespoke bundle "${bundle}":`, error)
    }
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

function renderError(element: HTMLElement, message: string): void {
    // Clear any existing shadow root content or create one
    let shadowRoot = element.shadowRoot
    if (!shadowRoot) {
        shadowRoot = element.attachShadow({ mode: "open" })
    }

    shadowRoot.innerHTML = `
        <style>
            .bespoke-error {
                padding: 16px;
                background-color: #fee2e2;
                border: 1px solid #ef4444;
                border-radius: 4px;
                color: #991b1b;
                font-family: system-ui, sans-serif;
                font-size: 14px;
            }
        </style>
        <div class="bespoke-error">
            ${escapeHtml(message)}
        </div>
    `
}

function escapeHtml(text: string): string {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
}
