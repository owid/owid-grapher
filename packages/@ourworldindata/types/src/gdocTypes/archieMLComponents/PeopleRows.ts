import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"
import { EnrichedSocialLink, RawSocialLink } from "./Socials.js"
import { EnrichedBlockText, RawBlockText } from "./Text.js"

export type RawBlockPerson = {
    type: "person"
    value: {
        image?: string
        name: string
        title?: string
        url?: string
        text: RawBlockText[]
        socials?: RawSocialLink[]
    }
}

export type RawBlockPeopleRows = {
    type: "people-rows"
    value: {
        columns: "2" | "4"
        people: RawBlockPerson[]
    }
}

export type RawBlockPeople = {
    type: "people"
    value: RawBlockPerson[] | ArchieMLUnexpectedNonObjectValue
}

/**
 * A grid of `{.person}` cards, used on about pages to present team
 * members. Wraps an inner `[.+people]` list of people blocks.
 *
 * ## When to use
 * - On about pages (`type: about-page`) to list team, board, or
 *   advisors.
 *
 * ## When NOT to use
 * - Elsewhere.
 *
 * ## Variations
 * - `columns`: `2` or `4` — 4 suits compact cards, 2 suits cards with
 *   longer bios.
 *
 * @owid-component people-rows
 * @owid-title People Rows
 * @example Two-column row
 * ```archie
 * {.people-rows}
 * columns: 2
 *
 * [.+people]
 * {.person}
 * image: Max Roser.jpeg
 * name: Professor Max Roser
 * title: Founder and Executive Co-Director
 * url: https://docs.google.com/document/d/1NfXOk8HVohVYjzJ1rtZYuw8h7kB9cWd5Kqxj4Dg1-WQ/edit
 * [.+text]
 * Max is the founder of Our World in Data.
 * []
 * [.socials]
 * type: x
 * url: https://x.com/MaxCRoser
 * text: @MaxCRoser
 * []
 * {}
 * []
 * {}
 * ```
 */
export type EnrichedBlockPeopleRows = {
    type: "people-rows"
    columns: "2" | "4"
    people: EnrichedBlockPerson[]
} & EnrichedBlockWithParseErrors

export type EnrichedBlockPeople = {
    type: "people"
    items: EnrichedBlockPerson[]
} & EnrichedBlockWithParseErrors

export type EnrichedBlockPerson = {
    type: "person"
    image?: string
    name: string
    title?: string
    url?: string
    text: EnrichedBlockText[]
    socials?: EnrichedSocialLink[]
} & EnrichedBlockWithParseErrors
