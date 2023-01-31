import { SiteFooterContext } from "@ourworldindata/utils/dist/owidTypes.js"
import React, { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { runSiteFooterScripts } from "../site/runSiteFooterScripts.js"

export const GdocsPreviewIframe = ({
    children,
    head,
    ...props
}: {
    children: React.ReactNode
    head?: React.ReactNode
} & React.IframeHTMLAttributes<HTMLIFrameElement>) => {
    const iframeRef = useRef<HTMLIFrameElement>(null)

    const mountNodeHead = iframeRef?.current?.contentWindow?.document.head
    const mountNodeBody = iframeRef?.current?.contentWindow?.document.body

    useEffect(() => {
        runSiteFooterScripts({
            context: SiteFooterContext.gdocsPreview,
            container: mountNodeBody,
        })
    }, [children, mountNodeBody])

    return (
        <iframe {...props} ref={iframeRef}>
            {mountNodeHead && createPortal(head, mountNodeHead)}
            {mountNodeBody && createPortal(children, mountNodeBody)}
        </iframe>
    )
}
