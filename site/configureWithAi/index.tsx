import {
    lazy,
    Suspense,
    useMemo,
    useState,
    type ComponentProps,
    type ReactNode,
} from "react"
import {
    GrapherState,
    GuidedChartContext,
    type GuidedChartContextValue,
} from "@ourworldindata/grapher"

// "Configure with AI" prototype (staging only): the only module data pages
// import. The box itself, its styles and its helpers load in a separate chunk,
// and only once a page decides to show it (admins, or anyone on staging).

const LazyForGrapher = lazy(() =>
    import("./ConfigureWithAiForPage.js").then((m) => ({
        default: m.ConfigureWithAiForGrapher,
    }))
)
const LazyForMdim = lazy(() =>
    import("./ConfigureWithAiForPage.js").then((m) => ({
        default: m.ConfigureWithAiForMdim,
    }))
)

/**
 * Wraps a single-chart data page's Grapher and shows the box above it. The
 * Grapher registers its state through GuidedChartContext, which is how the box
 * gets to drive it.
 */
export function WithConfigureWithAi({
    slug,
    children,
}: {
    slug: string
    children: ReactNode
}) {
    const [grapherState, setGrapherState] = useState<GrapherState | null>(null)
    const context: GuidedChartContextValue = useMemo(
        () => ({
            registerGrapherState: (state) => {
                setGrapherState(state)
                return () =>
                    setGrapherState((current) =>
                        current === state ? null : current
                    )
            },
        }),
        []
    )
    return (
        <>
            {grapherState?.showAdminControls && (
                <Suspense fallback={null}>
                    <LazyForGrapher slug={slug} grapherState={grapherState} />
                </Suspense>
            )}
            <GuidedChartContext.Provider value={context}>
                {children}
            </GuidedChartContext.Provider>
        </>
    )
}

/** The box on an MDim data page; the page decides when to render it */
export function ConfigureWithAiForMdim(
    props: ComponentProps<typeof LazyForMdim>
) {
    return (
        <Suspense fallback={null}>
            <LazyForMdim {...props} />
        </Suspense>
    )
}
