import * as Sentry from "@sentry/react"
import Cookies from "js-cookie"
import { EXPERIMENT_PREFIX } from "@ourworldindata/types"
import { isInIFrame } from "@ourworldindata/utils"

const SENTRY_SAMPLED_RATE_KEY = "sentryReplaySampledRate"
const SENTRY_SHOULD_RECORD_KEY = "sentryReplayShouldRecord"
const SENTRY_DEFAULT_REPLAYS_SESSION_SAMPLE_RATE = 0.1

/**
 * Stop or start a session replay given user's cookie consent.
 *
 * For non-consenting users, we never start replay recording. For consenting users,
 * we sample some non-zero fraction of sessions for recording, where the sampling rate
 * depends on what page the user is on.
 *
 * Logic for sampling replays into recording:
 *
 * On page load, if consent is granted immediately start replay recording if this
 * session has already been sampled into recording. Otherwise, sample this session
 * for possible recording if replay is not already recording and current
 * sampling rate is greater than largest sampled rate of session so far.
 *
 * The reason for this "greater than largest sampled rate of session so far"
 * check is to make sure we re-roll when a visitor encounters a page that
 * has a higher sampling rate. e.g. a visitor lands on home page with
 * sampling rate = 0.1 and their session is not sampled for recording. Then
 * they visit /grapher/population with sampling rate = 0.9. We want to re-roll
 * when they land on /grapher/population.
 *
 * @param isConsentGranted - Whether the user has granted consent for analytics.
 * @returns A Promise that resolves when the replay recording state has been updated.
 */
export async function stopOrStartReplay(
    isConsentGranted: boolean
): Promise<void> {
    const replay = Sentry.getReplay()
    if (!replay) return

    try {
        if (isConsentGranted) {
            if (sessionStorage.getItem(SENTRY_SHOULD_RECORD_KEY) === "1") {
                replay.start()
            } else {
                const isReplayRecording = !!replay.getReplayId()
                if (!isReplayRecording) {
                    const sampledRate = getSessionSampledRate()
                    const p = computeSessionSampleRate(isConsentGranted)

                    if (sampledRate === undefined || p > sampledRate) {
                        await rerollReplaySampling(p)
                    }
                }
            }
        } else {
            // if consent is denied, stop replay sampling in case it was somehow started
            await rerollReplaySampling(0)
        }
    } catch {
        // failed to start or stop replay recording
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
export function computeSessionSampleRate(isConsentGranted: boolean): number {
    let p = 0
    if (isConsentGranted && !isInIFrame()) {
        p =
            parseCookieReplaysSessionSampleRate() ||
            SENTRY_DEFAULT_REPLAYS_SESSION_SAMPLE_RATE
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
    const allCookies = Cookies.get()
    const expSentrySampleRates: number[] = []

    // Find all experiment cookies
    for (const [cookieName, cookieValue] of Object.entries(allCookies)) {
        if (!cookieName.startsWith(`${EXPERIMENT_PREFIX}-`) || !cookieValue) {
            continue
        }

        // Parse the cookie value (format: param1:value1&param2:value2)
        const params = cookieValue.split("&")
        for (const param of params) {
            const [key, val] = param.split(":")
            if (key === "sentrySampleRate" && val) {
                const num = parseFloat(val)
                if (!isNaN(num) && num >= 0 && num <= 1) {
                    expSentrySampleRates.push(num)
                }
            }
        }
    }

    // Return the maximum sample rate if any were found
    return expSentrySampleRates.length > 0
        ? Math.max(...expSentrySampleRates)
        : undefined
}

export async function rerollReplaySampling(p: number) {
    setSessionSampledRate(p)
    const replay = Sentry.getReplay()

    if (!replay) return
    if (Math.random() < p) {
        sessionStorage.setItem(SENTRY_SHOULD_RECORD_KEY, "1")
        await replay.start()
    } else {
        sessionStorage.setItem(SENTRY_SHOULD_RECORD_KEY, "0")
        await replay.stop()
    }
}

export function getSessionSampledRate(): number | undefined {
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
}

export function setSessionSampledRate(p: number | null | undefined) {
    if (p === null || p === undefined) {
        sessionStorage.removeItem(SENTRY_SAMPLED_RATE_KEY)
    } else {
        sessionStorage.setItem(SENTRY_SAMPLED_RATE_KEY, p.toString())
    }
}
