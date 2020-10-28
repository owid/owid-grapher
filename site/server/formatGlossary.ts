interface GlossaryItem {
    term: string
    slug: string
}

export const getGlossary = (): GlossaryItem[] => {
    // TODO
    const glossary = [
        { term: "population", slug: "population" },
        { term: "population growth", slug: "population-growth" },
    ]

    return sortGlossary(glossary)
}

/*
 * Sort the glossary in descending order of term lengths so that longer terms
 * match and are linked instead of shorter ones, which might be included in
 * them. E.g. favour "population growth" over "population"
 */
export const sortGlossary = (glossary: GlossaryItem[]) => {
    return glossary.sort((a, b) => b.term.length - a.term.length)
}

export const formatGlossaryTerms = (
    $: CheerioStatic,
    $contents: Cheerio,
    glossary: GlossaryItem[]
) => {
    $contents.each((i, el) => {
        if (el.tagName === "a") return
        if (el.type === "text") {
            $(el).replaceWith(linkGlossaryTermsInText(el.data, glossary))
        } else {
            formatGlossaryTerms($, $(el).contents(), glossary)
        }
    })
}

const getGlossaryItemSlug = (term: string, glossary: GlossaryItem[]) => {
    return glossary.find(
        (el: GlossaryItem) => term.toLowerCase() === el.term.toLowerCase()
    )?.slug
}

export const linkGlossaryTermsInText = (
    srcText: string = "",
    glossary: GlossaryItem[]
) => {
    let textWithGlossaryLinks = srcText

    const regex = new RegExp(
        `\\b(${glossary.map((el) => el.term).join("|")})\\b`,
        "ig"
    )

    const getGlossaryLink = (match: string) => {
        return `<a href="/glossary/${getGlossaryItemSlug(
            match,
            glossary
        )}">${match}</a>`
    }

    textWithGlossaryLinks = textWithGlossaryLinks.replace(
        regex,
        getGlossaryLink
    )
    return textWithGlossaryLinks
}
