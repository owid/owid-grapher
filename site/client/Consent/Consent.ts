import Cookies from "js-cookie"

const CONSENT_COOKIE = "consent"
const CONSENT_TYPES_SEPARATOR = "|"

export enum ConsentType {
    Performance = "p",
    // Marketing = "m",
}

export const getConsent = (type: ConsentType, consents = "") => {
    return consents
        .split("|")
        .filter((consentStr) => {
            const [key, ,] = consentStr
            return key === type
        })
        .map((consentStr) => {
            const [, , value] = consentStr
            return value
        })
        .pop()
}

export const getConsentPerformance = () => {
    const consent = getConsent(
        ConsentType.Performance,
        Cookies.get(CONSENT_COOKIE)
    )
    return consent !== undefined ? consent === "1" : undefined
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
