import { describe, expect, it } from "vitest"
import { findLatestNewsletterEditionUrl } from "./newsletters.js"

// Trimmed from the real archive page: newest first, with a standalone article
// send mixed in, and HTML-escaped titles and links.
const ARCHIVE_HTML = `<div class="display_archive">
<li class="campaign">17/10/2026 - <a href="http://eepurl.com/MwOfSeYHHM" title="Data Insight: How many people in the world identify with a particular religion?" target="_blank">Data Insight: How many people in the world identify with a particular religion?</a></li><li class="campaign">16/10/2026 - <a href="http://eepurl.com/RBCvlR1O7T" title="The OWID Brief: Wildlife populations, climate change &amp; malaria, oil production, and more." target="_blank">The OWID Brief: Wildlife populations, climate change &amp; malaria, oil production, and more.</a></li><li class="campaign">05/10/2026 - <a href="http://eepurl.com/BEihFD2YI-/" title="What impact will climate change have on malaria?" target="_blank">What impact will climate change have on malaria?</a></li><li class="campaign">02/10/2026 - <a href="http://eepurl.com/KzzrkYw1go" title="The OWID Brief: US immigration, deforestation, foreign aid, and more." target="_blank">The OWID Brief: US immigration, deforestation, foreign aid, and more.</a></li></div>`

describe(findLatestNewsletterEditionUrl, () => {
    it("returns the newest edition of each newsletter, over https", () => {
        expect(findLatestNewsletterEditionUrl(ARCHIVE_HTML, "owid-brief")).toBe(
            "https://eepurl.com/RBCvlR1O7T"
        )
        expect(
            findLatestNewsletterEditionUrl(ARCHIVE_HTML, "data-insights")
        ).toBe("https://eepurl.com/MwOfSeYHHM")
    })

    it("returns undefined when no edition of that newsletter is listed", () => {
        const briefsOnly = ARCHIVE_HTML.replace(/Data Insight:/g, "Article:")
        expect(
            findLatestNewsletterEditionUrl(briefsOnly, "data-insights")
        ).toBeUndefined()
        expect(
            findLatestNewsletterEditionUrl("<html></html>", "owid-brief")
        ).toBeUndefined()
    })
})
