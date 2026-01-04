interface ArchieLineParserOptions {
    comments?: boolean
}

type ArchieScopeType = "[" | "{"

interface ArchieStackScope {
    array: unknown[] | null
    arrayType: "simple" | "complex" | "freeform" | null
    arrayFirstKey: string | null
    flags: string
    scope: Record<string, unknown>
}

const whitespacePattern =
    "\\u0000\\u0009\\u000A\\u000B\\u000C\\u000D\\u0020\\u00A0\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200A\\u200B\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF"
const slugBlacklist = `${whitespacePattern}\\u005B\\u005C\\u005D\\u007B\\u007D\\u003A`

const startKey = new RegExp(
    `^\\s*([^${slugBlacklist}]+)[ \\t\\r]*:[ \\t\\r]*(.*)$`
)
const commandKey = new RegExp(
    "^\\s*:[ \\t\\r]*(endskip|ignore|skip|end).*?$",
    "i"
)
const arrayElement = new RegExp("^\\s*\\*[ \\t\\r]*(.*)$")
const scopeMarkerOnly = new RegExp(
    `^\\s*(\\[|\\{)[ \\t\\r]*([\\+\\.]*)[ \\t\\r]*([^${slugBlacklist}]*)[ \\t\\r]*(\\]|\\})\\s*$`
)

