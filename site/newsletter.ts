export enum NewsletterSubscriptionContext {
    Homepage = "homepage",
    Floating = "floating",
    HomepageDataInsights = "homepageDataInsights",
    FloatingDataInsights = "floatingDataInsights",
    Latest = "latest",
    SubscribePage = "subscribePage",
    DataInsightsIndex = "dataInsightsIndex",
}

// Served by a Cloudflare function that redirects to the newest edition in the
// Mailchimp archive (functions/subscribe/latest/[newsletter].ts)
export const LATEST_OWID_BRIEF_PATH = "/subscribe/latest/owid-brief"
export const LATEST_DATA_INSIGHTS_NEWSLETTER_PATH =
    "/subscribe/latest/data-insights"
