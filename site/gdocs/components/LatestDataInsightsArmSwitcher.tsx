import { useEffect, useSyncExternalStore } from "react"
import { get as getCookie, set as setCookie } from "es-cookie"

import {
    EXPERIMENT_ARM_SEPARATOR,
    EXPERIMENT_PREFIX,
    LATEST_DATA_INSIGHTS_ARMS,
    LATEST_DATA_INSIGHTS_EXPERIMENT_ID,
    LatestDataInsightsArm,
} from "@ourworldindata/utils"

/*
 * QA-only floating switcher between the data insights experiment arms, shown
 * wherever the experiment renders (homepage and data insight pages). Not
 * meant to be merged.
 *
 * Picking an arm swaps the body class the experiments middleware would add
 * and writes the experiment cookie, which the middleware honours on the next
 * request, so the choice survives reloads on staging. Locally, where no
 * middleware runs, the class is re-applied from the cookie on mount.
 */

const EXPERIMENT_ID = `${EXPERIMENT_PREFIX}-${LATEST_DATA_INSIGHTS_EXPERIMENT_ID}`

const ARMS: { arm: LatestDataInsightsArm; label: string }[] = [
    { arm: LATEST_DATA_INSIGHTS_ARMS.carousel, label: "A · Carousel" },
    { arm: LATEST_DATA_INSIGHTS_ARMS.titles, label: "B · Titles" },
]

const getArmClassName = (arm: LatestDataInsightsArm): string =>
    `${EXPERIMENT_ID}${EXPERIMENT_ARM_SEPARATOR}${arm}`

function isArm(value: string | undefined): value is LatestDataInsightsArm {
    return ARMS.some((a) => a.arm === value)
}

function readArm(): LatestDataInsightsArm {
    const fromBody = ARMS.find(({ arm }) =>
        document.body.classList.contains(getArmClassName(arm))
    )?.arm
    if (fromBody) return fromBody
    let fromCookie: string | undefined
    try {
        fromCookie = getCookie(EXPERIMENT_ID)
    } catch {
        // Cookies may be unavailable, e.g. in a sandboxed iframe.
    }
    return isArm(fromCookie) ? fromCookie : LATEST_DATA_INSIGHTS_ARMS.carousel
}

function applyArm(arm: LatestDataInsightsArm): void {
    for (const { arm: other } of ARMS) {
        document.body.classList.toggle(getArmClassName(other), other === arm)
    }
}

/** Re-render whenever the body class changes, i.e. when the arm switches. */
function subscribeToBodyClass(onChange: () => void): () => void {
    const observer = new MutationObserver(onChange)
    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"],
    })
    return () => observer.disconnect()
}

export default function LatestDataInsightsArmSwitcher() {
    // The arm lives in the body class and cookie, which the baked HTML can't
    // know about, so nothing renders on the server or during hydration.
    const selectedArm = useSyncExternalStore(
        subscribeToBodyClass,
        readArm,
        () => undefined
    )

    // Locally there's no middleware to turn the cookie into a body class.
    useEffect(() => applyArm(readArm()), [])

    if (!selectedArm) return null

    const selectArm = (arm: LatestDataInsightsArm): void => {
        applyArm(arm)
        try {
            setCookie(EXPERIMENT_ID, arm, { path: "/", expires: 7 })
        } catch {
            // Still switches for this page view.
        }
    }

    return (
        <fieldset className="latest-data-insights-arm-switcher">
            <legend className="latest-data-insights-arm-switcher__legend">
                Data insights experiment (QA)
            </legend>
            {ARMS.map(({ arm, label }) => (
                <label
                    key={arm}
                    className="latest-data-insights-arm-switcher__option"
                >
                    <input
                        type="radio"
                        name="latest-data-insights-arm"
                        value={arm}
                        checked={selectedArm === arm}
                        onChange={() => selectArm(arm)}
                    />
                    {label}
                </label>
            ))}
        </fieldset>
    )
}
