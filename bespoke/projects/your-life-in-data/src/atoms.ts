import { atom } from "jotai"

import { HIGHLIGHTS_LABEL, WORLD_CODE } from "./helpers/catalog.js"

// Module-level atoms: all variants of this bundle on a page share the same
// module, so the controls variant and any card variants stay in sync.
export const countryCodeAtom = atom<string>("CZE")
export const birthYearAtom = atom<number>(1993)
export const topicAtom = atom<string>(HIGHLIGHTS_LABEL)
export const compareCodeAtom = atom<string>(WORLD_CODE)
