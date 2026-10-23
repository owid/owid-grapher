import { useEffect, useState } from "react"
import labsBuild from "./features.json"

// The rebuild (infra/labs/ in owid/ops) writes features.json into the `labs`
// branch: the master commit it built from and every PR merged in.
export interface LabsFeature {
    number: number
    title: string
    author: string
}

export const LABS_MASTER_SHA: string = labsBuild.master
export const LABS_FEATURES: LabsFeature[] = labsBuild.features

// A feature's PR labels the control it adds with data-labs-feature="<PR
// number>". The attribute does nothing outside Labs; here LabsBar.scss draws
// the flask after it, and the bar finds the features on the page by it.
const MARK_ATTRIBUTE = "data-labs-feature"

function markedElements(): HTMLElement[] {
    return Array.from(document.querySelectorAll(`[${MARK_ATTRIBUTE}]`))
}

function describeMarks(): void {
    for (const element of markedElements()) {
        if (element.title) continue
        const number = Number(element.getAttribute(MARK_ATTRIBUTE))
        const feature = LABS_FEATURES.find((f) => f.number === number)
        element.title = feature
            ? `Labs feature: ${feature.title} (#${number})`
            : "Labs feature"
    }
}

function featureNumbersOnPage(): number[] {
    const numbers = markedElements().map((element) =>
        Number(element.getAttribute(MARK_ATTRIBUTE))
    )
    return [...new Set(numbers)].sort((a, b) => a - b)
}

/** The PR numbers of the features marked on the page, kept current as it renders */
export function useFeaturesOnPage(): number[] {
    const [numbers, setNumbers] = useState<number[]>([])

    useEffect(() => {
        let frame = 0
        const update = (): void => {
            frame = 0
            describeMarks()
            const current = featureNumbersOnPage()
            setNumbers((previous) =>
                previous.join() === current.join() ? previous : current
            )
        }
        update()
        // Charts and their side panels render after the page loads
        const observer = new MutationObserver(() => {
            if (!frame) frame = requestAnimationFrame(update)
        })
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [MARK_ATTRIBUTE],
        })
        return () => {
            observer.disconnect()
            cancelAnimationFrame(frame)
        }
    }, [])

    return numbers
}

export function showFeature(number: number): void {
    const element = document.querySelector<HTMLElement>(
        `[${MARK_ATTRIBUTE}="${number}"]`
    )
    if (!element) return
    element.scrollIntoView({ behavior: "smooth", block: "center" })
    element.classList.add("labs-mark--flash")
    setTimeout(() => element.classList.remove("labs-mark--flash"), 2000)
}
