import Cookies from "js-cookie"

const CONSENT_COOKIE = "consent"
const CONSENT_TYPES_SEPARATOR = "|"

export enum ConsentType {
    Performance = "p",
    // Marketing = "m",
}

export const getConsent = (type: ConsentType, consents = "") => {
    const regex = new RegExp(`${type}:(\\d+)`)
    const match = regex.exec(consents)
    return match ? match[1] : undefined
}

export const getConsentPerformance = () => {
    const consent = getConsent(
        ConsentType.Performance,
        Cookies.get(CONSENT_COOKIE)
    )

    // There are more concise ways of writing this but I find this more readable
    if (consent === "1") return true
    else if (consent === "0") return false
    else return undefined
}

export const updateConsent = (
    type: ConsentType,
    consent: string,
    consents = ""
) => {
    const otherConsents = consents
        .split(CONSENT_TYPES_SEPARATOR)
        .filter((consentStr) => {
            const [key, ,] = consentStr
            return key && key !== type
        })

    return [...otherConsents, `${type}:${consent}`].join(
        CONSENT_TYPES_SEPARATOR
    )
}

export const writeConsents = (consents: string) => {
    Cookies.set(CONSENT_COOKIE, consents)
}
