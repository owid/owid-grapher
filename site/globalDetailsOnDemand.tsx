import React from "react"
import { tippy } from "@tippyjs/react"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { renderToStaticMarkup } from "react-dom/server.js"
import { EnrichedBlockText } from "@ourworldindata/utils/dist/owidTypes.js"
import { ArticleBlocks } from "./gdocs/ArticleBlocks.js"

export async function runGlobalDetailsOnDemand() {
    const details = await fetch(`${BAKED_BASE_URL}/dods.json`, {
        method: "GET",
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
        },
    }).then((res) => res.json())

    ;(window as any).details = details

    document.addEventListener("mouseover", handleEvent)
    document.addEventListener("touchstart", handleEvent)

    // hack to initialize tippy
    const body = document.body as any
    tippy(body)
    body._tippy.show()

    function handleEvent(event: MouseEvent | TouchEvent) {
        const target = event.target as Element
        if (target?.classList.contains("dod-span")) {
            showDod(target)
        }
    }

    function showDod(element: Element) {
        const id = element.attributes.getNamedItem("data-id")?.nodeValue
        if (!id) return
        const dod: { id: string; text: EnrichedBlockText[] } = (window as any)
            .details[id]
        if (!dod) return

        const content = renderToStaticMarkup(
            <div className="global-dod">
                <ArticleBlocks blocks={dod.text} />
            </div>
        )
        if ((element as any)._tippy) {
            ;(element as any)._tippy.show()
        } else {
            tippy(element, {
                content,
                allowHTML: true,
                interactive: true,
                hideOnClick: false,
                arrow: false,
                theme: "light",
            })
        }
    }
}
