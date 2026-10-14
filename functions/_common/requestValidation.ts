interface SchemaIssue {
    path: ReadonlyArray<PropertyKey>
    message: string
}

/**
 * Reader-facing copy for a request the schema rejected. The public forms
 * show this text as is, so it can't be zod's developer-oriented output
 * ("✖ Invalid email address → at email").
 */
export function describeInvalidRequest(error: {
    issues: ReadonlyArray<SchemaIssue>
}): string {
    const { issues } = error
    if (issues.some((issue) => issue.path[0] === "email"))
        return "Please enter a valid email address."
    // Custom refinements (no path) carry messages written for readers.
    const refinement = issues.find((issue) => issue.path.length === 0)
    return refinement?.message ?? "Please check your selection and try again."
}
