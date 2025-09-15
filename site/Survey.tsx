import * as React from "react"
import { useState } from "react"
import * as Sentry from "@sentry/react"
import {
    SurveyQuestion,
    SurveyQuestionType,
    MultipleChoiceQuestion,
    MultiSelectQuestion,
    OpenEndedQuestion,
    LinkQuestion,
} from "@ourworldindata/utils"
import { Button } from "@ourworldindata/components"

export interface SurveyFormProps {
    title?: string
    description?: string
    questions: SurveyQuestion[]
    submitButtonText?: string
    onSubmit?: (responses: Record<string, any>) => void
    className?: string
}

// Component for rendering a multiple choice question
function MultipleChoiceInput({
    question,
    value,
    onChange,
}: {
    question: MultipleChoiceQuestion
    value: string
    onChange: (value: string) => void
}) {
    return (
        <div className="survey-question">
            <label className="survey-question__label">
                {question.text}
                {question.required && <span className="required">*</span>}
            </label>
            <div className="survey-question__options--horizontal">
                {question.options.map((option, index) => (
                    <div key={index} className="owid-radio-block">
                        <input
                            type="radio"
                            id={`${question.id}-${index}`}
                            name={question.id}
                            value={option}
                            checked={value === option}
                            onChange={(e) => onChange(e.target.value)}
                        />
                        <label htmlFor={`${question.id}-${index}`}>
                            {option}
                        </label>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Component for rendering a multi-select question
function MultiSelectInput({
    question,
    value,
    onChange,
}: {
    question: MultiSelectQuestion
    value: string[]
    onChange: (value: string[]) => void
}) {
    const handleOptionChange = (option: string, checked: boolean) => {
        if (checked) {
            onChange([...value, option])
        } else {
            onChange(value.filter((v) => v !== option))
        }
    }

    return (
        <div className="survey-question">
            <label className="survey-question__label">
                {question.text}
                {question.required && <span className="required">*</span>}
            </label>
            <div className="survey-question__options">
                {question.options.map((option, index) => (
                    <div key={index} className="owid-checkbox-block">
                        <input
                            type="checkbox"
                            id={`${question.id}-${index}`}
                            value={option}
                            checked={value.includes(option)}
                            onChange={(e) =>
                                handleOptionChange(option, e.target.checked)
                            }
                        />
                        <label htmlFor={`${question.id}-${index}`}>
                            {option}
                        </label>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Component for rendering an open-ended question
function OpenEndedInput({
    question,
    value,
    onChange,
}: {
    question: OpenEndedQuestion
    value: string
    onChange: (value: string) => void
}) {
    return (
        <div className="survey-question">
            <label className="survey-question__label" htmlFor={question.id}>
                {question.text}
                {question.required && <span className="required">*</span>}
            </label>
            <textarea
                id={question.id}
                className="survey-question__textarea sentry-mask"
                placeholder={
                    question.placeholder || "Please share your thoughts..."
                }
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={4}
            />
        </div>
    )
}

// Component for rendering a link question
function LinkInput({ question }: { question: LinkQuestion }) {
    return (
        <div className="survey-question">
            <span className="survey-question__label">{question.text}</span>
            <Button
                text={question.linkText}
                href={question.url}
                className="survey-question__input"
                theme="solid-blue"
            />
        </div>
    )
}

// Main SurveyForm component
export function SurveyForm({
    title,
    description,
    questions,
    submitButtonText = "Submit Survey",
    onSubmit,
    className = "",
}: SurveyFormProps) {
    const [responses, setResponses] = useState<Record<string, any>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")

    // Update response for a specific question
    const updateResponse = (questionId: string, value: any) => {
        setResponses((prev) => ({
            ...prev,
            [questionId]: value,
        }))
        // Clear any existing error message when user starts interacting
        if (errorMessage) setErrorMessage("")
    }

    // Validate required questions
    const validateForm = (): boolean => {
        for (const question of questions) {
            if (question.required) {
                const response = responses[question.id]
                if (question.type === "multi-select") {
                    if (!response || response.length === 0) {
                        setErrorMessage(
                            `Please answer the required question: "${question.text}"`
                        )
                        return false
                    }
                } else {
                    if (!response || response.toString().trim() === "") {
                        setErrorMessage(
                            `Please answer the required question: "${question.text}"`
                        )
                        return false
                    }
                }
            }
        }
        return true
    }

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) {
            return
        }

        setIsSubmitting(true)
        setErrorMessage("")

        try {
            // Prepare feedback data for Sentry
            const feedbackData = {
                name: "Survey Response",
                email: "", // Could be collected as part of the survey if needed
                message: JSON.stringify(
                    {
                        title: title || "Survey Response",
                        responses: responses,
                        timestamp: new Date().toISOString(),
                        url: window.location.href,
                    },
                    null,
                    2
                ),
            }

            // Send feedback to Sentry
            Sentry.captureFeedback(feedbackData)

            // Call custom onSubmit handler if provided
            if (onSubmit) {
                await onSubmit(responses)
            }

            setIsSubmitted(true)
        } catch (error) {
            console.error("Error submitting survey:", error)
            setErrorMessage(
                "There was an error submitting your survey. Please try again."
            )
            Sentry.captureException(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Show thank you message after successful submission
    if (isSubmitted) {
        return (
            <div className={`survey-form survey-form--submitted ${className}`}>
                <div className="survey-form__success">
                    <h3>Thank you!</h3>
                    <p>Your survey response has been submitted successfully.</p>
                </div>
            </div>
        )
    }

    return (
        <form className={`survey-form ${className}`} onSubmit={handleSubmit}>
            {title && <h2 className="survey-form__title">{title}</h2>}
            {description && (
                <p className="survey-form__description">{description}</p>
            )}

            <div className="survey-form__questions">
                {questions.map((question) => {
                    const key = question.id

                    switch (question.type) {
                        case SurveyQuestionType.MultipleChoice:
                            return (
                                <MultipleChoiceInput
                                    key={key}
                                    question={
                                        question as MultipleChoiceQuestion
                                    }
                                    value={responses[key] || ""}
                                    onChange={(value) =>
                                        updateResponse(key, value)
                                    }
                                />
                            )
                        case SurveyQuestionType.MultiSelect:
                            return (
                                <MultiSelectInput
                                    key={key}
                                    question={question as MultiSelectQuestion}
                                    value={responses[key] || []}
                                    onChange={(value) =>
                                        updateResponse(key, value)
                                    }
                                />
                            )
                        case SurveyQuestionType.OpenEnded:
                            return (
                                <OpenEndedInput
                                    key={key}
                                    question={question}
                                    value={responses[key] || ""}
                                    onChange={(value) =>
                                        updateResponse(key, value)
                                    }
                                />
                            )
                        case SurveyQuestionType.Link:
                            return (
                                <LinkInput
                                    key={key}
                                    question={question as LinkQuestion}
                                />
                            )
                        default:
                            return null
                    }
                })}
            </div>

            {errorMessage && (
                <div className="survey-form__error alert">{errorMessage}</div>
            )}

            <div className="survey-form__submit">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="owid-btn owid-btn--solid-blue"
                    aria-label={submitButtonText}
                >
                    {isSubmitting ? "Submitting..." : submitButtonText}
                </button>
            </div>
        </form>
    )
}
