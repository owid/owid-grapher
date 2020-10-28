#! /usr/bin/env yarn jest

import * as cheerio from "cheerio"
import { formatGlossaryTerms, FORBIDDEN_TAGS } from "./formatGlossary"

const population = "population"
const population_growth = "population growth"
const Population_Growth = "Population Growth"
const P_SLUG = "population"
const PG_SLUG = "population-growth"
const P_LINK = `<a href="/glossary/${P_SLUG}">${population}</a>`
const PG_LINK = `<a href="/glossary/${PG_SLUG}">${population_growth}</a>`
const PG_LINK_CAPITALIZED = `<a href="/glossary/${PG_SLUG}">${Population_Growth}</a>`

const unsortedGlossary = [
    { term: population, slug: P_SLUG },
    { term: population_growth, slug: PG_SLUG },
]

it("formats glossary terms using the longest possible expression", () => {
    const input = `Vivamus ${population_growth} commodo posuere sed vel magna.`
    const output = `Vivamus ${PG_LINK} commodo posuere sed vel magna.`
    const $ = cheerio.load(input)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(output)
})

it("formats glossary terms within non anchor tags", () => {
    const input = `Within a non anchor tag: ex a, <strong>sollicitudin ${population_growth}</strong> eros.`
    const output = `Within a non anchor tag: ex a, <strong>sollicitudin ${PG_LINK}</strong> eros.`
    const $ = cheerio.load(input)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(output)
})

it("only formats the first occurence of a glossary term", () => {
    const input = `Multiple per line: lectus ${population_growth} mauris. Vestibulum ${population_growth} imperdiet.`
    const output = `Multiple per line: lectus ${PG_LINK} mauris. Vestibulum ${population_growth} imperdiet.`
    const $ = cheerio.load(input)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(output)
})

it("does not format glossary terms with missing word boundaries", () => {
    const input = `Not separated by word boundaries (e.g. space): lectus${population_growth} mauris.`
    const output = input
    const $ = cheerio.load(input)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(output)
})

it("does not format glossary terms within anchor tags", () => {
    const input = `Within an anchor tag: Phasellus sed <a href="/">diam ${population_growth} nibh</a> aliquet.`
    const output = input
    const $ = cheerio.load(input)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(output)
})

it("does not format glossary terms within forbidden tags", () => {
    FORBIDDEN_TAGS.forEach((tag) => {
        const input = `Within a forbidden tag: Phasellus sed <${tag}>diam ${population_growth} nibh</${tag}> aliquet.`
        const output = input
        const $ = cheerio.load(input)
        formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
        expect($("body").html()).toEqual(output)
    })
})

it("matches glossary terms case insensitive and renders them with original case", () => {
    const input = `With case variations: Vivamus ac justo ac ${Population_Growth} sed vel magna.`
    const output = `With case variations: Vivamus ac justo ac ${PG_LINK_CAPITALIZED} sed vel magna.`
    const $ = cheerio.load(input)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(output)
})

it("adds glossary links to entire sections", () => {
    const sectionHtml = `<h3>Within heading: eget ${population_growth} justo eleifend</h3>
    <p>Praesent ut orci porta ${Population_Growth} et ac nunc. Morbi consectetur ${population} nec libero blandit.</p>
    <p>vitae vehicula nunc sodales. Nulla facilisi. Fusce cursus, neque vitae tincidunt vehicula,
    nunc purus tempus ${population_growth}, et facilisis libero justo ${population} dolor. Sed convallis aliquam eros.
    In a ipsum lectus. Aenean luctus dui vitae nulla gravida, sed blandit ex dignissim.</p>`

    const sectionHtmlWithGlossary = `<h3>Within heading: eget ${population_growth} justo eleifend</h3>
    <p>Praesent ut orci porta ${PG_LINK_CAPITALIZED} et ac nunc. Morbi consectetur ${P_LINK} nec libero blandit.</p>
    <p>vitae vehicula nunc sodales. Nulla facilisi. Fusce cursus, neque vitae tincidunt vehicula,
    nunc purus tempus ${population_growth}, et facilisis libero justo ${population} dolor. Sed convallis aliquam eros.
    In a ipsum lectus. Aenean luctus dui vitae nulla gravida, sed blandit ex dignissim.</p>`

    const $ = cheerio.load(sectionHtml)
    formatGlossaryTerms($, $("body").contents(), unsortedGlossary)
    expect($("body").html()).toEqual(sectionHtmlWithGlossary)
})
