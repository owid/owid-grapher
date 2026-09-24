import { useEffect, useState, useCallback, useRef } from "react"

/**
 * A swipe nudge that waits before appearing, then dismisses itself.
 *
 * Waiting matters: at page load the reader is looking at the chart arriving,
 * and a nudge shown then is gone before they'd have thought to swipe. Showing
 * it a few seconds in catches the moment they've taken in the first view and
 * are deciding whether to leave. Any interaction dismisses it for good (for
 * this page view).
 */
export function useSwipeHint({
    delayMs,
    visibleMs = 5000,
    enabled = true,
    onShow,
}: {
    delayMs: number
    visibleMs?: number
    /** False to never show it (e.g. this reader has already swiped). */
    enabled?: boolean
    /** Called once, when it actually appears. */
    onShow?: () => void
}): { visible: boolean; dismiss: () => void; visibleMs: number } {
    const [visible, setVisible] = useState(false)
    const dismissed = useRef(false)
    const onShowRef = useRef(onShow)
    onShowRef.current = onShow

    const dismiss = useCallback(() => {
        dismissed.current = true
        setVisible(false)
    }, [])

    useEffect(() => {
        if (!enabled) return
        const show = window.setTimeout(() => {
            if (dismissed.current) return
            setVisible(true)
            onShowRef.current?.()
        }, delayMs)
        const hide = window.setTimeout(() => {
            dismissed.current = true
            setVisible(false)
        }, delayMs + visibleMs)
        return () => {
            window.clearTimeout(show)
            window.clearTimeout(hide)
        }
    }, [delayMs, visibleMs, enabled])

    return { visible, dismiss, visibleMs }
}
