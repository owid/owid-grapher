import { useCallback, useEffect, useRef, useState } from "react"
import { parseAsInteger, parseAsString } from "nuqs"

import { useUrlState } from "../../../../hooks/useUrlState.js"
import {
    clampSlide,
    findWalkthrough,
    type Walkthrough,
    type WalkthroughSlide,
} from "../core/walkthroughs.js"
import type { WalkthroughProgress } from "./WalkthroughRail.js"

/** A horizontal swipe longer than this, and mostly sideways, changes the slide */
const SWIPE_DISTANCE = 50
/** Without interaction for this long, the next button starts pulsing */
const NUDGE_AFTER_MS = 3000

/**
 * Scrolls so the element is fully on screen, if it isn't: the least that
 * does it, or to its top when it's taller than the viewport
 */
export function scrollIntoViewIfCutOff(element: HTMLElement): void {
    const { top, bottom, height } = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    if (top >= 0 && bottom <= viewportHeight) return
    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches
    element.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: height > viewportHeight ? "start" : "nearest",
    })
}

/** Whether a key press belongs to something else: a text field, a slider or a popover */
function isOwnedByControl(event: KeyboardEvent): boolean {
    // Inside the shadow root, the event's target is retargeted to the host
    const target = event.composedPath()[0]
    if (!(target instanceof HTMLElement || target instanceof SVGElement))
        return false
    return !!target.closest(
        "input, textarea, select, [contenteditable], [role=slider], [role=listbox], [role=dialog]"
    )
}

/** ← and → change slides while a walkthrough is open, Escape closes it */
export function useWalkthroughKeyboard({
    isOpen,
    onPrevious,
    onNext,
    onClose,
}: {
    isOpen: boolean
    onPrevious: () => void
    onNext: () => void
    onClose: () => void
}): void {
    useEffect(() => {
        if (!isOpen) return
        // Classified on the way down, before React handles the key: by the
        // time it bubbles up, closing a popover has taken its elements out
        // of the document
        const ownedByControl = new WeakSet<KeyboardEvent>()
        const handleCapture = (event: KeyboardEvent): void => {
            if (isOwnedByControl(event)) ownedByControl.add(event)
        }
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.altKey || event.ctrlKey || event.metaKey) return
            if (event.defaultPrevented || ownedByControl.has(event)) return
            if (event.key === "ArrowLeft") onPrevious()
            else if (event.key === "ArrowRight") onNext()
            else if (event.key === "Escape") onClose()
            else return
            event.preventDefault()
        }
        window.addEventListener("keydown", handleCapture, true)
        window.addEventListener("keydown", handleKeyDown)
        return () => {
            window.removeEventListener("keydown", handleCapture, true)
            window.removeEventListener("keydown", handleKeyDown)
        }
    }, [isOpen, onPrevious, onNext, onClose])
}

/**
 * Whether the reader has gone NUDGE_AFTER_MS without touching the chart
 * (pointer, key or touch inside `node`) since the slide came up
 */
export function useIdleNudge({
    isEnabled,
    node,
    resetKey,
}: {
    isEnabled: boolean
    node: HTMLElement | null
    resetKey: string
}): boolean {
    // The resetKey the reader has gone idle on; a new key is a fresh wait
    const [idleOn, setIdleOn] = useState<string | null>(null)
    useEffect(() => {
        if (!isEnabled || !node) return
        const arm = (): number =>
            window.setTimeout(() => setIdleOn(resetKey), NUDGE_AFTER_MS)
        let timer = arm()
        const restart = (): void => {
            setIdleOn(null)
            window.clearTimeout(timer)
            timer = arm()
        }
        const events = ["pointerdown", "keydown", "touchstart"] as const
        for (const event of events) node.addEventListener(event, restart)
        return () => {
            window.clearTimeout(timer)
            for (const event of events) node.removeEventListener(event, restart)
        }
    }, [isEnabled, node, resetKey])
    return idleOn === resetKey
}

/** A horizontal swipe over the chart changes slides; dragging the poverty line doesn't */
export function useSwipe({
    isEnabled,
    onPrevious,
    onNext,
}: {
    isEnabled: boolean
    onPrevious: () => void
    onNext: () => void
}): Pick<React.HTMLAttributes<HTMLElement>, "onTouchStart" | "onTouchEnd"> {
    const startRef = useRef<{ x: number; y: number } | null>(null)
    if (!isEnabled) return {}
    return {
        onTouchStart: (event) => {
            const touch = event.touches[0]
            const target = event.target
            const isOnLine =
                target instanceof Element &&
                !!target.closest(".income-distribution-chart__poverty-line")
            startRef.current =
                touch && !isOnLine
                    ? { x: touch.clientX, y: touch.clientY }
                    : null
        },
        onTouchEnd: (event) => {
            const start = startRef.current
            startRef.current = null
            const touch = event.changedTouches[0]
            if (!start || !touch) return
            const dx = touch.clientX - start.x
            const dy = touch.clientY - start.y
            if (
                Math.abs(dx) < SWIPE_DISTANCE ||
                Math.abs(dx) < 1.5 * Math.abs(dy)
            )
                return
            if (dx < 0) onNext()
            else onPrevious()
        },
    }
}

