import tippy, { type Instance, type Props } from "tippy.js"
import type { DetailDictionary } from "@ourworldindata/utils"
import { MarkdownTextWrap } from "./MarkdownTextWrap/MarkdownTextWrap.js"
import { MarkdownTextWrapHtml } from "./MarkdownTextWrap/MarkdownTextWrapComponents.js"
import { reactRenderToStringClientOnly } from "./reactUtil.js"

declare global {
    interface Window {
        details?: DetailDictionary
    }
}

/** Tippy props shared by all DoD tooltips. */
export const DOD_TIPPY_PROPS: Partial<Props> = {
    allowHTML: true,
    // Add hide delay to allow users reaching the tooltip with a mouse before
    // it hides in tricky edge cases, e.g. when the DoD spans multiple lines.
    delay: [null, 200],
    interactive: true,
    hideOnClick: false,
    arrow: false,
    theme: "light dod",
    appendTo: () => document.body,
}

export function renderDodContentHtml(text: string): string {
    const markdownTextWrap = new MarkdownTextWrap({
        text,
        fontSize: 12,
        lineHeight: 1.55,
    })
    return reactRenderToStringClientOnly(
        <div className="dod-container">
            <MarkdownTextWrapHtml textWrap={markdownTextWrap} />
        </div>
    )
}

export type InitializeDetailsOnDemandOptions = {
    details: DetailDictionary
    onDodShown?: (id: string) => void
}

let cleanupPreviousInitialization: (() => void) | undefined

/**
 * Makes the DoD spans on the page show their tooltip on hover or touch.
 *
 * Calling this again replaces a previous initialization. Returns a cleanup
 * function for callers that don't live as long as the page, e.g. admin
 * components.
 */
export function initializeDetailsOnDemand({
    details,
    onDodShown,
}: InitializeDetailsOnDemandOptions): () => void {
    cleanupPreviousInitialization?.()

    // Grapher reads the details from here when rendering static exports
    window.details = details

    const instancesByDodSpan = new Map<Element, Instance>()

    document.addEventListener("mouseover", handleEvent, { passive: true })
    document.addEventListener("touchstart", handleEvent, { passive: true })

    function handleEvent(event: MouseEvent | TouchEvent): void {
        const target = event.target
        if (!(target instanceof Element)) return
        if (!target.classList.contains("dod-span")) return

        const id = target.getAttribute("data-id")
        if (id) showDod(id, target)
    }

    function showDod(id: string, dodSpan: Element): void {
        const existingInstance = instancesByDodSpan.get(dodSpan)
        if (existingInstance) {
            existingInstance.show()
            return
        }

        const dod = details[id]
        if (!dod) return

        const instance = tippy(dodSpan, {
            ...DOD_TIPPY_PROPS,
            content: renderDodContentHtml(dod.text),
            aria: {
                content: "labelledby",
            },
            onShow: () => {
                hideDodsNotContaining(dodSpan)
                onDodShown?.(id)
            },
        })
        instancesByDodSpan.set(dodSpan, instance)
    }

    /** Hides all open DoDs except the ones the given DoD span is nested in. */
    function hideDodsNotContaining(dodSpan: Element): void {
        for (const instance of instancesByDodSpan.values()) {
            if (instance.state.isVisible && !instance.popper.contains(dodSpan))
                instance.hide()
        }
    }

    function cleanupDetailsOnDemand(): void {
        document.removeEventListener("mouseover", handleEvent)
        document.removeEventListener("touchstart", handleEvent)
        for (const instance of instancesByDodSpan.values()) instance.destroy()
        instancesByDodSpan.clear()
    }

    cleanupPreviousInitialization = cleanupDetailsOnDemand
    return cleanupDetailsOnDemand
}
