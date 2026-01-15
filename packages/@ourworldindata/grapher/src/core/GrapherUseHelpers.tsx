import { debounce } from "lodash-es"
import { GrapherProgrammaticInterface, loadCatalogData } from "../index.js"
import * as Sentry from "@sentry/react"
import { createRoot } from "react-dom/client"
import { FetchingGrapher } from "./FetchingGrapher.js"
import {
    AdditionalGrapherDataFetchFn,
    ArchiveContext,
    CatalogKey,
} from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"

export function renderGrapherIntoContainer({
    config,
    container,
    dataApiUrl,
    catalogUrl,
    archiveContext,
    noCache,
}: {
    config: GrapherProgrammaticInterface
    container: Element
    dataApiUrl: string
    catalogUrl: string
    archiveContext?: ArchiveContext
    noCache?: boolean
}): void {
    const reactRoot = createRoot(container)

    const setBoundsFromContainerAndRender = (
        entries: ResizeObserverEntry[]
    ): void => {
        const entry = entries?.[0] // We always observe exactly one element
        if (!entry)
            throw new Error(
                "Couldn't resize grapher, expected exactly one ResizeObserverEntry"
            )

        // Don't bother rendering if the container is hidden
        // see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent
        if ((entry.target as HTMLElement).offsetParent === null) return

        const grapherConfigWithBounds = {
            ...config,
            additionalDataLoaderFn: (
                catalogKey: CatalogKey
            ): ReturnType<AdditionalGrapherDataFetchFn> =>
                loadCatalogData(catalogKey, { baseUrl: catalogUrl }),
        }

        reactRoot.render(
            <Sentry.ErrorBoundary>
                <FetchingGrapher
                    config={grapherConfigWithBounds}
                    dataApiUrl={dataApiUrl}
                    catalogUrl={catalogUrl}
                    archiveContext={archiveContext}
                    externalBounds={Bounds.fromRect(entry.contentRect)}
                    queryStr={grapherConfigWithBounds.queryStr}
                    noCache={noCache}
                />
            </Sentry.ErrorBoundary>
        )
    }

    if (typeof window !== "undefined" && "ResizeObserver" in window) {
        const resizeObserver = new ResizeObserver(
            // Use a leading debounce to render immediately upon first load, and also immediately upon orientation change on mobile
            debounce(setBoundsFromContainerAndRender, 400, {
                leading: true,
            })
        )
        resizeObserver.observe(container)
    } else if (typeof window === "object" && typeof document === "object") {
        // only show the warning when we're in something that roughly resembles a browser
        console.warn(
            "ResizeObserver not available; grapher will not be able to render"
        )
    }
}

export function renderSingleGrapherOnGrapherPage({
    config,
    dataApiUrl,
    catalogUrl,
    archiveContext,
    noCache,
    queryParams,
}: {
    config: GrapherProgrammaticInterface
    dataApiUrl: string
    catalogUrl: string
    archiveContext?: ArchiveContext
    noCache?: boolean
    queryParams?: URLSearchParams
}): void {
    const container = document.getElementsByTagName("figure")[0]
    const queryStrValue = queryParams
        ? `?${queryParams.toString()}`
        : window.location.search
    try {
        const enrichedConfig = {
            ...config,
            bindUrlToWindow: true,
            enableKeyboardShortcuts: true,
            queryStr: queryStrValue,
            archiveContext,
        }
        renderGrapherIntoContainer({
            config: enrichedConfig,
            container,
            dataApiUrl,
            catalogUrl,
            archiveContext,
            noCache,
        })
    } catch (err) {
        container.innerHTML = `<p>Unable to load interactive visualization</p>`
        container.setAttribute("id", "fallback")
        throw err
    }
}