export function loadArchieFromLines(
    lines: string[],
    options: ArchieLineParserOptions = {}
): Record<string, unknown> {
    const data: Record<string, unknown> = {}
    let scope: Record<string, unknown> = data

    let stack: ArchieStackScope[] = []
    let stackScope: ArchieStackScope | undefined

    let bufferScope: Record<string, unknown> | null = null
    let bufferKey: string | unknown[] | null = null
    let bufferString = ""
    let isSkipping = false

    const commentsEnabled = options.comments === true

    const flushBuffer = (): string => {
        const result = bufferString + ""
        bufferString = ""
        bufferKey = null
        return result
    }

    const formatValue = (value: string, type: "replace" | "append"): string => {
        if (commentsEnabled) {
            value = value.replace(/(?:^\\)?\[[^\[\]\n\r]*\](?!\])/gm, "")
            value = value.replace(/\[\[([^\[\]\n\r]*)\]\]/g, "[$1]")
        }

        if (type === "append") {
            value = value.replace(/^(\\s*)\\\\/gm, "$1")
        }

        return value
    }

    const flushBufferInto = (
        key: string | unknown[],
        options: { replace?: boolean } = {}
    ): void => {
        const existingBufferKey = bufferKey
        let value = flushBuffer()

        if (options.replace) {
            value = formatValue(value, "replace").replace(/^\s*/, "")
            bufferString = /\s*$/.exec(value)?.[0] ?? ""
            bufferKey = existingBufferKey
        } else {
            value = formatValue(value, "append")
        }

        if (Array.isArray(key)) {
            if (options.replace) key[key.length - 1] = ""
            key[key.length - 1] += value.replace(/\s*$/, "")
        } else {
            const keyBits = key.split(".")
            bufferScope = scope

            for (let i = 0; i < keyBits.length - 1; i++) {
                const bit = keyBits[i]
                if (typeof bufferScope[bit] === "string") {
                    bufferScope[bit] = {}
                }
                bufferScope = (bufferScope[bit] as Record<string, unknown>) ?? {}
                bufferScope[bit] = bufferScope[bit] ?? {}
            }

            const lastBit = keyBits[keyBits.length - 1]
            if (options.replace) bufferScope[lastBit] = ""
            bufferScope[lastBit] = String(bufferScope[lastBit] ?? "")
            bufferScope[lastBit] += value.replace(/\s*$/, "")
        }
    }

    const incrementArrayElement = (key: string, flags = ""): void => {
        if (!stackScope || !stackScope.array) return

        stackScope.arrayType = stackScope.arrayType || "complex"
        if (stackScope.arrayType === "simple") return

        if (
            stackScope.arrayFirstKey === null ||
            stackScope.arrayFirstKey === key
        ) {
            const nextScope: Record<string, unknown> = {}
            stackScope.array.push(nextScope)
            scope = nextScope
        }

        if (stackScope.flags.includes("+")) {
            scope.type = key
        } else {
            stackScope.arrayFirstKey = stackScope.arrayFirstKey || key
        }
    }

    const parseStartKey = (key: string, restOfLine: string): void => {
        flushBuffer()
        incrementArrayElement(key)

        if (stackScope && stackScope.flags.includes("+")) key = "value"

        bufferKey = key
        bufferString = restOfLine
        flushBufferInto(key, { replace: true })
    }

    const parseArrayElement = (value: string): void => {
        flushBuffer()

        if (!stackScope || !stackScope.array) return

        stackScope.arrayType = stackScope.arrayType || "simple"
        stackScope.array.push("")
        bufferKey = stackScope.array
        bufferString = value
        flushBufferInto(stackScope.array, { replace: true })
    }

    const parseCommandKey = (command: string): void => {
        if (isSkipping && !(command === "endskip" || command === "ignore")) {
            flushBuffer()
            return
        }

        switch (command) {
            case "end":
                if (bufferKey) flushBufferInto(bufferKey, { replace: false })
                return
            case "ignore":
                stack = []
                stackScope = undefined
                scope = data
                return
            case "skip":
                isSkipping = true
                break
            case "endskip":
                isSkipping = false
                break
        }

        flushBuffer()
    }

    const parseScope = (
        scopeType: ArchieScopeType,
        flags: string,
        scopeKey: string
    ): void => {
        flushBuffer()

        if (scopeKey === "") {
            const lastStackItem = stack.pop()
            scope = (lastStackItem ? lastStackItem.scope : data) || data
            stackScope = stack[stack.length - 1]
            return
        }

        let nesting = false
        let keyScope: Record<string, unknown> = data

        if (flags.includes(".")) {
            incrementArrayElement(scopeKey, flags)
            nesting = true
            if (stackScope) keyScope = scope
        } else {
            scope = data
            stack = []
        }

        let parsedScopeKey = scopeKey

        if (stackScope && stackScope.flags.includes("+")) {
            parsedScopeKey = scopeKey
        } else {
            const keyBits = scopeKey.split(".")
            for (let i = 0; i < keyBits.length - 1; i++) {
                const bit = keyBits[i]
                keyScope[bit] = (keyScope[bit] as Record<string, unknown>) ?? {}
                keyScope = keyScope[bit] as Record<string, unknown>
            }
            parsedScopeKey = keyBits[keyBits.length - 1]
        }

        const stackScopeItem: ArchieStackScope = {
            array: null,
            arrayType: null,
            arrayFirstKey: null,
            flags,
            scope,
        }

        const isNestedFreeform =
            stackScope && stackScope.flags.includes("+") && flags.includes(".")

        if (scopeType === "[") {
            if (isNestedFreeform) parsedScopeKey = "value"
            const nextArray: unknown[] = []
            keyScope[parsedScopeKey] = nextArray
            stackScopeItem.array = nextArray
            if (flags.includes("+")) stackScopeItem.arrayType = "freeform"
            if (nesting) {
                stack.push(stackScopeItem)
            } else {
                stack = [stackScopeItem]
            }
            stackScope = stack[stack.length - 1]
        } else if (scopeType === "{") {
            if (nesting) {
                if (isNestedFreeform) {
                    const nextScope: Record<string, unknown> = {}
                    scope.value = nextScope
                    scope = nextScope
                } else {
                    const nextScope: Record<string, unknown> = {}
                    keyScope[parsedScopeKey] = nextScope
                    keyScope = nextScope
                    scope = nextScope
                }
                stack.push(stackScopeItem)
            } else {
                const existing = keyScope[parsedScopeKey]
                const nextScope =
                    typeof existing === "object" && existing !== null
                        ? (existing as Record<string, unknown>)
                        : {}
                keyScope[parsedScopeKey] = nextScope
                scope = nextScope
                stack = [stackScopeItem]
            }
            stackScope = stack[stack.length - 1]
        }
    }

    const parseText = (text: string): void => {
        if (
            stackScope &&
            stackScope.flags.includes("+") &&
            /[^\n\r\s]/.test(text)
        ) {
            stackScope.array?.push({
                type: "text",
                value: text.replace(/(^\s*)|(\s*$)/g, ""),
            })
        } else {
            bufferString += text
        }
    }

    const hadTrailingNewline =
        lines.length > 0 && lines[lines.length - 1] === ""

    lines.forEach((line, index) => {
        const lineHasNewline =
            index < lines.length - 1 || hadTrailingNewline
        const lineText = line.replace(/\r/g, "")
        const textWithNewline = lineHasNewline ? `${lineText}\n` : lineText

        const commandMatch = commandKey.exec(lineText)
        if (commandMatch) {
            parseCommandKey(commandMatch[1].toLowerCase())
            return
        }

        if (
            !isSkipping &&
            startKey.exec(lineText) &&
            (!stackScope || stackScope.arrayType !== "simple")
        ) {
            const match = startKey.exec(lineText)
            if (match) {
                parseStartKey(match[1], match[2] ?? "")
                return
            }
        }

        if (
            !isSkipping &&
            arrayElement.exec(lineText) &&
            stackScope &&
            stackScope.array &&
            stackScope.arrayType !== "complex" &&
            stackScope.arrayType !== "freeform" &&
            !stackScope.flags.includes("+")
        ) {
            const match = arrayElement.exec(lineText)
            if (match) {
                parseArrayElement(match[1] ?? "")
                return
            }
        }

        if (!isSkipping && scopeMarkerOnly.exec(lineText)) {
            const match = scopeMarkerOnly.exec(lineText)
            if (match) {
                const scopeType = match[1] as ArchieScopeType
                const flags = match[2] ?? ""
                const slug = (match[3] ?? "").trim()

                if (slug.toLowerCase() === "ref") {
                    parseText(textWithNewline)
                    return
                }

                parseScope(scopeType, flags, slug)
                return
            }
        }

        parseText(textWithNewline)
    })

    flushBuffer()
    return data
}
