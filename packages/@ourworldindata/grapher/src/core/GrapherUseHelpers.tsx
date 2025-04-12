import { Bounds } from "@ourworldindata/utils"
import { debounce } from "lodash"
import ReactDOM from "react-dom"
import { GrapherProgrammaticInterface } from "../index.js"
import * as Sentry from "@sentry/react"
import { FetchingGrapher } from "./FetchingGrapher.js"
import { ArchivedChartOrArchivePageMeta } from "@ourworldindata/types/dist/domainTypes/Archive.js"

export function renderGrapherIntoContainer(
    config: GrapherProgrammaticInterface,
    containerNode: Element,
    dataApiUrl: string,
    {
        archivedChartInfo,
    }: { archivedChartInfo?: ArchivedChartOrArchivePageMeta } = {}
): void {
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
            bounds: Bounds.fromRect(entry.contentRect),
        }

        ReactDOM.render(
            <Sentry.ErrorBoundary>
                <FetchingGrapher
                    config={grapherConfigWithBounds}
                    dataApiUrl={dataApiUrl!}
                    archivedChartInfo={archivedChartInfo}
                />
            </Sentry.ErrorBoundary>,
            containerNode
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
        archivedChartInfo,
    }: { archivedChartInfo?: ArchivedChartOrArchivePageMeta } = {}
): void {
    const container = document.getElementsByTagName("figure")[0]
    try {
        renderGrapherIntoContainer(
            {
                ...jsonConfig,
                bindUrlToWindow: true,
                enableKeyboardShortcuts: true,
                queryStr: window.location.search,
                archivedChartInfo,
            },
            container,
            dataApiUrl,
            { archivedChartInfo }
        )
    } catch (err) {
        container.innerHTML = `<p>Unable to load interactive visualization</p>`
        container.setAttribute("id", "fallback")
        throw err
    }
}
