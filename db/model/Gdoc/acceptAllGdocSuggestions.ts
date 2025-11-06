/**
 * acceptAllGdocSuggestions.ts
 *
 * This module processes Google Docs documents to accept all pending suggestions.
 * It handles three types of suggestions:
 * 1. Deletions: Removes elements marked with suggestedDeletionIds
 * 2. Insertions: Keeps elements but removes suggestedInsertionIds markers
 * 3. Text style changes: Applies suggested text formatting (bold, italic, etc.)
 *
 * The transformation is done recursively, walking the entire document tree.
 */

import { type docs_v1 } from "@googleapis/docs"
import * as R from "remeda"

// Google Docs API keys for suggestion metadata
const SUGGESTED_DELETION_KEY = "suggestedDeletionIds"
const SUGGESTED_INSERTION_KEY = "suggestedInsertionIds"
const SUGGESTED_TEXT_STYLE_CHANGES_KEY = "suggestedTextStyleChanges"

type AnyNode = unknown

/**
 * Checks if a node has been marked for deletion by checking for suggestedDeletionIds
 */
const hasDeletionMarker = (value: AnyNode): boolean =>
    R.isPlainObject(value) &&
    Array.isArray(value[SUGGESTED_DELETION_KEY]) &&
    value[SUGGESTED_DELETION_KEY]!.length > 0

/**
 * Checks if a node contains a textRun that has been marked for deletion
 */
const hasTextRunDeletion = (value: AnyNode): boolean => {
    if (!R.isPlainObject(value)) return false
    const textRun = value.textRun as AnyNode
    return hasDeletionMarker(textRun)
}

/**
 * Applies suggested text style changes to a textRun.
 *
 * Google Docs stores style suggestions separately from the actual style.
 * This function merges suggested changes into the textRun's textStyle property.
 *
 * Style changes work by toggling properties - if a property already exists,
 * suggesting it will remove it. If it doesn't exist, suggesting it will add it.
 *
 * For example:
 * - If text is bold and someone suggests bold, the result is non-bold
 * - If text is not italic and someone suggests italic, the result is italic
 */
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

    // Process each suggested style change
    for (const change of Object.values(suggestedChanges)) {
        // Filter to only the properties that have been suggested (marked as true)
        const stateEntries = Object.entries(
            change.textStyleSuggestionState ?? {}
        ).filter(([, suggested]) => suggested)

        if (stateEntries.length === 0) continue

        const proposedStyle = change.textStyle ?? {}
        const textStyle = ensureTextStyle()

        // Apply each suggested property change
        for (const [stateKey] of stateEntries) {
            // Convert "boldSuggested" -> "bold"
            const propertyName = stateKey.replace(/Suggested$/, "")
            const camelCasedProperty =
                propertyName.charAt(0).toLowerCase() + propertyName.slice(1)
            const newValue =
                proposedStyle[
                    camelCasedProperty as keyof docs_v1.Schema$TextStyle
                ]

            // If the new value is empty/undefined, remove the property (toggling off)
            if (
                newValue === undefined ||
                newValue === null ||
                (R.isPlainObject(newValue) &&
                    Object.keys(newValue).length === 0)
            ) {
                delete textStyle[
                    camelCasedProperty as keyof docs_v1.Schema$TextStyle
                ]
            } else {
                // Otherwise set the new value (toggling on)
                ;(textStyle as Record<string, AnyNode>)[camelCasedProperty] =
                    newValue
            }
        }
    }

    // Clean up the suggestion metadata
    delete textRun[SUGGESTED_TEXT_STYLE_CHANGES_KEY]

    // Clean up empty textStyle object
    if (textRun.textStyle && Object.keys(textRun.textStyle).length === 0) {
        delete textRun.textStyle
    }
}

/**
 * Processes an array recursively, filtering out deleted elements
 */
const processArray = (arr: AnyNode[]): AnyNode[] => {
    const result: AnyNode[] = []
    for (const item of arr) {
        const processed = acceptSuggestionsRecursive(item)
        // If item was marked for deletion, processed will be undefined - don't include it
        if (processed !== undefined) {
            result.push(processed)
        }
    }
    return result
}

/**
 * Recursively walks the document tree and accepts all suggestions.
 *
 * Returns undefined for deleted nodes (which causes them to be filtered out by parent).
 * For other nodes, applies transformations and recurses into children.
 */
const acceptSuggestionsRecursive = (value: AnyNode): AnyNode | undefined => {
    // Base cases: primitives pass through unchanged
    if (value === null || value === undefined) return value

    if (R.isArray(value)) {
        return processArray(value as AnyNode[])
    }

    if (!R.isPlainObject(value)) return value

    const objectValue = value as Record<string, AnyNode>

    // If this node is marked for deletion, return undefined to filter it out
    if (hasDeletionMarker(objectValue)) {
        return undefined
    }

    // Check if the node contains a deleted textRun
    if (hasTextRunDeletion(objectValue)) {
        return undefined
    }

    // Apply text style changes if this node is a textRun
    // Handle both direct textRuns and nodes containing textRuns
    if ("textRun" in objectValue && R.isPlainObject(objectValue.textRun)) {
        const textRun = objectValue.textRun as docs_v1.Schema$TextRun &
            Record<string, AnyNode>
        if (
            Array.isArray(textRun[SUGGESTED_DELETION_KEY]) &&
            textRun[SUGGESTED_DELETION_KEY]!.length > 0
        ) {
            return undefined
        }
        applyTextStyleChanges(textRun)
    } else if (
        "textStyle" in objectValue &&
        R.isPlainObject(objectValue.textStyle)
    ) {
        const textRunCandidate = objectValue as docs_v1.Schema$TextRun
        applyTextStyleChanges(textRunCandidate)
    }

    // Recursively process all child properties
    for (const [key, child] of Object.entries(objectValue)) {
        // Skip processing suggestion metadata keys
        if (key === SUGGESTED_INSERTION_KEY) continue
        if (key === SUGGESTED_TEXT_STYLE_CHANGES_KEY) continue

        const processedChild = acceptSuggestionsRecursive(child)
        if (processedChild === undefined) {
            // Child was deleted, remove it from parent
            delete objectValue[key]
        } else {
            objectValue[key] = processedChild
        }
    }

    // Clean up insertion metadata - we keep the content but remove the marker
    if (SUGGESTED_INSERTION_KEY in objectValue) {
        delete objectValue[SUGGESTED_INSERTION_KEY]
    }

    return objectValue
}

/**
 * Main entry point: accepts all suggestions in a Google Docs document.
 *
 * Creates a deep clone of the document to avoid mutations, then recursively
 * processes the entire document tree to accept all pending suggestions.
 *
 * @param document - The Google Docs document to process
 * @returns A new document with all suggestions accepted
 */
export const acceptAllGdocSuggestions = (
    document: docs_v1.Schema$Document
): docs_v1.Schema$Document => {
    // Create a deep clone to avoid mutating the original
    const mutableDocument = R.clone(document)

    const processed = acceptSuggestionsRecursive(mutableDocument)

    if (!processed) {
        return mutableDocument
    }

    const finalDocument = processed as docs_v1.Schema$Document
    // Mark the document as having suggestions accepted
    finalDocument.suggestionsViewMode = "PREVIEW_SUGGESTIONS_ACCEPTED"
    return finalDocument
}
