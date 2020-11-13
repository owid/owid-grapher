export const isBlankLine = (line: string[] | undefined) =>
    line === undefined ? true : line.join("") === ""

// Todo: figure out Matrix cell type and whether we need the double check
export const isEmpty = (value: any) => value === "" || value === undefined

// Adapted from: https://github.com/dcporter/didyoumean.js/blob/master/didYouMean-1.2.1.js
export const didYouMean = (
    str = "",
    options: string[] = [],
    caseSensitive = false,
    threshold = 0.4,
    thresholdAbsolute = 20
) => {
    if (!caseSensitive) str = str.toLowerCase()

    // Calculate the initial value (the threshold) if present.
    let maximumEditDistanceToBeBestMatch = Math.min(
        threshold * str.length,
        thresholdAbsolute
    )

    // Get the edit distance to each option. If the closest one is less than 40% (by default) of str's length, then return it.
    let closestMatch
    const len = options.length
    for (let optionIndex = 0; optionIndex < len; optionIndex++) {
        const candidate = options[optionIndex]

        if (!candidate) continue

        const editDistance = getEditDistance(
            str,
            caseSensitive ? candidate : candidate.toLowerCase(),
            maximumEditDistanceToBeBestMatch
        )
        if (editDistance < maximumEditDistanceToBeBestMatch) {
            maximumEditDistanceToBeBestMatch = editDistance
            closestMatch = candidate
        }
    }

    return closestMatch
}

const MAX_INT = Math.pow(2, 32) - 1
const getEditDistance = (stringA: string, stringB: string, maxInt: number) => {
    const aLength = stringA.length
    const bLength = stringB.length

    // Fast path - no A or B.
    if (aLength === 0) return Math.min(maxInt + 1, bLength)
    if (bLength === 0) return Math.min(maxInt + 1, aLength)

    // Fast path - length diff larger than max.
    if (Math.abs(aLength - bLength) > maxInt) return maxInt + 1

    // Slow path.
    const matrix = []

    // Set up the first row ([0, 1, 2, 3, etc]).
    for (let bIndex = 0; bIndex <= bLength; bIndex++) {
        matrix[bIndex] = [bIndex]
    }

    // Set up the first column (same).
    for (let aIndex = 0; aIndex <= aLength; aIndex++) {
        matrix[0][aIndex] = aIndex
    }

    let colMin
    let minJ
    let maxJ

    // Loop over the rest of the columns.
    for (let bIndex = 1; bIndex <= bLength; bIndex++) {
        colMin = MAX_INT
        minJ = 1
        if (bIndex > maxInt) minJ = bIndex - maxInt
        maxJ = bLength + 1
        if (maxJ > maxInt + bIndex) maxJ = maxInt + bIndex
        // Loop over the rest of the rows.
        for (let aIndex = 1; aIndex <= aLength; aIndex++) {
            // If j is out of bounds, just put a large value in the slot.
            if (aIndex < minJ || aIndex > maxJ)
                matrix[bIndex][aIndex] = maxInt + 1
            // Otherwise do the normal Levenshtein thing.
            else {
                // If the characters are the same, there's no change in edit distance.
                if (stringB.charAt(bIndex - 1) === stringA.charAt(aIndex - 1))
                    matrix[bIndex][aIndex] = matrix[bIndex - 1][aIndex - 1]
                // Otherwise, see if we're substituting, inserting or deleting.
                else
                    matrix[bIndex][aIndex] = Math.min(
                        matrix[bIndex - 1][aIndex - 1] + 1, // Substitute
                        Math.min(
                            matrix[bIndex][aIndex - 1] + 1, // Insert
                            matrix[bIndex - 1][aIndex] + 1
                        )
                    ) // Delete
            }

            // Either way, update colMin.
            if (matrix[bIndex][aIndex] < colMin) colMin = matrix[bIndex][aIndex]
        }

        // If this column's minimum is greater than the allowed maximum, there's no point
        // in going on with life.
        if (colMin > maxInt) return maxInt + 1
    }
    // If we made it this far without running into the max, then return the final matrix value.
    return matrix[bLength][aLength]
}
