const DEFAULT_EXPIRY = new Date(Date.now() + 7 * (24 * 60 * 60 * 1000)) // expires in 7 days

export class Survey {
    id: string
    title: string
    description: string
    questions: SurveyQuestion[]
    paths: string[]
    expires: Date

    constructor(data: RawSurvey) {
        this.id = data.id
        this.title = data.title
        this.description = data.description
        // this.questions = data.questions
        this.questions = data.questions.map((q) => {
            return {
                type: q.type as SurveyQuestionType,
                id: q.id,
                text: q.text,
                required: q.required,
                options: q.options,
                placeholder: q.placeholder,
                url: q.url,
                linkText: q.linkText,
            }
        })
        this.paths = data.paths
        this.expires =
            data.expires !== undefined ? new Date(data.expires) : DEFAULT_EXPIRY
    }
    isExpired(): boolean {
        return new Date(this.expires).getTime() < Date.now()
    }

    /*
     * Check if a URL matches any of the survey paths.
     *
     * Checks if the given URL matches any of the paths defined for the
     * survey, following the path-matching rules in https://datatracker.ietf.org/doc/html/rfc6265#section-5.1.4.
     *
     * @param url - The URL to check.
     *
     * @returns `true` if the URL matches any of the survey paths, `false` otherwise.
     */
    isUrlInPaths(url: string): boolean {
        return this.paths.some((path) => {
            // Case 1: Exact match
            if (url === path) {
                return true
            }

            // Case 2: path is a prefix and ends with "/"
            if (path.endsWith("/") && url.startsWith(path)) {
                return true
            }

            // Case 3: path is a prefix and the next character in request path is "/"
            if (url.startsWith(path) && url.charAt(path.length) === "/") {
                return true
            }

            // If none of the above, return false
            return false
        })
    }
}

type RawSurvey = {
    id: string
    title: string
    description: string
    questions: RawSurveyQuestion[]
    paths: string[]
    expires: string
}

type RawSurveyQuestion = {
    type: string
    id: string
    text: string
    required?: boolean
    options?: string[]
    placeholder?: string
    url?: string
    linkText?: string
}

// type enum for each survey type
export enum SurveyQuestionType {
    MultipleChoice = "multiple-choice",
    MultiSelect = "multi-select",
    OpenEnded = "open-ended",
    Link = "link",
}

interface BaseSurveyQuestion {
    type: SurveyQuestionType
    id: string
    text: string
    required?: boolean
}

export type MultipleChoiceQuestion = BaseSurveyQuestion & {
    options: string[]
}
export type MultiSelectQuestion = BaseSurveyQuestion & {
    options: string[]
}
export type OpenEndedQuestion = BaseSurveyQuestion & {
    placeholder?: string
}

export type LinkQuestion = BaseSurveyQuestion & {
    url: string
    linkText: string
}

export type SurveyQuestion =
    | MultipleChoiceQuestion
    | MultiSelectQuestion
    | OpenEndedQuestion
    | LinkQuestion
