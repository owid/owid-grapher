import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { IncomePlot } from "./IncomePlot.tsx"
import {
    IncomePlotControlsRowBottom,
    IncomePlotControlsRowTop,
} from "./IncomePlotControlsRow.tsx"
import { IncomePlotDrawer } from "./IncomePlotDrawer.tsx"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
    atomCurrentTab,
    atomCurrentYear,
    atomEffectIncludeLocalCountryInSelection,
    atomisNarrow,
} from "../store.ts"
import { useResizeObserver, useWindowSize } from "usehooks-ts"
import { UNSAFE_PortalProvider } from "react-aria"
import { useShadowRoot } from "../ShadowRootContext.tsx"
import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { LoadingIndicator } from "@ourworldindata/components"
import {
    getIncomePlotTitle,
    INCOME_PLOT_SOURCE,
    INCOME_PLOT_SUBTITLE,
} from "../utils/incomePlotMetadata.ts"

export const App = ({ tab }: { tab?: "global" | "countries" }) => {
    const shadowRoot = useShadowRoot()
    useAtom(atomEffectIncludeLocalCountryInSelection) // include local country in selection once the local country is detected

    const setCurrentTab = useSetAtom(atomCurrentTab)
    useEffect(() => {
        if (tab === "global" || tab === "countries") {
            setCurrentTab(tab)
        }
    }, [tab, setCurrentTab])

    const currentYear = useAtomValue(atomCurrentYear)
    const containerRef = useRef<HTMLDivElement>(null)
    const bottomControlsRef = useRef<HTMLDivElement>(null)
    const { width = 0 } = useResizeObserver({
        ref: containerRef as React.RefObject<HTMLDivElement>,
    })
    const { height: bottomControlsHeight = 0 } = useResizeObserver({
        ref: bottomControlsRef as React.RefObject<HTMLDivElement>,
    })

    const setisNarrow = useSetAtom(atomisNarrow)

    const isNarrow = useMemo(() => !!(width && width < 720), [width])
    useEffect(() => {
        setisNarrow(isNarrow)
    }, [isNarrow, setisNarrow])

    const { height: windowHeight, width: windowWidth } = useWindowSize()
    const isPortrait = windowHeight >= windowWidth

    const aspectRatio = isNarrow && isPortrait ? 1.1 : 5 / 3
    const plotHeight = useMemo(() => {
        const targetChartAreaHeight = width / aspectRatio
        const controlsHeight = isNarrow ? 0 : bottomControlsHeight
        return Math.max(targetChartAreaHeight - controlsHeight, 1)
    }, [aspectRatio, bottomControlsHeight, isNarrow, width])

    const [drawerOpen, setDrawerOpen] = useState(false)
    const closeDrawer = useCallback(() => setDrawerOpen(false), [])

    return (
        <UNSAFE_PortalProvider
            getContainer={shadowRoot ? () => shadowRoot : undefined}
        >
            <Frame className="income-plot-captioned-chart">
                <ChartHeader
                    className="income-plot-header"
                    title={getIncomePlotTitle(currentYear)}
                    subtitle={INCOME_PLOT_SUBTITLE}
                />
                <div ref={containerRef}>
                    <IncomePlotControlsRowTop
                        isNarrow={isNarrow}
                        onOpenSettings={() => setDrawerOpen(true)}
                    />
                    <div
                        className="income-plot-captioned-chart__chart-area"
                        style={{
                            aspectRatio: aspectRatio,
                        }}
                    >
                        <Suspense
                            fallback={
                                <div
                                    className="income-plot-loading"
                                    style={{ height: plotHeight }}
                                >
                                    <LoadingIndicator
                                        title="Loading income distributions"
                                        color="#5b5b5b"
                                    />
                                </div>
                            }
                        >
                            <IncomePlot
                                key={currentYear}
                                height={plotHeight}
                                width={width}
                                isNarrow={isNarrow}
                                tab={tab}
                            />
                        </Suspense>
                        {!isNarrow && (
                            <div
                                ref={bottomControlsRef}
                                className="income-plot-captioned-chart__bottom-controls"
                            >
                                <IncomePlotControlsRowBottom />
                            </div>
                        )}
                    </div>
                    {isNarrow && (
                        <IncomePlotDrawer
                            isOpen={drawerOpen}
                            onClose={closeDrawer}
                        />
                    )}
                </div>
                <ChartFooter
                    className="income-plot-footer"
                    source={INCOME_PLOT_SOURCE}
                />
            </Frame>
        </UNSAFE_PortalProvider>
    )
}
