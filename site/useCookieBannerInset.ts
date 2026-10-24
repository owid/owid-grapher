import { useEffect, useState } from "react"

/**
 * How many px of the bottom of the viewport the cookie banner is covering
 * right now (0 when it's closed).
 *
 * Anything pinned to the bottom of the screen has to sit above it: the banner
 * is at z-index 99992 and, on a first visit, covers roughly the bottom third
 * of a phone — so a bottom drawer or a swipe nudge beneath it is simply
 * invisible, to exactly the new visitors it's meant for. Re-measured on an
 * interval because the reader can dismiss the banner at any moment.
 */
export function useCookieBannerInset(active = true): number {
    const [inset, setInset] = useState(0)
    useEffect(() => {
        if (!active) return
        const measure = () => {
            const banner = document.querySelector(".cookie-notice.open")
            const top = banner?.getBoundingClientRect().top
            setInset(
                top !== undefined && top < window.innerHeight
                    ? Math.max(0, window.innerHeight - top)
                    : 0
            )
        }
        measure()
        const id = window.setInterval(measure, 400)
        window.addEventListener("resize", measure)
        return () => {
            window.clearInterval(id)
            window.removeEventListener("resize", measure)
        }
    }, [active])
    return inset
}
