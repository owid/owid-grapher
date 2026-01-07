import { BAKED_BASE_URL } from "../settings/serverSettings.js"

export const RESEARCH_AND_WRITING_CLASSNAME = "wp-block-research-and-writing"

export const formatUrls = (html: string) => {
    const formatted = html
        .replace(new RegExp("https?://owid.cloud", "g"), BAKED_BASE_URL)
        .replace(new RegExp("https?://ourworldindata.org", "g"), BAKED_BASE_URL)

    return formatted
}
