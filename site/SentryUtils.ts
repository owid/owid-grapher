import * as Sentry from "@sentry/react"
import * as cookie from "cookie"
import { EXPERIMENT_PREFIX } from "@ourworldindata/types"
import { isInIFrame } from "@ourworldindata/utils"
import { getPreferenceValue, PreferenceType } from "./cookiePreferences.js"

export const SENTRY_SAMPLED_RATE_KEY = "sentry-replay-sampled-rate:v1"

export async function stopOrStartReplay(
    isConsentGranted: boolean
): Promise<void> {
    const replay = Sentry.getReplay()
    if (!replay) return

    if (isConsentGranted) {
        // if consent is granted, maybe start replay sampling
        const isReplayRecording = !!replay.getReplayId()

        if (!isReplayRecording) {
            const sampledRate = getSessionSampledRate()
            const p = computeSessionSampleRate()
            if (sampledRate === undefined || p > sampledRate) {
                await rerollReplaySampling(p)
            }
        }
    } else {
        // if consent is denied, stop replay sampling
        await rerollReplaySampling(0)
    }
}

/**
 * Computes Sentry replay session sample rate based on user consent and experiment configuration.
 *
 * This function determines the sample rate for Sentry session replays by checking:
 * 1. Whether the user has granted analytics consent
 * 2. Whether the page is embedded in an iframe (replays disabled in iframes)
 * 3. Any experiment-specific sample rates from cookies
 *
 * The returned sample rate is the rate that should be used to determine whether
 * this session is sampled for recording.
 *
 * @returns {number} The sample rate to use for session replays:
 *   - A number between 0 and 1 representing the probability of recording a session:
 *     - 0 = never record
 *     - 0.1 = record 10% of sessions (default fallback)
 *     - 1 = record 100% of sessions
 *   - Uses experiment cookie value if available, otherwise defaults to 0.1
 *
 */
export function computeSessionSampleRate(): number {
    let p = 0
    const analyticsConsent = getPreferenceValue(PreferenceType.Analytics)
    if (analyticsConsent && !isInIFrame()) {
        p = parseCookieReplaysSessionSampleRate() || 0.1
    }
    return p
}

/**
 * Parses experiment cookies to extract Sentry replay session sample rates.
 *
 * This function searches through browser cookies for experiment configurations that contain
 * Sentry replay sample rate overrides.
 *
 * Expected cookie format:
 * - Cookie name: `${EXPERIMENT_PREFIX}-{experimentId}`
 * - Cookie value: `param1:value1&param2:value2&sentrySampleRate:0.5`
 *
 * If multiple experiments specify different sample rates, the highest rate is returned.
 *
 * @returns {number | undefined} The experiment sample rate:
 *   - `undefined` if no experiment cookies contain valid `sentrySampleRate` values
 *   - A number between 0 and 1 representing the sample rate from experiments:
 *     - 0 = never record replays
 *     - 0.5 = record 50% of sessions
 *     - 1 = record 100% of sessions
 *   - If multiple experiments specify rates, returns the maximum value
 */
export function parseCookieReplaysSessionSampleRate(): number | undefined {
    const cookies = cookie.parse(document.cookie)
    const expSentrySampleRates = Object.entries(cookies)
        .filter(([name]) => name.startsWith(`${EXPERIMENT_PREFIX}-`))
        .flatMap(([, value]) =>
            value
                ? value
                      .split("&")
                      .map((item) => item.split(":"))
                      .filter(([key]) => key === "sentrySampleRate")
                      .map(([, val]) => {
                          const num = parseFloat(val)
                          return !isNaN(num) && num >= 0 && num <= 1
                              ? num
                              : undefined
                      })
                      .filter((num): num is number => num !== undefined)
                : []
        )
    const replaysSessionSampleRate =
        expSentrySampleRates.length > 0
            ? Math.max(...expSentrySampleRates)
            : undefined
    return replaysSessionSampleRate
}

export async function rerollReplaySampling(p: number) {
    setSessionSampledRate(p)
    const replay = Sentry.getReplay()
    const isReplayRecording = !!replay?.getReplayId()

    if (!replay) return
    try {
        if (Math.random() < p) {
            if (isReplayRecording) {
                await replay.stop()
            }
            await replay.start()
        } else if (isReplayRecording) {
            await replay.stop()
        }
    } catch {
        // failed to stop and/or start replay
    }
}

export function getSessionSampledRate(): number | undefined {
    try {
        const raw = sessionStorage.getItem(SENTRY_SAMPLED_RATE_KEY)

        // Return undefined if no value is stored
        if (raw === null || raw === undefined || raw === "") {
            return undefined
        }

        const num = parseFloat(raw)

        if (isNaN(num) || num < 0 || num > 1) {
            // Clean up invalid value from sessionStorage
            setSessionSampledRate(null)
            return undefined
        }

        return num
    } catch {
        return undefined
    }
}

export function setSessionSampledRate(p: number | null | undefined) {
    if (p === null || p === undefined) {
        sessionStorage.removeItem(SENTRY_SAMPLED_RATE_KEY)
    } else {
        sessionStorage.setItem(SENTRY_SAMPLED_RATE_KEY, p.toString())
    }
}
