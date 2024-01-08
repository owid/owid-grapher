// For use in the sticky nav and the component implementation

export const ALL_CHARTS_ID = "all-charts"
export const KEY_INSIGHTS_ID = "key-insights"
export const LICENSE_ID = "article-licence"
export const CITATION_ID = "article-citation"
export const ENDNOTES_ID = "article-endnotes"
export const RESEARCH_AND_WRITING_ID = "research-writing"

export const IMAGES_DIRECTORY = "/images/published/"

/** Works for:
 * https://docs.google.com/document/d/abcd1234
 * https://docs.google.com/document/d/abcd1234/
 * https://docs.google.com/document/d/abcd1234/edit
 * https://docs.google.com/document/d/abcd-1234/edit
 * https://docs.google.com/document/u/0/d/abcd-1234/edit
 * https://docs.google.com/document/u/0/d/abcd-1234/edit?usp=sharing
 * Excludes:
 * https://docs.google.com/spreadsheets/d/abcd1234
 */
export const gdocUrlRegex =
    /https:\/\/docs\.google\.com\/document(?:\/u\/\d)?\/d\/([\-\w]+)\/?(edit)?#?/

export const gdocIdRegex = /^[0-9A-Za-z\-_]{44}$/
