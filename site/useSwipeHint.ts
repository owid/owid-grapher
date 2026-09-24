import { useEffect, useState, useCallback, useRef } from "react"
import { getPrefersReducedMotion } from "@ourworldindata/components"

/**
 * A swipe nudge that waits before appearing, then dismisses itself.
 *
 * Waiting matters: at page load the reader is looking at the chart arriving,
 * and a hint shown then is gone before they'd have thought to swipe. Showing
 * it a few seconds in catches the moment they've taken in the first view and
 * are deciding whether to leave.
 *
 * While visible, the stage also "peeks" — slides a little way and springs back
 * — so the gesture is demonstrated, not just described. Any interaction
 * dismisses it for good (for this page view).
 */
export function useSwipeHint({
    stageRef,
    delayMs,
    visibleMs = 5000,
    peekClassName = "dp-swipe-peek",
    peek = true,
    enabled = true,
    onShow,
}: {
    stageRef: React.RefObject<HTMLElement | null>
    delayMs: number
    visibleMs?: number
    peekClassName?: string
    /**
     * Whether the stage slides a little while the nudge is up. Off where it's
     * too much — moving the whole page unprompted is jarring.
     */
    peek?: boolean
    /** False to never show it (e.g. this reader has already swiped). */
    enabled?: boolean
    /** Called once, when it actually appears. */
    onShow?: () => void
}): { visible: boolean; dismiss: () => void; visibleMs: number } {
    const [visible, setVisible] = useState(false)
    const dismissed = useRef(false)

    const dismiss = useCallback(() => {
        dismissed.current = true
        setVisible(false)
    }, [])

    const onShowRef = useRef(onShow)
    onShowRef.current = onShow

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

    // The peek is a CSS animation on the stage, toggled by class.
    useEffect(() => {
        const el = stageRef.current
        if (!el || !peek || getPrefersReducedMotion()) return
        if (visible) el.classList.add(peekClassName)
        else el.classList.remove(peekClassName)
        return () => el.classList.remove(peekClassName)
    }, [visible, stageRef, peekClassName, peek])

    return { visible, dismiss, visibleMs }
}
