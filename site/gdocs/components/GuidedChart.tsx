import { EnrichedBlockGuidedChart } from "@ourworldindata/types"
import { Container } from "./layout.js"
import { useRef, useEffect, useState } from "react"
import { strToQueryParams, Url } from "@ourworldindata/utils"
import { ArticleBlocks } from "./ArticleBlocks.js"
import { ChartStateContext, GrapherState } from "@ourworldindata/grapher"

export default function GuidedChart({
    d,
    containerType = "default",
}: {
    d: EnrichedBlockGuidedChart
    containerType?: Container
}) {
    const stateRef = useRef<GrapherState | null>(null)
    const guidedChartContainerRef = useRef<HTMLDivElement>(null)
    const [lastUnguidedState, setLastUnguidedState] = useState("")
    const [isStateGuided, setIsStateGuided] = useState(false)

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            if (!stateRef.current) return

            const target = event.target as HTMLElement
            const anchor = target.closest(
                "a.guided-chart-link"
            ) as HTMLAnchorElement

            if (anchor) {
                event.preventDefault()

                const isActive = anchor.classList.contains("active")
                const href = anchor.getAttribute("href")

                // Remove active class from any previously active links
                const currentlyActive =
                    guidedChartContainerRef.current?.querySelector(
                        "a.guided-chart-link.active"
                    )
                if (currentlyActive && currentlyActive !== anchor) {
                    currentlyActive.classList.remove("active")
                }

                if (isActive) {
                    // If the button is already active, reset to unguided state
                    if (lastUnguidedState === "") {
                        stateRef.current.clearQueryParams()
                    } else {
                        stateRef.current.populateFromQueryParams(
                            strToQueryParams(lastUnguidedState)
                        )
                    }
                    anchor.classList.remove("active")
                    setIsStateGuided(false)
                } else if (href) {
                    // Save current state if transitioning from unguided to guided
                    if (!isStateGuided) {
                        setLastUnguidedState(stateRef.current.queryStr)
                        setIsStateGuided(true)
                    }

                    // Apply the new guided state
                    stateRef.current.populateFromQueryParams(
                        Url.fromURL(href).queryParams
                    )
                    anchor.classList.add("active")
                }
            }
        }

        const container = guidedChartContainerRef.current
        if (container) {
            container.addEventListener("click", handleClick)
        }

        // Cleanup
        return () => {
            if (container) {
                container.removeEventListener("click", handleClick)
            }
        }
    }, [lastUnguidedState, isStateGuided])

    return (
        <ChartStateContext.Provider
            value={stateRef as React.RefObject<GrapherState>}
        >
            <div
                ref={guidedChartContainerRef}
                className="grid grid-cols-12-full-width span-cols-14"
            >
                <ArticleBlocks
                    blocks={d.content}
                    containerType={containerType}
                />
            </div>
        </ChartStateContext.Provider>
    )
}
