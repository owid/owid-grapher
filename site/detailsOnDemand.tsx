import React from "react"
import { tippy } from "@tippyjs/react"
import { Instance } from "tippy.js"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { renderToStaticMarkup } from "react-dom/server.js"
import { ArticleBlocks } from "./gdocs/ArticleBlocks.js"
import { DetailDictionary } from "@ourworldindata/utils"

type Tippyfied<E> = E & {
    _tippy?: Instance
}

declare global {
    interface Window {
        details?: DetailDictionary
    }
}

export async function runDetailsOnDemand() {
    const details: DetailDictionary = await fetch(
        `${BAKED_BASE_URL}/dods.json`
    ).then((res) => res.json())

    window.details = details

    document.addEventListener("mouseover", handleEvent, { passive: true })
    document.addEventListener("touchstart", handleEvent, { passive: true })

    function handleEvent(event: MouseEvent | TouchEvent) {
        const target = event.target as Tippyfied<Element>
        if (target?.classList.contains("dod-span")) {
            showDod(target)
        }
    }

    function showDod(element: Tippyfied<Element>) {
        const id = element.attributes.getNamedItem("data-id")?.nodeValue
        if (!id) return
        const dod = window.details?.[id]
        if (!dod) return

        const content = renderToStaticMarkup(
            <div className="dod-container">
                <ArticleBlocks blocks={dod.text} />
            </div>
        )
        if (element._tippy) {
            element._tippy.show()
        } else {
            tippy(element, {
                content,
                allowHTML: true,
                interactive: true,
                hideOnClick: false,
                arrow: false,
                theme: "light dod",
                appendTo: document.body,
            })
        }
    }
}
