declare const __nominal__type: unique symbol
/** Typescript is structurally typed, not nominally typed. This means that
 * two types are considered equivalent if their members are equivalent.
 * This is often useful but sometimes you want to distingish types based on their
 * name alone - e.g. if you have an identifier that is just a string but you'd like
 * some type safety when using it. This is where this nominal type comes in.
 * @example
 * type UserName = Nominal<string, "UserName">
 * type UserId = Nominal<string, "UserId">
 *
 * function getUserName(name: UserName) {
 *     return name
 * }
 *
 * const name = getUserName("123" as UserName)   // OK
 * const name2 = getUserName("123")              // Error
 * const name3 = getUserName("123" as UserId)    // Error
 * // of course the main benefit comes when the UserName and UserId types are used in a more complex call hierarchy
 */
export type Nominal<Type, Identifier> = Type & {
    readonly [__nominal__type]: Identifier
}

export function wrap<T, I>(obj: T): Nominal<T, I> {
    return obj as Nominal<T, I>
}

export function unwrap<T, I>(obj: Nominal<T, I>): T {
    return obj
}
