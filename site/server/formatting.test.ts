#! /usr/bin/env yarn jest

import * as cheerio from "cheerio"
import { formatGlossaryTerms } from "./formatGlossary"

const P_TERM = "population"
const P_SLUG = P_TERM
const PG_TERM = "population growth"
const PG_TERM_CAPITALIZED = "Population Growth"
const PG_SLUG = "population-growth"
const P_LINK = `<a href="/glossary/${P_SLUG}">${P_TERM}</a>`
const PG_LINK = `<a href="/glossary/${PG_SLUG}">${PG_TERM}</a>`
const PG_LINK_CAPITALIZED = `<a href="/glossary/${PG_SLUG}">${PG_TERM_CAPITALIZED}</a>`

const unsortedGlossary = [
    { term: P_TERM, slug: P_SLUG },
    { term: PG_TERM, slug: PG_SLUG },
]

it("formats glossary terms using the longest possible expression", () => {
    const input = `Vivamus ${PG_TERM} commodo posuere sed vel magna.`
    const output = `Vivamus ${PG_LINK} commodo posuere sed vel magna.`
    const $ = cheerio.load(input)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(output)
})

it("formats glossary terms within non anchor tags", () => {
    const input = `Within a non anchor tag: ex a, <strong>sollicitudin ${PG_TERM}</strong> eros.`
    const output = `Within a non anchor tag: ex a, <strong>sollicitudin ${PG_LINK}</strong> eros.`
    const $ = cheerio.load(input)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(output)
})

it("only formats the first occurence of a glossary term", () => {
    const input = `Multiple per line: lectus ${PG_TERM} mauris. Vestibulum ${PG_TERM} imperdiet.`
    const output = `Multiple per line: lectus ${PG_LINK} mauris. Vestibulum ${PG_TERM} imperdiet.`
    const $ = cheerio.load(input)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(output)
})

it("does not format glossary terms with missing word boundaries", () => {
    const input = `Not separated by word boundaries (e.g. space): lectus${PG_TERM} mauris.`
    const output = input
    const $ = cheerio.load(input)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(output)
})

it("does not format glossary terms within anchor tags", () => {
    const input = `Within an anchor tag: Phasellus sed <a href="/">diam ${PG_TERM} nibh</a> aliquet.`
    const output = input
    const $ = cheerio.load(input)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(output)
})

it("matches glossary terms case insensitive and renders them with original case", () => {
    const input = `With case variations: Vivamus ac justo ac ${PG_TERM_CAPITALIZED} sed vel magna.`
    const output = `With case variations: Vivamus ac justo ac ${PG_LINK_CAPITALIZED} sed vel magna.`
    const $ = cheerio.load(input)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(output)
})

it("adds glossary links to entire sections", () => {
    const sectionHtml = `<h3>Within heading: eget ${PG_TERM} justo eleifend</h3>
    <p>Praesent ut orci porta ${PG_TERM} et ac nunc. Morbi consectetur ${P_TERM} nec libero blandit.</p>
    <p>vitae vehicula nunc sodales. Nulla facilisi. Fusce cursus, neque vitae tincidunt vehicula,
    nunc purus tempus ${PG_TERM_CAPITALIZED}, et facilisis libero justo ${P_TERM} dolor. Sed convallis aliquam eros.
    In a ipsum lectus. Aenean luctus dui vitae nulla gravida, sed blandit ex dignissim.</p>`

    const sectionHtmlWithGlossary = `<h3>Within heading: eget ${PG_LINK} justo eleifend</h3>
    <p>Praesent ut orci porta ${P_LINK} growth et ac nunc. Morbi consectetur ${P_TERM} nec libero blandit.</p>
    <p>vitae vehicula nunc sodales. Nulla facilisi. Fusce cursus, neque vitae tincidunt vehicula,
    nunc purus tempus ${PG_TERM_CAPITALIZED}, et facilisis libero justo ${P_TERM} dolor. Sed convallis aliquam eros.
    In a ipsum lectus. Aenean luctus dui vitae nulla gravida, sed blandit ex dignissim.</p>`

    const $ = cheerio.load(sectionHtml)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(sectionHtmlWithGlossary)
})
