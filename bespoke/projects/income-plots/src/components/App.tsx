import { Suspense, useEffect, useMemo, useRef } from "react"
import { IncomePlot } from "./IncomePlot.tsx"
import {
    IncomePlotControlsRowBottom,
    IncomePlotControlsRowTop,
} from "./IncomePlotControlsRow.tsx"
import { useAtomValue, useSetAtom } from "jotai"
import { atomCurrentYear, atomIsMobile } from "../store.ts"
import { useResizeObserver, useWindowSize } from "usehooks-ts"

export const App = () => {
    const currentYear = useAtomValue(atomCurrentYear)
    const containerRef = useRef<HTMLDivElement>(null)
    const { width = 0 } = useResizeObserver({
        ref: containerRef as React.RefObject<HTMLDivElement>,
    })

    const setIsMobile = useSetAtom(atomIsMobile)

    const isMobile = useMemo(() => !!(width && width < 720), [width])
    useEffect(() => {
        setIsMobile(isMobile)
    }, [isMobile, setIsMobile])

    const { height: windowHeight, width: windowWidth } = useWindowSize()
    const isPortrait = windowHeight >= windowWidth

    const aspectRatio = isMobile && isPortrait ? 0.9 : 5 / 3

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
                        isMobile={isMobile}
                    />
                </Suspense>
            </div>
            <IncomePlotControlsRowBottom isMobile={isMobile} />
        </div>
    )
}
