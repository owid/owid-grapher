import * as Sentry from "@sentry/react"
import Cookies from "js-cookie"
import { getPreferenceValue, PreferenceType } from "./cookiePreferences.js"
import { experiments, isInIFrame } from "@ourworldindata/utils"
import {
    SENTRY_DEFAULT_REPLAYS_SESSION_SAMPLE_RATE,
    SENTRY_SESSION_STORAGE_KEY,
    SENTRY_SAMPLED_RATE_KEY,
} from "@ourworldindata/types"

/**
 * Checks whether the session should be (re)sampled for recording, and (re)samples
 * if so.
 *
 * If recording is not allowed for this session (e.g. user denied consent), stops
 * the recording immediately.
 */
export function maybeSampleSession(sampleRate: number) {
    try {
        if (!allowRecording()) {
            void stopSessionRecording()
            return
        }

        // no need to do anything if session is already recording
        if (isSessionRecording()) return

        const lastSampleRate = getSessionLastSampleRate()
        const shouldResample =
            sampleRate > 0 &&
            !hasSessionBeenRecorded() &&
            (lastSampleRate === undefined || sampleRate > lastSampleRate)

        if (shouldResample) {
            setSessionLastSampleRate(sampleRate)
            if (Math.random() < sampleRate) {
                startSessionRecording()
            }
        }
    } catch {
        // failed to maybe start session replay
    }
}
/**
 * Checks if the current session has been sampled for Sentry replay recording.
 *
 * This does NOT check if the sampling was successful or not (i.e. if the session
 * was actually recorded or not). It just checks whether sampling was conducted.
 *
 * @returns {boolean} True if sampling has been conducted for this session, false otherwise.
 */
export function hasSessionBeenSampled(): boolean {
    if (getSentrySessionStorage() !== undefined) {
        return true
    }

    const lastSampleRate = getSessionLastSampleRate()
    if (lastSampleRate) {
        return true
    }

    return false
}

/**
 * Checks if the current session was recording (as of the previous page load).
 *
 * Usable before Sentry is initialized.
 *
 * @returns {boolean} True if sampling was recording, False otherwise.
 */
function hasSessionBeenRecorded(): boolean {
    const replaySession = getSentrySessionStorage()
    if (replaySession === undefined) return false
    return replaySession.sampled === "session"
}

function isSessionRecording(): boolean {
    const replay = Sentry.getReplay()
    return !!replay?.getReplayId()
}

/**
 * Checks if the current session is allowed to be recorded.
 *
 * Returns true if the user has given consent for analytics cookies and the page
 * is not in an iframe.
 *
 * @returns {boolean} True if the session is allowed to be recorded, false otherwise.
 */
