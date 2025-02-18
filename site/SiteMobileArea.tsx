import { useEffect, useRef } from "react"
import { SiteNavigationTopic } from "./SiteNavigationTopic.js"
import { TagGraphNode, getAllChildrenOfArea } from "@ourworldindata/utils"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"

export const SiteMobileArea = ({
    area,
    isActive,
    toggleArea,
}: {
    area: TagGraphNode
    isActive: boolean
    toggleArea: (area: TagGraphNode) => void
}) => {
    const areaRef = useRef<HTMLLIElement>(null)

    useEffect(() => {
        if (isActive && areaRef.current) {
            areaRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [isActive])

    return (
        <li key={area.slug} className="SiteMobileArea" ref={areaRef}>
            <SiteNavigationToggle
                ariaLabel={
                    isActive ? `Collapse ${area.name}` : `Expand ${area.name}`
                }
                isActive={isActive}
                onToggle={() => toggleArea(area)}
                dropdown={
                    <ul>
                        {getAllChildrenOfArea(area).map((topic) => (
                            <SiteNavigationTopic
                                key={topic.slug}
                                topic={topic}
                            />
                        ))}
                    </ul>
                }
                withCaret={true}
            >
                {area.name}
            </SiteNavigationToggle>
        </li>
    )
}
