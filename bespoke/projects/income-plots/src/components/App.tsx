import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IncomePlot } from "./IncomePlot.tsx"
import {
    IncomePlotControlsRowBottom,
    IncomePlotControlsRowTop,
} from "./IncomePlotControlsRow.tsx"
import { IncomePlotDrawer } from "./IncomePlotDrawer.tsx"
import { useAtomValue, useSetAtom } from "jotai"
import { atomCurrentYear, atomisNarrow } from "../store.ts"
import { useResizeObserver, useWindowSize } from "usehooks-ts"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faGear } from "@fortawesome/free-solid-svg-icons"

export const App = () => {
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

    const aspectRatio = isNarrow && isPortrait ? 0.9 : 5 / 3

    const [drawerOpen, setDrawerOpen] = useState(false)
    const closeDrawer = useCallback(() => setDrawerOpen(false), [])

    return (
        <div ref={containerRef}>
            <IncomePlotControlsRowTop />
            <div
                style={{
                    width: "max-content",
                    maxWidth: width,
                    margin: "auto",
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
            </div>
            <IncomePlotControlsRowBottom isNarrow={isNarrow} />
            {isNarrow && (
                <>
                    <button
                        className="income-plot-drawer-trigger"
                        onClick={() => setDrawerOpen(true)}
                        aria-label="Open settings"
                    >
                        <FontAwesomeIcon icon={faGear} />
                        Settings
                    </button>
                    <IncomePlotDrawer
                        isOpen={drawerOpen}
                        onClose={closeDrawer}
                    />
                </>
            )}
        </div>
    )
}
