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

export const App = () => {
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
        <div ref={containerRef}>
            <IncomePlotControlsRowTop
                isNarrow={isNarrow}
                onOpenSettings={() => setDrawerOpen(true)}
            />
            <div
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
                <IncomePlotDrawer isOpen={drawerOpen} onClose={closeDrawer} />
            )}
        </div>
    )
}
