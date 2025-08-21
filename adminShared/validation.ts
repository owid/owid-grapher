export const NARRATIVE_CHART_KEBAB_CASE_ERROR_MSG =
    "Name must be in lower kebab case (e.g., my-chart-name)"
export const KEBAB_CASE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isKebabCase(value: string): boolean {
    return KEBAB_CASE_REGEX.test(value)
}

export const MULTER_UPLOADS_DIRECTORY = "tmp-uploads/"
