// Used in GrapherPage.tsx
export const HIDE_IF_JS_ENABLED_CLASSNAME = "js--hide-if-js-enabled"

export const HIDE_IF_JS_DISABLED_CLASSNAME = "js--hide-if-js-disabled"

// Used in GrapherWithFallback.tsx
export const GRAPHER_PREVIEW_CLASS = "grapherPreview"

// Sentry constants
export const SENTRY_DEFAULT_REPLAYS_SESSION_SAMPLE_RATE = 0.05
export const SENTRY_SESSION_STORAGE_KEY = "sentryReplaySession"
export const SENTRY_SAMPLED_RATE_KEY = "sentrySampledRate"

// The subscribe page is baked in its initial state and hydrated as a whole, so
// that submitting the form can swap out the hero and aside as well as the form.
export const SUBSCRIBE_PAGE_ROOT_ID = "subscribe-page-root"
export const OLD_SUBSCRIBE_PAGE_FORM_CONTAINER_ID =
    "old-subscribe-page-form-container"
export const PREFERENCES_PAGE_ROOT_ID = "email-notifications-preferences-root"
