import * as React from "react"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCommentAlt,
    faTimes,
    faPaperPlane,
} from "@fortawesome/free-solid-svg-icons"
import { observable, action, toJS, computed, makeObservable } from "mobx"
import cx from "clsx"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { stringifyUnknownError } from "@ourworldindata/utils"
import { Button, CloseButton, TextInput } from "@ourworldindata/components"
import { SiteToolsButton } from "./SiteToolsButton.js"

const sendFeedback = async (feedback: Feedback) => {
    const json = {
        ...toJS(feedback),
        environment: `Current URL: ${window.location.href}\nUser Agent: ${navigator.userAgent}\nViewport: ${window.innerWidth}x${window.innerHeight}`,
    }

    return await fetch("https://feedback.owid.io", {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=UTF-8" },
        body: JSON.stringify(json),
    }).then((res) => {
        if (!res.ok)
            throw new Error(
                `Sending feedback failed: ${res.status} ${res.statusText}`
            )
    })
}

class Feedback {
    name: string = ""
    email: string = ""
    message: string = ""
    environment: string = ""

    constructor() {
        makeObservable(this, {
            name: observable,
            email: observable,
            message: observable,
        })
    }

    @action.bound clear() {
        this.name = ""
        this.email = ""
        this.message = ""
    }
}

/**
 * Frequently asked questions we can point readers to while they type, so
 * they might find an answer before sending their message.
 */
interface SpecialTopic {
    regex: RegExp
    title: string
    url: string
}

const specialTopics: SpecialTopic[] = [
    {
        regex: /vaccination|vaccine|doses|vaccinat/i,
        title: "COVID-19 vaccine questions",
        url: `${BAKED_BASE_URL}/covid-vaccinations#frequently-asked-questions`,
    },
    {
        regex: /license|licence|licensing|copyright|permission|permit/i,
        title: "Copyright questions",
        url: `${BAKED_BASE_URL}/faqs#can-i-reuse-or-republish-your-charts`,
    },
    {
        regex: /cite|citation|citing|reference/i,
        title: "How to cite our work",
        url: `${BAKED_BASE_URL}/faqs#how-should-i-cite-your-charts`,
    },
    {
        regex: /translat/i,
        title: "Translating our work",
        url: `${BAKED_BASE_URL}/faqs#can-i-translate-your-work-into-another-language`,
    },
    {
        regex: /\b(fund|funds|funding|funded|funder)\b/i,
        title: "How are you funded?",
        url: `${BAKED_BASE_URL}/faqs#how-are-you-funded`,
    },
    {
        regex: /(use|reuse|using|reusing)\s+(chart|image|picture)/i,
        title: "Reusing our charts",
        url: `${BAKED_BASE_URL}/faqs#can-i-reuse-or-republish-your-charts`,
    },
    {
        regex: /grapher|grapher\s+reusability|(use|reuse|using|reusing)\s+grapher|data\s+viz\s+tool|data\s+visuali[sz]ation\s+tool|visuali[sz]ation\s+software/i,
        title: "Our visualization tool",
        url: `${BAKED_BASE_URL}/faqs#what-software-do-you-use-for-your-visualizations-and-can-i-use-it`,
    },
    {
        regex: /(use|reuse|using|reusing|utilize|utilizing|utilise|utilising)\s+data/i,
        title: "Reusing our data",
        url: `${BAKED_BASE_URL}/faqs#can-i-reuse-or-republish-your-data`,
    },
    {
        regex: /logo/i,
        title: "Can I use your logo?",
        url: `${BAKED_BASE_URL}/faqs#can-i-use-the-our-world-in-data-name-or-logo`,
    },
    {
        regex: /teach|teaching|teacher|teachers/i,
        title: "Teaching with OWID",
        url: `${BAKED_BASE_URL}/faqs#can-i-use-your-work-for-teaching`,
    },
]

