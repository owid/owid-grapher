import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCompass, faLinkSlash } from "@fortawesome/free-solid-svg-icons"
import { ReactElement } from "react"

export function TagGraphMarker({
    variant,
    className,
}: {
    variant: "area" | "orphan"
    className: string
}): ReactElement {
    const isArea = variant === "area"
    return (
        <span
            className={className}
            title={
                isArea
                    ? "Top-level area used in site navigation"
                    : "Orphan tag that is not part of the tag graph"
            }
        >
            <FontAwesomeIcon icon={isArea ? faCompass : faLinkSlash} />
        </span>
    )
}
