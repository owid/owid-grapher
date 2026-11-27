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
// number>". The attribute does nothing outside Labs, and it stays on once the
// feature ships, so the bar only marks (data-labs-mark, which LabsBar.scss
// draws the flask for) and counts the features that are on Labs right now.
const MARK_ATTRIBUTE = "data-labs-feature"
const DRAWN_ATTRIBUTE = "data-labs-mark"

function featureOnLabs(element: Element): LabsFeature | undefined {
    const number = Number(element.getAttribute(MARK_ATTRIBUTE))
    return LABS_FEATURES.find((feature) => feature.number === number)
}

function markedElements(): HTMLElement[] {
    return Array.from(document.querySelectorAll(`[${MARK_ATTRIBUTE}]`))
}

function markFeatures(): void {
    for (const element of markedElements()) {
        const feature = featureOnLabs(element)
        if (!feature || element.hasAttribute(DRAWN_ATTRIBUTE)) continue
        element.setAttribute(DRAWN_ATTRIBUTE, "")
        element.title ||= `Labs feature: ${feature.title} (#${feature.number})`
    }
}

function featureNumbersOnPage(): number[] {
    const numbers = markedElements().flatMap(
        (element) => featureOnLabs(element)?.number ?? []
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
            markFeatures()
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