export const FEEDBACK_FORM_TITLE = "Send us feedback"

/** The element on the /feedback page in which the interactive form is mounted */
export const FEEDBACK_FORM_CONTAINER_CLASS = "feedback-form-container"

interface FeedbackFormProps {
    /**
     * When set, the form is rendered in a dialog (popover or modal): it gets a
     * header with a close button, and the success screen offers to close it.
     * Without it, the form is embedded in a page.
     */
    onClose?: () => void
}

@observer
export class FeedbackForm extends React.Component<FeedbackFormProps> {
    feedback: Feedback = new Feedback()
    loading: boolean = false
    done: boolean = false
    error: string | undefined

    constructor(props: FeedbackFormProps) {
        super(props)

        makeObservable(this, {
            loading: observable,
            done: observable,
            error: observable,
        })
    }

    async submit() {
        try {
            await sendFeedback(this.feedback)
            this.feedback.clear()
            this.done = true
        } catch (err) {
            this.error = stringifyUnknownError(err)
        } finally {
            this.loading = false
        }
    }

    @action.bound onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        this.done = false
        this.error = undefined
        this.loading = true
        void this.submit()
    }

    @action.bound onName(e: React.ChangeEvent<HTMLInputElement>) {
        this.feedback.name = e.currentTarget.value
    }

    @action.bound onEmail(e: React.ChangeEvent<HTMLInputElement>) {
        this.feedback.email = e.currentTarget.value
    }

    @action.bound onMessage(e: React.ChangeEvent<HTMLTextAreaElement>) {
        this.feedback.message = e.currentTarget.value
    }

    @action.bound onClose() {
        this.props.onClose?.()
        // Reset the success screen after closing, in case the user has a 2nd
        // message to send later.
        this.done = false
    }

    @action.bound onSendAnother() {
        this.done = false
    }

    @computed get isDialog(): boolean {
        return !!this.props.onClose
    }

    @computed private get specialTopic(): SpecialTopic | undefined {
        const { message } = this.feedback
        return specialTopics.find((topic) => topic.regex.test(message))
    }

    renderSuccess() {
        return (
            <div className="feedback-form__success">
                <FontAwesomeIcon
                    icon={faPaperPlane}
                    className="feedback-form__success-icon"
                />
                <h3 className="feedback-form__success-title">
                    Thank you for your feedback
                </h3>
                <p className="feedback-form__success-text">
                    We read all feedback, but due to a high volume of messages
                    we are not able to reply to all.
                </p>
                {this.isDialog ? (
                    <Button
                        theme="outline-vermillion"
                        className="feedback-form__success-button"
                        icon={null}
                        text="Close"
                        ariaLabel="Close feedback form"
                        onClick={this.onClose}
                    />
                ) : (
                    <Button
                        theme="outline-vermillion"
                        className="feedback-form__success-button"
                        icon={null}
                        text="Send another message"
                        onClick={this.onSendAnother}
                    />
                )}
            </div>
        )
    }

    renderFields() {
        const { loading, error, specialTopic } = this
        const { name, email, message } = this.feedback

        return (
            <>
                <div className="feedback-form__body">
                    {this.isDialog && (
                        <p className="feedback-form__faq-hint">
                            <strong>Have a question?</strong> You may find an
                            answer in our{" "}
                            <a
                                href={`${BAKED_BASE_URL}/faqs`}
                                target="_blank"
                                rel="noopener"
                            >
                                FAQs
                            </a>
                            .
                        </p>
                    )}
                    <fieldset className="feedback-form__field feedback-form__field--message">
                        <label
                            className="feedback-form__label"
                            htmlFor="feedback.message"
                        >
                            Message
                        </label>
                        <textarea
                            id="feedback.message"
                            className="feedback-form__textarea sentry-mask"
                            value={message}
                            onChange={this.onMessage}
                            rows={6}
                            minLength={30}
                            required
                            disabled={loading}
                        />
                        {specialTopic && (
                            <p className="feedback-form__topic-hint">
                                Your question may be answered in{" "}
                                <a
                                    href={specialTopic.url}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    {specialTopic.title}
                                </a>
                                .
                            </p>
                        )}
                    </fieldset>
                    <fieldset className="feedback-form__field">
                        <label
                            className="feedback-form__label"
                            htmlFor="feedback.name"
                        >
                            Your name
                        </label>
                        <TextInput
                            id="feedback.name"
                            className="feedback-form__input sentry-mask"
                            value={name}
                            onChange={this.onName}
                            autoComplete="name"
                            disabled={loading}
                        />
                    </fieldset>
                    <fieldset className="feedback-form__field">
                        <label
                            className="feedback-form__label"
                            htmlFor="feedback.email"
                        >
                            Email address
                        </label>
                        <TextInput
                            id="feedback.email"
                            className="feedback-form__input sentry-mask"
                            type="email"
                            value={email}
                            onChange={this.onEmail}
                            autoComplete="email"
                            disabled={loading}
                        />
                        <p className="feedback-form__hint">
                            Your name and email will only be used to reply to
                            you and not for any other purpose. If you do not
                            give a valid email, we will not be able to reply to
                            you.
                        </p>
                    </fieldset>
                    {error && <p className="feedback-form__error">{error}</p>}
                </div>
                <div className="feedback-form__footer">
                    <Button
                        type="submit"
                        theme="solid-vermillion"
                        className="feedback-form__submit"
                        text="Send message"
                        ariaLabel="Submit feedback"
                        disabled={loading}
                    />
                </div>
            </>
        )
    }

    override render() {
        return (
            <form
                className={cx("feedback-form", {
                    "feedback-form--dialog": this.isDialog,
                    "feedback-form--loading": this.loading,
                })}
                onSubmit={this.onSubmit}
            >
                {this.isDialog && (
                    <div className="feedback-form__header">
                        <h2 className="feedback-form__title">
                            {FEEDBACK_FORM_TITLE}
                        </h2>
                        <CloseButton
                            className="feedback-form__close"
                            onClick={this.onClose}
                        />
                    </div>
                )}
                {this.done ? this.renderSuccess() : this.renderFields()}
            </form>
        )
    }
}

