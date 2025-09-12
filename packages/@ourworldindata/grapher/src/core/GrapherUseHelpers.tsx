import { Bounds } from "@ourworldindata/utils"
import { debounce } from "lodash-es"
import { GrapherProgrammaticInterface } from "../index.js"
import * as Sentry from "@sentry/react"
import { FetchingGrapher } from "./FetchingGrapher.js"
import {
    ArchiveContext,
    OwidVariableDataMetadataDimensions,
    OwidVariableId,
} from "@ourworldindata/types"
import { loadVariableDataAndMetadata } from "./loadVariable.js"
import { createRoot } from "react-dom/client"

export function renderGrapherIntoContainer(
    config: GrapherProgrammaticInterface,
    containerNode: Element,
    dataApiUrl: string,
    {
        archiveContext,
        noCache,
    }: { archiveContext?: ArchiveContext; noCache?: boolean } = {}
): void {
    const reactRoot = createRoot(containerNode)

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
                varId: OwidVariableId
            ): Promise<OwidVariableDataMetadataDimensions> =>
                loadVariableDataAndMetadata(varId, dataApiUrl, { noCache }),
        }

        reactRoot.render(
            <Sentry.ErrorBoundary>
                <FetchingGrapher
                    config={grapherConfigWithBounds}
                    dataApiUrl={dataApiUrl}
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
        resizeObserver.observe(containerNode)
    } else if (
        typeof window === "object" &&
        typeof document === "object" &&
        !navigator.userAgent.includes("jsdom")
    ) {
        // only show the warning when we're in something that roughly resembles a browser
        console.warn(
            "ResizeObserver not available; grapher will not be able to render"
        )
    }
}

export function renderSingleGrapherOnGrapherPage(
    jsonConfig: GrapherProgrammaticInterface,
    dataApiUrl: string,
    {
        archiveContext,
        noCache,
    }: { archiveContext?: ArchiveContext; noCache?: boolean } = {}
): void {
    const container = document.getElementsByTagName("figure")[0]
    try {
        renderGrapherIntoContainer(
            {
                ...jsonConfig,
                bindUrlToWindow: true,
                enableKeyboardShortcuts: true,
                queryStr: window.location.search,
                archiveContext,
            },
            container,
            dataApiUrl,
            { archiveContext, noCache }
        )
    } catch (err) {
        container.innerHTML = `<p>Unable to load interactive visualization</p>`
        container.setAttribute("id", "fallback")
        throw err
    }
}
