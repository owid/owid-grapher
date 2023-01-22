import { ClientSettings } from "./clientSettings.js"

export {
    ADMIN_BASE_URL,
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
    BAKED_BASE_URL,
    BAKED_GRAPHER_EXPORTS_BASE_URL,
    BAKED_GRAPHER_URL,
    BUGSNAG_API_KEY,
    DONATE_API_URL,
    ENV,
    RECAPTCHA_SITE_KEY,
    STRIPE_PUBLIC_KEY,
} from "./clientSettings.js"

const defaults = {
    ADMIN_BASE_URL: "http://localhost:3030",
    ALGOLIA_ID: "",
    ALGOLIA_SEARCH_KEY: "",
    BAKED_BASE_URL: "http://localhost:3030",
    BAKED_GRAPHER_EXPORTS_BASE_URL: "http://localhost:3030/grapher/exports",
    BAKED_GRAPHER_URL: "http://localhost:3030/grapher",
    BUGSNAG_API_KEY: "",
    DONATE_API_URL: "http://localhost:9000/donate",
    ENV: "development",
    RECAPTCHA_SITE_KEY: "6LcJl5YUAAAAAATQ6F4vl9dAWRZeKPBm15MAZj4Q",
    STRIPE_PUBLIC_KEY: "pk_test_nIHvmH37zsoltpw3xMssPIYq",
}

export type SiteClientSettingsObject = typeof defaults

export class SiteClientSettings extends ClientSettings<SiteClientSettingsObject> {
    constructor(settings: Record<string, unknown>) {
        super(defaults, settings)
    }
}
