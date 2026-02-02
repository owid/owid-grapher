import { tippy } from "@tippyjs/react"
import type { Instance } from "tippy.js"
import { PROVIDER_INFO } from "./ProviderInfo.js"

type Tippyfied<E> = E & { _tippy?: Instance }

let initialized = false

/**
 * Initialize provider info tooltips using document-level event delegation.
 * Safe to call multiple times - only initializes once.
 * Follows the same pattern as detailsOnDemand.tsx.
 */
export function ensureProviderInfoTooltipsInitialized(): void {
    if (initialized) return
    initialized = true

    document.addEventListener("mouseover", handleEvent, { passive: true })
    document.addEventListener("touchstart", handleEvent, { passive: true })

    function handleEvent(event: MouseEvent | TouchEvent): void {
        const target = event.target as Tippyfied<Node>
        if (!(target instanceof Element)) return

        // Look for provider suffix hit area with data-provider-code attribute
        const hitArea = target.closest(
            "[data-provider-code]"
        ) as Tippyfied<Element> | null
        if (!hitArea) return

        const providerCode = hitArea.getAttribute("data-provider-code")
        if (providerCode) {
            showProviderTooltip(providerCode, hitArea)
        }
    }

    function showProviderTooltip(
        providerCode: string,
        element: Tippyfied<Element>
    ): void {
        const provider = PROVIDER_INFO[providerCode]
        if (!provider) return

        if (element._tippy) {
            element._tippy.show()
        } else {
            tippy(element, {
                content: `
                    <div class="provider-info-tooltip">
                        <strong>${provider.name}</strong>
                        <p>${provider.description}</p>
                    </div>
                `,
                allowHTML: true,
                showOnCreate: true,
                delay: [null, 200],
                interactive: true,
                hideOnClick: false,
                arrow: false,
                theme: "light provider-info",
                appendTo: document.body,
            })
        }
    }
}
