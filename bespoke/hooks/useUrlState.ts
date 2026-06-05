import { useState } from "react"
import { useQueryState, type SingleParserBuilder } from "nuqs"

export function useUrlState<T extends NonNullable<unknown>>({
    key,
    parser,
    defaultValue,
    enabled,
}: {
    key: string
    parser: SingleParserBuilder<T>
    defaultValue: T
    enabled: boolean
}): [T, (next: T) => void] {
    const local = useState<T>(defaultValue)
    const [urlValue, setUrl] = useQueryState(
        key,
        parser.withDefault(defaultValue)
    )
    if (enabled) return [urlValue, setUrl]
    return local
}
