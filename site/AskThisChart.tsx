import { useCallback, useRef, useState } from "react"
import { SimpleMarkdownText } from "@ourworldindata/components"

const ASK_CHART_API_ENDPOINT = "/api/ask-chart"
const MAX_QUESTION_LENGTH = 500
const MAX_HISTORY_MESSAGES = 8

const SUGGESTED_QUESTIONS = [
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

export default function AskThisChart({ slug }: { slug: string }) {
    const [messages, setMessages] = useState<AskThisChartMessage[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)
    const abortControllerRef = useRef<AbortController | undefined>(undefined)

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

    return (
        <div className="ask-this-chart-wrapper span-cols-14 grid grid-cols-12-full-width">
            <h2 className="h2-bold span-cols-9 col-start-2 col-md-start-2 span-md-cols-12 col-sm-start-2 span-sm-cols-12">
                Ask this chart
            </h2>
            <div className="ask-this-chart span-cols-9 col-start-2 col-md-start-2 span-md-cols-12 col-sm-start-2 span-sm-cols-12">
                <p className="ask-this-chart__intro">
                    Ask a question about this chart — what it shows, where the
                    data comes from, or what might explain a pattern you see.
                </p>
                {messages.length === 0 && (
                    <div className="ask-this-chart__suggestions">
                        {SUGGESTED_QUESTIONS.map((question) => (
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
                                </div>
                            )
                        )}
                    </div>
                )}
                {error && <p className="ask-this-chart__error">{error}</p>}
                <form
                    className="ask-this-chart__form"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void askQuestion(input)
                    }}
                >
                    <input
                        type="text"
                        className="ask-this-chart__input"
                        value={input}
                        maxLength={MAX_QUESTION_LENGTH}
                        placeholder="Ask a question about this chart"
                        aria-label="Ask a question about this chart"
                        onChange={(event) => setInput(event.target.value)}
                    />
                    <button
                        type="submit"
                        className="ask-this-chart__submit"
                        disabled={isLoading || !input.trim()}
                    >
                        Ask
                    </button>
                </form>
                <p className="ask-this-chart__disclaimer">
                    Answers are generated by an AI model and may contain
                    mistakes. Please check them against the sources documented
                    above.
                </p>
            </div>
        </div>
    )
}
