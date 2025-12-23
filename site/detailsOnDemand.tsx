import { tippy } from "@tippyjs/react"
import type { Instance } from "tippy.js"
import { ADMIN_BASE_URL, BAKED_BASE_URL } from "../settings/clientSettings.js"
import {
    ArchiveMetaInformation,
    DetailDictionary,
    fetchWithRetry,
    readFromAssetMap,
} from "@ourworldindata/utils"
import { SiteAnalytics } from "./SiteAnalytics.js"
import {
    MarkdownTextWrap,
    reactRenderToStringClientOnly,
} from "@ourworldindata/components"
import urljoin from "url-join"

type Tippyfied<E> = E & {
    _tippy?: Instance
}

declare global {
    interface Window {
        details?: DetailDictionary
        _OWID_ARCHIVE_CONTEXT?: ArchiveMetaInformation
    }
}

const siteAnalytics = new SiteAnalytics()
let listenersAttached = false

const showDod = (id: string, element: Tippyfied<Element>): void => {
    const dod = window.details?.[id]
    if (!dod) return

    if (element._tippy) {
        element._tippy.show()
    } else {
        const content = reactRenderToStringClientOnly(
            <div className="dod-container">
                <MarkdownTextWrap
                    text={dod.text}
                    fontSize={12}
                    lineHeight={1.55}
                />
            </div>
        )

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

const handleEvent = (event: MouseEvent | TouchEvent): void => {
    const target = event.target as Tippyfied<Node>
    if (!(target instanceof Element)) return

    if (target.classList.contains("dod-span")) {
        const id = target.attributes.getNamedItem("data-id")?.nodeValue
        if (!id) return
        showDod(id, target)
        siteAnalytics.logDodShown(id)
    }
}

const attachListeners = (): void => {
    if (listenersAttached) return
    document.addEventListener("mouseover", handleEvent, { passive: true })
    document.addEventListener("touchstart", handleEvent, { passive: true })
    listenersAttached = true
}

type RunDetailsOnDemandOptions = {
    shouldFetchFromAdminApi?: boolean
}

export function runDetailsOnDemandWithDetails(details: DetailDictionary): void {
    window.details = details
    attachListeners()
}

export async function runDetailsOnDemand(
    options: RunDetailsOnDemandOptions = {}
) {
    const { shouldFetchFromAdminApi = false } = options

    const runtimeAssetMap =
        (typeof window !== "undefined" &&
            window._OWID_ARCHIVE_CONTEXT?.assets?.runtime) ||
        undefined

    const dodFetchUrl = shouldFetchFromAdminApi
        ? urljoin(ADMIN_BASE_URL, "admin/api/parsed-dods.json")
        : readFromAssetMap(runtimeAssetMap, {
              path: "dods.json",
              fallback: `${BAKED_BASE_URL}/dods.json`,
          })

    const details = await fetchWithRetry(dodFetchUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
        },
    }).then((res) => res.json())

    runDetailsOnDemandWithDetails(details)
}
