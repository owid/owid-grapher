import React from "react"
import { useAriaAnnouncer } from "./AriaAnnouncerUtils.js"

export const AriaAnnouncer: React.FC = () => {
    const { announcement } = useAriaAnnouncer()

    return (
        <div
            className="aria-announcer"
            aria-live="assertive"
            aria-atomic="true"
            role="status"
            style={{
                position: "absolute",
                left: "-10000px",
                width: "1px",
                height: "1px",
                overflow: "hidden",
            }}
        >
            {announcement}
        </div>
    )
}
