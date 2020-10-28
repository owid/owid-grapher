#! /usr/bin/env yarn jest

import * as cheerio from "cheerio"
import {
    formatGlossaryTerms,
    linkGlossaryTermsInText,
    sortGlossary,
} from "./formatGlossary"

const P_TERM = "population"
const P_SLUG = P_TERM
const PG_TERM = "population growth"
const PG_TERM_CAPITALIZED = "Population Growth"
const PG_SLUG = "population-growth"
const PG_LINK = `<a href="/glossary/${PG_SLUG}">${PG_TERM}</a>`
const PG_LINK_CAPITALIZED = `<a href="/glossary/${PG_SLUG}">${PG_TERM_CAPITALIZED}</a>`

const sectionHtml = `<h3>Within heading: eget ${PG_TERM} justo eleifend</h3>
    <p>Not separated by word boundary (e.g. space): lectus${PG_TERM} mauris.</p>
    <p>Multiple per line: lectus ${PG_TERM} mauris. Vestibulum ${PG_TERM} imperdiet. </p>
    <p>Within a non anchor tag: ex a, <strong>sollicitudin ${PG_TERM}</strong> eros.</p>
    <p>Within an anchor tag: Phasellus sed <a href="/">diam ${PG_TERM} nibh</a> aliquet. <a href="/">Integer sed consequat</a> arcu.</p>
    <p>With case variations: Vivamus ac justo ac ${PG_TERM_CAPITALIZED} sed vel magna.</p>`

const sectionHtmlWithGlossary = `<h3>Within heading: eget ${PG_LINK} justo eleifend</h3>
    <p>Not separated by word boundary (e.g. space): lectus${PG_TERM} mauris.</p>
    <p>Multiple per line: lectus ${PG_LINK} mauris. Vestibulum ${PG_LINK} imperdiet. </p>
    <p>Within a non anchor tag: ex a, <strong>sollicitudin ${PG_LINK}</strong> eros.</p>
    <p>Within an anchor tag: Phasellus sed <a href="/">diam ${PG_TERM} nibh</a> aliquet. <a href="/">Integer sed consequat</a> arcu.</p>
    <p>With case variations: Vivamus ac justo ac ${PG_LINK_CAPITALIZED} sed vel magna.</p>`

const unsortedGlossary = [
    { term: P_TERM, slug: P_SLUG },
    { term: PG_TERM, slug: PG_SLUG },
]

const glossary = sortGlossary(unsortedGlossary)

it("formats one glossary link using the longest possible expression", () => {
    // Here both "population" and "population growth" could be turned into
    // glossary links. "population growth" is selected as it is the longest
    // of the two.
    expect(
        linkGlossaryTermsInText(
            `Vivamus ${PG_TERM} commodo posuere sed vel magna.`,
            glossary
        )
    ).toEqual(
        `Vivamus <a href="/glossary/${PG_SLUG}">${PG_TERM}</a> commodo posuere sed vel magna.`
    )
})

it("formats glossary links", () => {
    const $ = cheerio.load(sectionHtml)
    formatGlossaryTerms($, $("body").contents(), glossary)
    expect($("body").html()).toEqual(sectionHtmlWithGlossary)
})
