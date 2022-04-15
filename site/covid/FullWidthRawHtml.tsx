import React, { useEffect, useState } from "react"

export const RawHtml = ({ url }: { url: string }) => {
    const [html, setHtml] = useState<null | string>(null)
    useEffect(() => {
        const fetchHtml = async () => {
            if (!url) return
            const response = await fetch(url)
            if (!response.ok) return
            setHtml(await response.text())
        }
        fetchHtml()
    }, [])

    return html && <div dangerouslySetInnerHTML={{ __html: html }}></div>
}

export const FullWidthRawHtml = RawHtml
