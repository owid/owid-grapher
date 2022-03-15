import cheerio from "cheerio"
import { WP_ColumnStyle } from "../clientUtils/owidTypes.js"
import {
    GRAPHER_PREVIEW_CLASS,
    splitContentIntoSectionsAndColumns,
} from "./formatting.js"

const paragraph = `<p>Some paragraph</p>`
const chart = `<figure data-grapher-src="https://ourworldindata.org/grapher/pneumococcal-vaccination-averted-deaths" class="${GRAPHER_PREVIEW_CLASS}"></figure>`
const chart2 = `<figure data-grapher-src="https://ourworldindata.org/grapher/pneumonia-and-lower-respiratory-diseases-deaths" class="${GRAPHER_PREVIEW_CLASS}"></figure>`
const chart3 = `<figure data-grapher-src="https://ourworldindata.org/grapher/pneumonia-mortality-by-age" class="${GRAPHER_PREVIEW_CLASS}"></figure>`
const figure = `<figure class="wp-block-image size-large"><img src="https://ourworldindata.org/uploads/2022/02/child-mortality-800x245.png" alt="Child mortality" class="wp-image-46764"><figcaption>Child mortality</figcaption></figure>`
const table = `<div class="tableContainer"><table></table></div>`
const h2 = `<h2>Some h2 heading</h2>`
const h3 = `<h3>Some h3 heading</h3>`
const h4 = `<h4>Some h4 heading</h4>`
const h6 = `<h6>Some h6 heading</h6>`

const testColumnsContent = (
    $: CheerioStatic,
    firstColumnHTML: string,
    lastColumnHTML: string,
    style: string = WP_ColumnStyle.StickyRight
) => {
    expect($(`.is-style-${style}`).children().first().html()).toEqual(
        firstColumnHTML
    )
    expect($(`.is-style-${style}`).children().last().html()).toEqual(
        lastColumnHTML
    )
}

describe("creates sections", () => {
    it("from document start", () => {
        const content = paragraph + h2 + paragraph
        const $ = cheerio.load(content)

        splitContentIntoSectionsAndColumns($)
        expect($("section").length).toEqual(2)
    })
    it("from h2", () => {
        const content = h2 + paragraph + h2 + paragraph
        const $ = cheerio.load(content)

        splitContentIntoSectionsAndColumns($)
        expect($("section").length).toEqual(2)
    })
})

it("does not split full-width elements", () => {
    const content = paragraph + h3 + paragraph
    const $ = cheerio.load(content)

    splitContentIntoSectionsAndColumns($)
    expect(cheerio.html($("section").children().eq(1))).toEqual(h3)
})

it("places h4 in its own columns set", () => {
    const content = paragraph + h4 + paragraph
    const $ = cheerio.load(content)

    splitContentIntoSectionsAndColumns($)
    expect($("section").children().eq(1).children().first().html()).toEqual(h4)
    expect($("section").children().eq(1).children().last().html()).toEqual("")
})

describe("splits text and chart", () => {
    it("before full-width element", () => {
        const content = paragraph + chart + h3
        const $ = cheerio.load(content)

        splitContentIntoSectionsAndColumns($)
        testColumnsContent($, paragraph, chart)
    })
    it("before end of section", () => {
        const content = paragraph + chart + h2
        const $ = cheerio.load(content)

        splitContentIntoSectionsAndColumns($)
        testColumnsContent($, paragraph, chart)
    })
    it("before end of document", () => {
        const content = paragraph + chart
        const $ = cheerio.load(content)

        splitContentIntoSectionsAndColumns($)
        testColumnsContent($, paragraph, chart)
    })
})

describe("places standalone visualizations in sticky-left columns", () => {
    it("chart", () => {
        const content = h3 + chart + h3
        const $ = cheerio.load(content)

        splitContentIntoSectionsAndColumns($)
        testColumnsContent($, chart, "", WP_ColumnStyle.StickyLeft)
    })
    it("figure", () => {
        const content = h3 + figure + h3
        const $ = cheerio.load(content)

        splitContentIntoSectionsAndColumns($)
        testColumnsContent($, figure, "", WP_ColumnStyle.StickyLeft)
    })
    it("table", () => {
        const content = h3 + table + h3
        const $ = cheerio.load(content)

        splitContentIntoSectionsAndColumns($)
        testColumnsContent($, table, "", WP_ColumnStyle.StickyLeft)
    })
})

it("does not move legacy h6 caption + image to the left column", () => {
    const content = h3 + h6 + figure + h3
    const $ = cheerio.load(content)

    splitContentIntoSectionsAndColumns($)
    testColumnsContent($, "", h6 + figure, WP_ColumnStyle.StickyRight)
})

describe("splits consecutive charts in side-by-side columns", () => {
    it("2 charts after content", () => {
        const content = paragraph + chart + chart2
        const $ = cheerio.load(content)

        splitContentIntoSectionsAndColumns($)
        testColumnsContent($, chart, chart2, WP_ColumnStyle.SideBySide)
    })
    it("3 charts", () => {
        const content = chart + chart2 + chart3
        const $ = cheerio.load(content)

        splitContentIntoSectionsAndColumns($)
        testColumnsContent($, chart, chart2, WP_ColumnStyle.SideBySide)
        testColumnsContent($, chart3, "", WP_ColumnStyle.StickyLeft)
    })
})
