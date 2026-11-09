import { useEffect, useEffectEvent, useRef, useState } from "react"
import { runInAction } from "mobx"
import type { GrapherState } from "@ourworldindata/grapher"
import type { MdimPage, SidePanel } from "./ConfigureWithAiForPage.js"
import { sharedQueryFromUrl } from "./sharedQuery.js"

type LoadedChunk = typeof import("./ConfigureWithAiForPage.js")

/**
 * Loads the chunk and installs the side panel on `grapherState`, for admins
 * and anyone on staging. The panel is installed only after the chunk has
 * loaded, so a failed load (e.g. after a deploy replaced the assets) leaves
 * the page as it was.
 */
export function useSidePanel(
    grapherState: GrapherState | null,
    create: (
        chunk: LoadedChunk,
        grapherState: GrapherState,
        sharedQuery: string | null
    ) => SidePanel
): SidePanel | null {
    const [panel, setPanel] = useState<SidePanel | null>(null)
    const onLoaded = useEffectEvent(create)
    // Read as the page first renders, before an MDim page rewrites the URL;
    // only the first panel installed asks it
    const sharedQuery = useRef(sharedQueryFromUrl())
    // Not `!archiveContext`: live pages of archived charts carry one too,
    // pointing at their latest archived version
    const isEligible =
        !!grapherState?.showAdminControls && !grapherState.isOnArchivalPage

    useEffect(() => {
        if (!grapherState || !isEligible) return
        let isCancelled = false
        let installed: SidePanel | null = null
        import("./ConfigureWithAiForPage.js")
            .then((chunk) => {
                if (isCancelled) return
                const created = onLoaded(
                    chunk,
                    grapherState,
                    sharedQuery.current
                )
                sharedQuery.current = null
                installed = created
                runInAction(() => {
                    grapherState.sidePanelRenderer = created.renderer
                })
                setPanel(created)
            })
            .catch((error) =>
                console.warn("Configure with AI didn't load", error)
            )
        return () => {
            isCancelled = true
            if (
                installed &&
                grapherState.sidePanelRenderer === installed.renderer
            )
                runInAction(() => {
                    grapherState.sidePanelRenderer = undefined
                })
            setPanel(null)
        }
    }, [grapherState, isEligible])

    return panel
}

/** Installs the side panel on an MDim data page's Grapher */
export function useConfigureWithAiOnMdim(
    page: Omit<MdimPage, "grapherState"> & {
        grapherState: GrapherState | null
        /** True while the page loads another view */
        isBusy: boolean
    }
): void {
    // The page's callbacks change on every render; the panel calls the latest
    const pageRef = useRef(page)
    useEffect(() => {
        pageRef.current = page
    })
    const panel = useSidePanel(
        page.grapherState,
        (chunk, grapherState, sharedQuery) =>
            chunk.createMdimSidePanel(
                {
                    slug: page.slug,
                    grapherState,
                    getChoices: () => pageRef.current.getChoices(),
                    switchView: (choices, params) =>
                        pageRef.current.switchView(choices, params),
                },
                sharedQuery
            )
    )
    useEffect(() => {
        panel?.store.setBusy(page.isBusy)
    }, [panel, page.isBusy])
}
