import { RelatedQuestionsConfig } from "@ourworldindata/types"

export const getErrorMessageRelatedQuestionUrl = (
    question: RelatedQuestionsConfig
): string | undefined => {
    return question.text
        ? (!question.url && "Missing URL") ||
              (!question.url.match(/^https?:\/\//) &&
                  "URL should start with http(s)://") ||
              undefined
        : undefined
}
