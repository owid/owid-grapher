import { useCallback, useEffect, useId, useRef, useState } from "react"
import {
    ExpandableToggle,
    SimpleMarkdownText,
} from "@ourworldindata/components"
import { faThumbsDown, faThumbsUp } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

const ASK_CHART_API_ENDPOINT = "/api/ask-chart"
const ASK_CHART_FAQ_API_ENDPOINT = "/api/ask-chart/faq"
const MAX_QUESTION_LENGTH = 500
const MAX_FEEDBACK_REASON_LENGTH = 2000
const MAX_HISTORY_MESSAGES = 8

// Shown as clickable prompts if the generated FAQs are unavailable
const FALLBACK_QUESTIONS = [
    "What does this chart show?",
    "Where does this data come from?",
    "How reliable is this data?",
    "What could explain sudden jumps or drops?",
]

const GENERIC_ERROR_MESSAGE =
    "Sorry, something went wrong while answering your question. Please try again."

interface AskThisChartMessage {
    role: "user" | "assistant"
    content: string
}

interface AskThisChartFaq {
    question: string
    answer: string
}

// Thumbs up/down rating for a single answer. On thumbs-down, reveals an
// optional free-text field to say what was wrong. The rating is recorded as
// soon as it's clicked, so a thumbs-down still counts even if no reason is
// given; submitting a reason overwrites that record (same responseId).
function AnswerFeedback({
    slug,
    source,
    question,
    answer,
}: {
    slug: string
    source: "faq" | "chat"
    question: string
    answer: string
}) {
    const [rating, setRating] = useState<"up" | "down" | undefined>(undefined)
    const [reason, setReason] = useState("")
    const [isDone, setIsDone] = useState(false)
    const reasonFieldId = useId()

    // Prototype: feedback is only logged client-side for now. To persist it,
    // POST this payload to a backend endpoint (e.g. /api/ask-chart/feedback).
    const recordFeedback = (
        ratingValue: "up" | "down",
        reasonValue?: string
    ): void => {
        // eslint-disable-next-line no-console
        console.log("ask-this-chart feedback", {
            slug,
            source,
            rating: ratingValue,
            question,
            answer,
            reason: reasonValue,
        })
    }

    const handleRate = (ratingValue: "up" | "down"): void => {
        setRating(ratingValue)
        recordFeedback(ratingValue)
        if (ratingValue === "up") setIsDone(true)
    }

    if (isDone)
        return (
            <p className="ask-this-chart__feedback-thanks">
                Thanks for your feedback.
            </p>
        )

    return (
        <div className="ask-this-chart__feedback">
            {!rating && (
                <div className="ask-this-chart__feedback-rate">
                    <span className="ask-this-chart__feedback-label">
                        Was this helpful?
                    </span>
                    <button
                        type="button"
                        className="ask-this-chart__feedback-button"
                        aria-label="Yes, this answer was helpful"
                        onClick={() => handleRate("up")}
                    >
                        <FontAwesomeIcon icon={faThumbsUp} />
                    </button>
                    <button
                        type="button"
                        className="ask-this-chart__feedback-button"
                        aria-label="No, this answer was not helpful"
                        onClick={() => handleRate("down")}
                    >
                        <FontAwesomeIcon icon={faThumbsDown} />
                    </button>
                </div>
            )}
            {rating === "down" && (
                <form
                    className="ask-this-chart__feedback-reason"
                    onSubmit={(event) => {
                        event.preventDefault()
                        const trimmedReason = reason.trim()
                        if (trimmedReason) recordFeedback("down", trimmedReason)
                        setIsDone(true)
                    }}
                >
                    <label
                        className="ask-this-chart__feedback-reason-label"
                        htmlFor={reasonFieldId}
                    >
                        What was wrong with this answer? (optional)
                    </label>
                    <textarea
                        id={reasonFieldId}
                        className="ask-this-chart__feedback-reason-input"
                        value={reason}
                        maxLength={MAX_FEEDBACK_REASON_LENGTH}
                        rows={3}
                        onChange={(event) => setReason(event.target.value)}
                    />
                    <button
                        type="submit"
                        className="ask-this-chart__feedback-reason-submit"
                    >
                        Send
                    </button>
                </form>
            )}
        </div>
    )
}

