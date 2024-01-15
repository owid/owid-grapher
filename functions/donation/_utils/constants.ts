export const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // The Content-Type header is required to allow requests to be sent with a
    // Content-Type of "application/json". This is because "application/json" is
    // not an allowed value for Content-Type to be considered a CORS-safelisted
    // header.
    // - https://developer.mozilla.org/en-US/docs/Glossary/CORS-safelisted_request_header
    "Access-Control-Allow-Headers": "Content-Type",
}

export const DEFAULT_HEADERS = {
    ...CORS_HEADERS,
    "Content-Type": "application/json",
} // CORS headers need to be sent in responses to both preflight ("OPTIONS") and
// actual requests.

export const STRIPE_API_VERSION = "2023-10-16"
