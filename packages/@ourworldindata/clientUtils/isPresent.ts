// https://github.com/robertmassaioli/ts-is-present
// A predicate for filtering an array of nulls and undefineds that returns the correct type

export const isPresent = <T>(t: T | undefined | null | void): t is T =>
    t !== undefined && t !== null