export default function AskThisChart({ slug }: { slug: string }) {
    const [faqs, setFaqs] = useState<AskThisChartFaq[] | undefined>(undefined)
    const [isLoadingFaqs, setIsLoadingFaqs] = useState(true)
    const [messages, setMessages] = useState<AskThisChartMessage[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)
    const [isQuestionBarExpanded, setIsQuestionBarExpanded] = useState(false)
    const abortControllerRef = useRef<AbortController | undefined>(undefined)
    const inputRef = useRef<HTMLInputElement>(null)

    // Load the pre-generated, chart-specific FAQ entries
    useEffect(() => {
        const abortController = new AbortController()
        const loadFaqs = async (): Promise<void> => {
            try {
                const response = await fetch(
                    `${ASK_CHART_FAQ_API_ENDPOINT}?slug=${encodeURIComponent(slug)}`,
                    { signal: abortController.signal }
                )
                if (!response.ok) return
                const parsed = (await response.json()) as {
                    faqs?: AskThisChartFaq[]
                }
                if (parsed.faqs?.length) setFaqs(parsed.faqs)
            } catch {
                // The FAQ section is optional — fall back to generic questions
            } finally {
                if (!abortController.signal.aborted) setIsLoadingFaqs(false)
            }
        }
        void loadFaqs()
        return () => abortController.abort()
    }, [slug])

    // Focus the input when the visitor expands the question bar
    useEffect(() => {
        if (isQuestionBarExpanded) inputRef.current?.focus()
    }, [isQuestionBarExpanded])

    const askQuestion = useCallback(
        async (question: string): Promise<void> => {
            const trimmedQuestion = question.trim()
            if (!trimmedQuestion) return

            abortControllerRef.current?.abort()
            const abortController = new AbortController()
            abortControllerRef.current = abortController

            const history = messages.slice(-MAX_HISTORY_MESSAGES)
            setMessages((previous) => [
                ...previous,
                { role: "user", content: trimmedQuestion },
                { role: "assistant", content: "" },
            ])
            setInput("")
            setError(undefined)
            setIsLoading(true)

            const updateAnswer = (content: string): void =>
                setMessages((previous) => [
                    ...previous.slice(0, -1),
                    { role: "assistant", content },
                ])

            try {
                const response = await fetch(ASK_CHART_API_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        slug,
                        question: trimmedQuestion,
                        history,
                    }),
                    signal: abortController.signal,
                })
                if (!response.ok || !response.body) {
                    let message = GENERIC_ERROR_MESSAGE
                    try {
                        const parsed = (await response.json()) as {
                            error?: string
                        }
                        if (parsed.error) message = parsed.error
                    } catch {
                        // Keep the generic message
                    }
                    throw new Error(message)
                }

                const reader = response.body.getReader()
                const decoder = new TextDecoder()
                let answer = ""
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    answer += decoder.decode(value, { stream: true })
                    updateAnswer(answer)
                }
                if (!answer.trim()) throw new Error(GENERIC_ERROR_MESSAGE)
            } catch (caughtError) {
                if ((caughtError as Error).name === "AbortError") return
                // Drop the empty assistant placeholder so the error banner
                // takes its place
                setMessages((previous) => {
                    const last = previous.at(-1)
                    return last?.role === "assistant" && !last.content
                        ? previous.slice(0, -1)
                        : previous
                })
                setError(
                    caughtError instanceof Error && caughtError.message
                        ? caughtError.message
                        : GENERIC_ERROR_MESSAGE
                )
            } finally {
                if (abortControllerRef.current === abortController)
                    setIsLoading(false)
            }
        },
        [messages, slug]
    )

    const faqsUnavailable = !isLoadingFaqs && !faqs
    const showFallbackQuestions = faqsUnavailable && messages.length === 0
    // Keep the freeform question bar hidden by default; reveal it when the
    // visitor asks for it, once a conversation is underway, or as the primary
    // entry point when the generated FAQs couldn't be loaded.
    const showQuestionBar =
        isQuestionBarExpanded || messages.length > 0 || faqsUnavailable

    return (
        <div className="ask-this-chart-wrapper span-cols-14 grid grid-cols-12-full-width">
            <h2 className="h2-bold span-cols-9 col-start-2 col-md-start-2 span-md-cols-12 col-sm-start-2 span-sm-cols-12">
                Common questions about this chart
            </h2>
            <div className="ask-this-chart span-cols-9 col-start-2 col-md-start-2 span-md-cols-12 col-sm-start-2 span-sm-cols-12">
                <p className="ask-this-chart__intro">
                    Answered by an AI model based on the chart's data and source
                    documentation.
                </p>
                {isLoadingFaqs && (
                    <p className="ask-this-chart__faqs-loading">
                        Loading questions about this chart…
                    </p>
                )}
                {faqs && (
                    <div className="ask-this-chart__faqs">
                        {faqs.map((faq) => (
                            <ExpandableToggle
                                key={faq.question}
                                label={faq.question}
                                isStacked
                                content={
                                    <div className="ask-this-chart__faq-answer">
                                        <SimpleMarkdownText text={faq.answer} />
                                        <AnswerFeedback
                                            slug={slug}
                                            source="faq"
                                            question={faq.question}
                                            answer={faq.answer}
                                        />
                                    </div>
                                }
                            />
                        ))}
                    </div>
                )}
                {showFallbackQuestions && (
                    <div className="ask-this-chart__suggestions">
                        {FALLBACK_QUESTIONS.map((question) => (
                            <button
                                key={question}
                                type="button"
                                className="ask-this-chart__suggestion"
                                disabled={isLoading}
                                onClick={() => void askQuestion(question)}
                            >
                                {question}
                            </button>
                        ))}
                    </div>
                )}
                {!showQuestionBar && !isLoadingFaqs && (
                    <button
                        type="button"
                        className="ask-this-chart__ask-toggle"
                        onClick={() => setIsQuestionBarExpanded(true)}
                    >
                        Have a different question? Ask about this chart
                    </button>
                )}
                {showQuestionBar && (
                    <div className="ask-this-chart__ask-panel">
                        {messages.length > 0 && (
                            <div className="ask-this-chart__conversation">
                                {messages.map((message, messageIndex) =>
                                    message.role === "user" ? (
                                        <p
                                            key={messageIndex}
                                            className="ask-this-chart__question"
                                        >
                                            {message.content}
                                        </p>
                                    ) : (
                                        <div
                                            key={messageIndex}
                                            className="ask-this-chart__answer"
                                        >
                                            {message.content ? (
                                                <SimpleMarkdownText
                                                    text={message.content}
                                                />
                                            ) : (
                                                <p className="ask-this-chart__thinking">
                                                    Thinking…
                                                </p>
                                            )}
                                            {message.content &&
                                                !(
                                                    isLoading &&
                                                    messageIndex ===
                                                        messages.length - 1
                                                ) && (
                                                    <AnswerFeedback
                                                        slug={slug}
                                                        source="chat"
                                                        question={
                                                            messages[
                                                                messageIndex - 1
                                                            ]?.content ?? ""
                                                        }
                                                        answer={message.content}
                                                    />
                                                )}
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                        {error && (
                            <p className="ask-this-chart__error">{error}</p>
                        )}
                        <form
                            className="ask-this-chart__form"
                            onSubmit={(event) => {
                                event.preventDefault()
                                void askQuestion(input)
                            }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                className="ask-this-chart__input"
                                value={input}
                                maxLength={MAX_QUESTION_LENGTH}
                                placeholder="Ask your own question about this chart"
                                aria-label="Ask your own question about this chart"
                                onChange={(event) =>
                                    setInput(event.target.value)
                                }
                            />
                            <button
                                type="submit"
                                className="ask-this-chart__submit"
                                disabled={isLoading || !input.trim()}
                            >
                                Ask
                            </button>
                        </form>
                    </div>
                )}
                <p className="ask-this-chart__disclaimer">
                    Answers are generated by an AI model and may contain
                    mistakes. Please check them against the sources documented
                    above.
                </p>
            </div>
        </div>
    )
}
