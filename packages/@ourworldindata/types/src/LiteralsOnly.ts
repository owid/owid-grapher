/**
 * Extracts the literal members of a "literal union with autocomplete", i.e. a
 * union written as `"a" | "b" | (string & {})`, dropping the wide `string`.
 * Note that a plain `"a" | "b" | string` collapses to `string` immediately, so
 * this only works if the wide member was written as `string & {}`.
 * @example
 * type Loose = "a" | "b" | (string & {})
 * type Known = LiteralsOnly<Loose> // "a" | "b"
 */
export type LiteralsOnly<T> = T extends string
    ? string extends T
        ? never
        : T
    : never
