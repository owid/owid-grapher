// For use in the sticky nav and the component implementation

export const ALL_CHARTS_ID = "all-charts"
export const KEY_INSIGHTS_ID = "key-insights"
export const LICENSE_ID = "article-licence"
export const CITATION_ID = "article-citation"
export const ENDNOTES_ID = "article-endnotes"
export const RESEARCH_AND_WRITING_ID = "research-writing"

export const RESEARCH_AND_WRITING_DEFAULT_HEADING = "Research & Writing"

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
    // Disable the lint because the regex is compiled using the v flag in newer
    // browsers when used in the pattern attribute, which requires escaping
    // additional characters.
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/pattern
    // eslint-disable-next-line no-useless-escape
    /https:\/\/docs\.google\.com\/document(?:\/u\/\d)?\/d\/([\-\w]+)\/?(edit)?(\?tab=[\w.]+)?#?/

export const GDOCS_BASE_URL = "https://docs.google.com"
export const GDOCS_URL_PLACEHOLDER = `${GDOCS_BASE_URL}/document/d/****/edit`

export const gdocIdRegex = /^[0-9A-Za-z\-_]{44}$/

// Stored in this repo and served
export const DEFAULT_GDOC_FEATURED_IMAGE = "default-featured-image.png"

// Stored in this repo and served
export const DEFAULT_THUMBNAIL_FILENAME = "default-thumbnail.png"

// Stored in this repo and served
export const ARCHVED_THUMBNAIL_FILENAME = "archived-thumbnail.jpg"
