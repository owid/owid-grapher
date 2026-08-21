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

/** @see ./PeopleRows.md */
export type EnrichedBlockPeopleRows = {
    type: "people-rows"
    columns: "2" | "4"
    people: EnrichedBlockPerson[]
} & EnrichedBlockWithParseErrors

/** @see ./People.md */
export type EnrichedBlockPeople = {
    type: "people"
    items: EnrichedBlockPerson[]
} & EnrichedBlockWithParseErrors

/** @see ./Person.md */
export type EnrichedBlockPerson = {
    type: "person"
    image?: string
    name: string
    title?: string
    url?: string
    text: EnrichedBlockText[]
    socials?: EnrichedSocialLink[]
} & EnrichedBlockWithParseErrors