/**
 * Which walkthrough is playing and on which slide, kept in the URL so a
 * slide can be shared, with the ways of moving through it: the buttons' and
 * pills' callbacks, ← → Escape, a swipe over the chart, and the nudge after
 * a while without interaction. Opening a walkthrough scrolls `chartRef`'s
 * element into view once it's on screen.
 */
export function useWalkthroughNavigation({
    defaultWalkthroughId,
    node,
    chartRef,
}: {
    /** The walkthrough playing when the chart loads, or "" for none */
    defaultWalkthroughId: string
    /** The variant's root, where interaction resets the nudge */
    node: HTMLElement | null
    chartRef: React.RefObject<HTMLElement | null>
}): {
    walkthrough: Walkthrough | undefined
    slide: WalkthroughSlide | undefined
    /** 1-based */
    slideNumber: number
    progress: WalkthroughProgress
    /** Opens a walkthrough at its first slide */
    open: (id: string) => void
    close: () => void
    /** Opens a walkthrough, or closes it while it's the one playing */
    toggle: (id: string) => void
    previous: () => void
    next: () => void
    swipeHandlers: ReturnType<typeof useSwipe>
    isNudging: boolean
} {
    const [walkthroughId, setWalkthroughId] = useUrlState({
        key: "walkthrough",
        parser: parseAsString,
        defaultValue: defaultWalkthroughId,
    })
    const [rawSlide, setRawSlide] = useUrlState({
        key: "slide",
        parser: parseAsInteger,
        defaultValue: 1,
    })
    const walkthrough = findWalkthrough(walkthroughId)
    const slideNumber = walkthrough ? clampSlide(rawSlide, walkthrough) : 1
    const slide = walkthrough?.slides[slideNumber - 1]

    const [watchedIds, setWatchedIds] = useState<ReadonlySet<string>>(
        () => new Set()
    )

    // Once a walkthrough the reader started is on screen, bring the whole
    // frame into view, from the slide's text to the buttons below the chart
    const shouldScrollIntoViewRef = useRef(false)
    const open = useCallback(
        (id: string) => {
            shouldScrollIntoViewRef.current = true
            setWalkthroughId(id)
            setRawSlide(1)
        },
        [setWalkthroughId, setRawSlide]
    )
    useEffect(() => {
        if (!walkthrough || !shouldScrollIntoViewRef.current) return
        shouldScrollIntoViewRef.current = false
        const element = chartRef.current
        if (!element) return
        scrollIntoViewIfCutOff(element)
    }, [walkthrough, chartRef])
    const close = useCallback(() => {
        if (walkthrough && slideNumber >= walkthrough.slides.length)
            setWatchedIds((ids) => new Set([...ids, walkthrough.id]))
        setWalkthroughId("")
        setRawSlide(1)
    }, [walkthrough, slideNumber, setWalkthroughId, setRawSlide])
    const toggle = useCallback(
        (id: string) => (walkthrough?.id === id ? close() : open(id)),
        [walkthrough, close, open]
    )
    const goTo = useCallback(
        (next: number) => {
            if (!walkthrough) return
            setRawSlide(clampSlide(next, walkthrough))
        },
        [walkthrough, setRawSlide]
    )
    const previous = useCallback(
        () => goTo(slideNumber - 1),
        [goTo, slideNumber]
    )
    const next = useCallback(() => goTo(slideNumber + 1), [goTo, slideNumber])

    useWalkthroughKeyboard({
        isOpen: !!walkthrough,
        onPrevious: previous,
        onNext: next,
        onClose: close,
    })
    const swipeHandlers = useSwipe({
        isEnabled: !!walkthrough,
        onPrevious: previous,
        onNext: next,
    })
    const isNudging = useIdleNudge({
        isEnabled: !!walkthrough,
        node,
        // A new slide starts the wait over
        resetKey: `${walkthrough?.id}:${slideNumber}`,
    })

    return {
        walkthrough,
        slide,
        slideNumber,
        progress: {
            activeId: walkthrough?.id ?? null,
            slide: slideNumber,
            watchedIds,
        },
        open,
        close,
        toggle,
        previous,
        next,
        swipeHandlers,
        isNudging,
    }
}
