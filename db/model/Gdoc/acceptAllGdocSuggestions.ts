import { type docs_v1 } from "@googleapis/docs"

const SUGGESTED_DELETION_KEY = "suggestedDeletionIds"
const SUGGESTED_INSERTION_KEY = "suggestedInsertionIds"
const SUGGESTED_TEXT_STYLE_CHANGES_KEY = "suggestedTextStyleChanges"

type AnyNode = unknown

const isObject = (value: unknown): value is Record<string, AnyNode> =>
    typeof value === "object" && value !== null

const isArray = (value: unknown): value is AnyNode[] => Array.isArray(value)

const hasDeletionMarker = (value: AnyNode): boolean =>
    isObject(value) &&
    Array.isArray(value[SUGGESTED_DELETION_KEY]) &&
    value[SUGGESTED_DELETION_KEY]!.length > 0

const hasTextRunDeletion = (value: AnyNode): boolean => {
    if (!isObject(value)) return false
    const textRun = value.textRun as AnyNode
    return (
        isObject(textRun) &&
        Array.isArray(textRun[SUGGESTED_DELETION_KEY]) &&
        textRun[SUGGESTED_DELETION_KEY].length > 0
    )
}

const applyTextStyleChanges = (textRun: docs_v1.Schema$TextRun): void => {
    const suggestedChanges = textRun[SUGGESTED_TEXT_STYLE_CHANGES_KEY] as
        | Record<
              string,
              {
                  textStyle?: docs_v1.Schema$TextStyle
                  textStyleSuggestionState?: Record<string, boolean>
              }
          >
        | undefined

    if (!suggestedChanges) return

    const ensureTextStyle = (): docs_v1.Schema$TextStyle => {
        if (!textRun.textStyle) textRun.textStyle = {}
        return textRun.textStyle
    }

    for (const change of Object.values(suggestedChanges)) {
        const stateEntries = Object.entries(
            change.textStyleSuggestionState ?? {}
        ).filter(([, suggested]) => suggested)

        if (stateEntries.length === 0) continue

        const proposedStyle = change.textStyle ?? {}
        const textStyle = ensureTextStyle()

        for (const [stateKey] of stateEntries) {
            const propertyName = stateKey.replace(/Suggested$/, "")
            const camelCasedProperty =
                propertyName.charAt(0).toLowerCase() + propertyName.slice(1)
            const newValue =
                proposedStyle[
                    camelCasedProperty as keyof docs_v1.Schema$TextStyle
                ]

            if (
                newValue === undefined ||
                newValue === null ||
                (isObject(newValue) && Object.keys(newValue).length === 0)
            ) {
                delete textStyle[
                    camelCasedProperty as keyof docs_v1.Schema$TextStyle
                ]
            } else {
                ;(textStyle as Record<string, AnyNode>)[camelCasedProperty] =
                    newValue
            }
        }
    }

    delete textRun[SUGGESTED_TEXT_STYLE_CHANGES_KEY]

    if (textRun.textStyle && Object.keys(textRun.textStyle).length === 0) {
        delete textRun.textStyle
    }
}

const processArray = (arr: AnyNode[]): AnyNode[] => {
    const result: AnyNode[] = []
    for (const item of arr) {
        const processed = acceptSuggestionsRecursive(item)
        if (processed !== undefined) {
            result.push(processed)
        }
    }
    return result
}

const acceptSuggestionsRecursive = (value: AnyNode): AnyNode | undefined => {
    if (value === null || value === undefined) return value

    if (isArray(value)) {
        return processArray(value)
    }

    if (!isObject(value)) return value

    const objectValue = value as Record<string, AnyNode>

    if (hasDeletionMarker(objectValue)) {
        return undefined
    }

    if (hasTextRunDeletion(objectValue)) {
        return undefined
    }

    // If this node is a textRun itself, apply style changes before processing nested objects
    if ("textRun" in objectValue && isObject(objectValue.textRun)) {
        const textRun = objectValue.textRun as docs_v1.Schema$TextRun &
            Record<string, AnyNode>
        if (
            Array.isArray(textRun[SUGGESTED_DELETION_KEY]) &&
            textRun[SUGGESTED_DELETION_KEY]!.length > 0
        ) {
            return undefined
        }
        applyTextStyleChanges(textRun)
    } else if ("textStyle" in objectValue && isObject(objectValue.textStyle)) {
        const textRunCandidate = objectValue as docs_v1.Schema$TextRun
        applyTextStyleChanges(textRunCandidate)
    }

    for (const [key, child] of Object.entries(objectValue)) {
        if (key === SUGGESTED_INSERTION_KEY) continue
        if (key === SUGGESTED_TEXT_STYLE_CHANGES_KEY) continue

        const processedChild = acceptSuggestionsRecursive(child)
        if (processedChild === undefined) {
            delete objectValue[key]
        } else {
            objectValue[key] = processedChild
        }
    }

    if (SUGGESTED_INSERTION_KEY in objectValue) {
        delete objectValue[SUGGESTED_INSERTION_KEY]
    }

    return objectValue
}

export const acceptAllGdocSuggestions = (
    document: docs_v1.Schema$Document
): docs_v1.Schema$Document => {
    const mutableDocument =
        typeof structuredClone === "function"
            ? structuredClone(document)
            : (JSON.parse(JSON.stringify(document)) as docs_v1.Schema$Document)
    const processed = acceptSuggestionsRecursive(mutableDocument)
    if (!processed) {
        return mutableDocument
    }
    const finalDocument = processed as docs_v1.Schema$Document
    finalDocument.suggestionsViewMode = "PREVIEW_SUGGESTIONS_ACCEPTED"
    return finalDocument
}
