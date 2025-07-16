import { tippy } from "@tippyjs/react"
import type { Instance } from "tippy.js"
import { ADMIN_BASE_URL, BAKED_BASE_URL } from "../settings/clientSettings.js"
import { renderToStaticMarkup } from "react-dom/server"
import {
    ArchiveMetaInformation,
    DetailDictionary,
    fetchWithRetry,
    readFromAssetMap,
} from "@ourworldindata/utils"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { MarkdownTextWrap } from "@ourworldindata/components"
import urljoin from "url-join"

type Tippyfied<E> = E & {
    _tippy?: Instance
}

declare global {
    interface Window {
        details?: DetailDictionary
        _OWID_ARCHIVE_INFO?: ArchiveMetaInformation
    }
}

const siteAnalytics = new SiteAnalytics()

type RunDetailsOnDemandOptions = {
    shouldFetchFromAdminApi?: boolean
}
export async function runDetailsOnDemand(
    options: RunDetailsOnDemandOptions = {}
) {
    const { shouldFetchFromAdminApi = false } = options

    const runtimeAssetMap =
        (typeof window !== "undefined" &&
            window._OWID_ARCHIVE_INFO?.assets?.runtime) ||
        undefined

    const dodFetchUrl = shouldFetchFromAdminApi
        ? urljoin(ADMIN_BASE_URL, "admin/api/parsed-dods.json")
        : readFromAssetMap(runtimeAssetMap, {
              path: "dods.json",
              fallback: `${BAKED_BASE_URL}/dods.json`,
          })

    window.details = await fetchWithRetry(dodFetchUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
        },
    }).then((res) => res.json())

    document.addEventListener("mouseover", handleEvent, { passive: true })
    document.addEventListener("touchstart", handleEvent, { passive: true })

    function handleEvent(event: MouseEvent | TouchEvent) {
        const target = event.target as Tippyfied<Node>
        if (!(target instanceof Element)) return

        if (target.classList.contains("dod-span")) {
            const id = target.attributes.getNamedItem("data-id")?.nodeValue
            if (!id) return
            showDod(id, target)
            siteAnalytics.logDodShown(id)
        }
    }

    function showDod(id: string, element: Tippyfied<Element>) {
        const dod = window.details?.[id]
        if (!dod) return

        const content = renderToStaticMarkup(
            <div className="dod-container">
                <MarkdownTextWrap
                    text={dod.text}
                    fontSize={12}
                    lineHeight={1.55}
                />
            </div>
        )
        if (element._tippy) {
            element._tippy.show()
        } else {
            tippy(element, {
                content,
                allowHTML: true,
                // Add hide delay to allow users reaching the tooltip with
                // a mouse before it hides in tricky edge cases, e.g. when
                // the DOD spans multiple lines.
                delay: [null, 200],
                interactive: true,
                hideOnClick: false,
                arrow: false,
                theme: "light dod",
                appendTo: document.body,
                aria: {
                    content: "labelledby",
                },
            })
        }
    }
}
