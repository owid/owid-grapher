import React, { useState, useCallback, ReactNode } from "react"
import { AriaAnnouncerContext } from "./AriaAnnouncerUtils.js"

export const AriaAnnouncerProvider: React.FC<{ children: ReactNode }> = ({
    children,
}) => {
    const [announcement, setAnnouncement] = useState("")

    const announce = useCallback((message: string) => {
        setTimeout(() => {
            setAnnouncement(message)
            setTimeout(() => {
                setAnnouncement("")
            }, 2000)
        }, 100)
    }, [])

    return (
        <AriaAnnouncerContext.Provider value={{ announce, announcement }}>
            {children}
        </AriaAnnouncerContext.Provider>
    )
}
