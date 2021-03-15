#! /usr/bin/env yarn jest

import { getGrapherSlugs } from "./contentGraph"

const slugs = [
    "share-of-deaths-by-cause",
    "share-of-deaths-by-cause-2016",
    "life-expectancy",
]

const getIframe = (slug: string) => {
    return `<iframe src="http://ourworldindata.org/grapher/${slug}?tab=chart&stackMode=absolute&region=World" loading="lazy" style="width: 100%; height: 600px; border: 0px none;"></iframe>`
}

const getLink = (slug: string) => {
    return `<a href=\"https:\/\/ourworldindata.org\/grapher\/${slug}\">here<\/a>`
}

const getContent = (slugs: string[]) => {
    return `
    <p>Sed lacinia vehicula commodo. Praesent vehicula ipsum nec justo vulputate, at
    pellentesque nisi lacinia. Mauris dapibus non orci ut blandit. Maecenas nibh
    ${getLink(
        slugs[0]
    )} diam, condimentum sed maximus a, egestas sed eros. Ut et massa vulputate lacus
    volutpat lectus. Interdum ${getIframe(
        slugs[1]
    )} et malesuada fames ac ante ipsum primis in faucibus.
    Donec venenatis volutpat velit, a tempor risus mattis ac.
    This is data from Schutte, A. E. (2017). ${getIframe(
        slugs[0]
    )}Global, regional, and national age-sex specific mortality
    for 264 causes of death, 1980-2016: a ${getIframe(
        slugs[2]
    )}systematic analysis for the Global Burden of Disease Study 2016.
    Available <a href=\"http:\/\/www.thelancet.com\/pdfs\/journals\/lancet\/PIIS0140-6736(17)32152-9.pdf\">online<\/a>.
    {\/ref}<\/p>
    `
}

it("extracts unique grapher slugs", () => {
    const matchedSlugsSet = getGrapherSlugs(getContent(slugs))
    const matchedSlugs = Array.from(matchedSlugsSet)

    expect(matchedSlugs).toHaveLength(3)
    matchedSlugs.forEach((slug, idx) => {
        expect(slug).toEqual(slugs[idx])
    })
})
