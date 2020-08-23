import { useEffect, RefObject } from "react"

export const useTriggerWhenClickOutside = (
    container: RefObject<HTMLElement>,
    trigger: (arg0: boolean) => void
) => {
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (container && !container.current?.contains(e.target as Node)) {
                trigger(false)
            }
        }
        document.addEventListener("mousedown", handleClick)

        return () => {
            document.removeEventListener("mousedown", handleClick)
        }
    }, [])
}
