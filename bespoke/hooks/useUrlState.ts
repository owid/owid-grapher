import { useState } from "react"
import { useQueryState, type SingleParserBuilder } from "nuqs"

import { useEmbedConfig } from "./useEmbedConfig.js"

export function useUrlState<T extends NonNullable<unknown>>({
    key,
    parser,
    defaultValue,
}: {
    key: string
    parser: SingleParserBuilder<T>
    defaultValue: T
}): [T, (next: T) => void] {
    const { urlSync } = useEmbedConfig()
    const local = useState<T>(defaultValue)
    const [urlValue, setUrl] = useQueryState(
        key,
        parser.withDefault(defaultValue)
    )
    if (urlSync) return [urlValue, setUrl]
    return local
}