/**
 * The floating "Feedback" button in the site tools (bottom right corner on
 * desktop), which opens the feedback form in a popover.
 */
@observer
export class FeedbackPrompt extends React.Component {
    isOpen: boolean = false
    boxRef: React.RefObject<HTMLDivElement | null> = React.createRef()

    constructor(props: Record<string, never>) {
        super(props)

        makeObservable(this, {
            isOpen: observable,
        })
    }

    @action.bound toggleOpen() {
        this.isOpen = !this.isOpen
        if (this.isOpen) {
            // Focus the message field once the popover is visible
            requestAnimationFrame(() => {
                this.boxRef.current?.querySelector("textarea")?.focus()
            })
        }
    }

    @action.bound onClose() {
        this.isOpen = false
    }

    override render() {
        return (
            <div className={cx("feedback-prompt", { active: this.isOpen })}>
                {/* We are keeping the form always rendered to avoid wiping all contents
                when a user accidentally closes the form */}
                <div hidden={!this.isOpen}>
                    <div className="overlay" onClick={this.onClose} />
                    <div className="feedback-prompt__box" ref={this.boxRef}>
                        <FeedbackForm onClose={this.onClose} />
                    </div>
                </div>
                {this.isOpen ? (
                    <SiteToolsButton
                        icon={faTimes}
                        label="Close feedback form"
                        onClick={this.toggleOpen}
                    />
                ) : (
                    <SiteToolsButton
                        icon={faCommentAlt}
                        label="Feedback"
                        dataTrackNote="page_open_feedback"
                        onClick={this.toggleOpen}
                    />
                )}
            </div>
        )
    }
}
