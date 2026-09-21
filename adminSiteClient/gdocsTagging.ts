import { OwidGdocType } from "@ourworldindata/utils"

const UNTAGGABLE_GDOC_TYPES = [
    OwidGdocType.AboutPage,
    OwidGdocType.Author,
    OwidGdocType.Fragment,
    OwidGdocType.Homepage,
]

export function checkCanTagGdocType(type: OwidGdocType | undefined): boolean {
    return !!type && !UNTAGGABLE_GDOC_TYPES.includes(type)
}
