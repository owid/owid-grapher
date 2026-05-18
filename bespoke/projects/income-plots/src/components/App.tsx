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

export const App = () => {
    const shadowRoot = useShadowRoot()
    useAtom(atomEffectIncludeLocalCountryInSelection) // include local country in selection once the local country is detected

    const currentYear = useAtomValue(atomCurrentYear)
    const containerRef = useRef<HTMLDivElement>(null)
    const { width = 0 } = useResizeObserver({
        ref: containerRef as React.RefObject<HTMLDivElement>,
    })

    const setisNarrow = useSetAtom(atomisNarrow)

    const isNarrow = useMemo(() => !!(width && width < 720), [width])
    useEffect(() => {
        setisNarrow(isNarrow)
    }, [isNarrow, setisNarrow])

    const { height: windowHeight, width: windowWidth } = useWindowSize()
    const isPortrait = windowHeight >= windowWidth

    const aspectRatio = isNarrow && isPortrait ? 1.1 : 5 / 3

    const [drawerOpen, setDrawerOpen] = useState(false)
    const closeDrawer = useCallback(() => setDrawerOpen(false), [])

    return (
        <UNSAFE_PortalProvider
            getContainer={shadowRoot ? () => shadowRoot : undefined}
        >
            <Frame className="income-plot-captioned-chart">
                <ChartHeader
                    className="income-plot-header"
                    title={`Global income distribution in ${currentYear}`}
                    subtitle="Income or consumption per person, adjusted for price differences between countries and inflation."
                />
                <div ref={containerRef}>
                    <IncomePlotControlsRowTop
                        isNarrow={isNarrow}
                        onOpenSettings={() => setDrawerOpen(true)}
                    />
                    <div
                        className="income-plot-captioned-chart__chart-area"
                        style={{
                            width: "max-content",
                            maxWidth: width,
                            aspectRatio: aspectRatio,
                        }}
                    >
                        <Suspense fallback={<>Loading...</>}>
                            <IncomePlot
                                key={currentYear}
                                width={width}
                                aspectRatio={aspectRatio}
                                isNarrow={isNarrow}
                            />
                        </Suspense>
                        {!isNarrow && <IncomePlotControlsRowBottom />}
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
                    source="World Bank Poverty and Inequality Platform (PIP), via Our World in Data"
                />
            </Frame>
        </UNSAFE_PortalProvider>
    )
}