function allowRecording(): boolean {
    const analyticsConsent = getPreferenceValue(PreferenceType.Analytics)
    if (analyticsConsent && !isInIFrame()) {
        return true
    }
    return false
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
 *     - 0.1 = record 10% of sessions
 *     - 1 = record 100% of sessions
 *   - Uses experiment cookie value if available, otherwise defaults to 0.1
 *
 */
export function getSessionSampleRate(): number {
    let p = 0
    if (allowRecording()) {
        p =
            parseExperimentsSampleRate() ||
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
 * If multiple experiments specify different sample rates, the highest rate is returned.
 *
 * @returns {number | undefined} The experiment sample rate:
 *   - `undefined` if no experiment cookie exists or the experiment does not define
 *      a sample rate.
 *   - A number between 0 and 1 representing the sample rate from experiments:
 *     - 0 = never record sessions
 *     - 0.5 = record 50% of sessions
 *     - 1 = record 100% of sessions
 *   - If multiple experiments specify rates, returns the maximum value
 */
function parseExperimentsSampleRate(): number | undefined {
    const allCookies = Cookies.get()
    const expSentrySampleRates: number[] = []

    for (const [cookieName, cookieValue] of Object.entries(allCookies)) {
        const exp = experiments.find((e) => e.id === cookieName)
        if (!exp || !cookieValue) continue

        const pathname = window.location.pathname
        if (!exp.isUrlInPaths(pathname)) continue

        const arm = exp.arms.find((a) => a.id === cookieValue)
        if (!arm) continue

        if (arm.replaysSessionSampleRate !== undefined) {
            expSentrySampleRates.push(arm.replaysSessionSampleRate)
        }
    }

    // Return the maximum sample rate if any were found
    return expSentrySampleRates.length > 0
        ? Math.max(...expSentrySampleRates)
        : undefined
}

/**
 * Gets the Sentry session storage object from sessionStorage.
 *
 * @returns {Record<string, any> | undefined} The Sentry session storage object or undefined if not found.
 */
function getSentrySessionStorage(): Record<string, any> | undefined {
    try {
        const raw = sessionStorage.getItem(SENTRY_SESSION_STORAGE_KEY)
        return raw ? JSON.parse(raw) : undefined
    } catch {
        return undefined
    }
}

/**
 * Gets the last recorded sample rate for the current session.
 *
 * @returns {number | undefined} The last sample rate (or undefined if not set).
 */
function getSessionLastSampleRate(): number | undefined {
    const raw = sessionStorage.getItem(SENTRY_SAMPLED_RATE_KEY)

    // Return undefined if no value is stored
    if (raw === null || raw === undefined || raw === "") {
        return undefined
    }

    const num = parseFloat(raw)

    if (isNaN(num) || num < 0 || num > 1) {
        // Clean up invalid value from sessionStorage
        setSessionLastSampleRate(null)
        return undefined
    }

    return num
}

function setSessionLastSampleRate(p: number | null | undefined) {
    if (p === null || p === undefined) {
        sessionStorage.removeItem(SENTRY_SAMPLED_RATE_KEY)
    } else {
        sessionStorage.setItem(SENTRY_SAMPLED_RATE_KEY, p.toString())
    }
}

/**
 * Records the user session in Sentry.
 *
 * This implementation relies on directly changing sessionStorage managed by Sentry, which is
 * as an unofficial workaround to ensure recording continues on subsequent page loads.
 * As of @sentry/react 10.0.0, the official solutions (e.g. using replay.start()) are
 * not working for our build, b/c they either do not continue the recording across
 * page loads or do not record page change breadcrumbs in the Sentry session replays UI.
 */
function startSessionRecording(): void {
    const replaySession = getSentrySessionStorage()
    if (replaySession !== undefined) {
        replaySession.sampled = "session"
        sessionStorage.setItem(
            SENTRY_SESSION_STORAGE_KEY,
            JSON.stringify(replaySession)
        )
    }
    if (isSentryInitialized() && !isSessionRecording()) {
        const replay = Sentry.getReplay()
        replay?.start()
    }
}

async function stopSessionRecording(): Promise<void> {
    setSessionLastSampleRate(null)
    if (isSentryInitialized() && isSessionRecording()) {
        const replay = Sentry.getReplay()
        await replay?.stop()
    }
}

function isSentryInitialized(): boolean {
    return !!Sentry.getClient()
}

/**
 * Updates the Sentry user ID from Google Analytics client ID.
 *
 * If analytics consent is given, the user ID is set to the Google Analytics 4
 * client ID. If not, the Sentry user is cleared.
 */
export function updateSentryUser(): void {
    let user: Sentry.User | null = null // by default, clear Sentry user
    if (allowRecording()) {
        const clientId = extractGaClientIdFromCookie()
        if (clientId) {
            user = { id: clientId }
        }
    }
    Sentry.setUser(user)
}

function extractGaClientIdFromCookie(): string | undefined {
    const gaCookie = Cookies.get("_ga")
    if (!gaCookie) {
        return
    }

    // Extract client ID from GA cookie (format: GA1.1.clientId.timestamp)
    const parts = gaCookie.split(".")
    if (parts.length >= 4) {
        const clientId = `${parts[2]}.${parts[3]}`
        return clientId
    }
    return
}
