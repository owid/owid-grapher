import React = require("react")
import ReactDOM = require("react-dom")
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCommentAlt } from "@fortawesome/free-solid-svg-icons/faCommentAlt"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { observable, action, toJS } from "mobx"
import classnames from "classnames"

function sendFeedback(feedback: Feedback) {
    return new Promise((resolve, reject) => {
        const json = toJS(feedback)
        const req = new XMLHttpRequest()

        json.message =
            feedback.message + `\n\n-----\nCurrent URL: ${window.location.href}`

        req.addEventListener("readystatechange", () => {
            if (req.readyState === 4) {
                if (req.status !== 200) {
                    reject(`${req.status} ${req.statusText}`)
                } else {
                    resolve()
                }
            }
        })

        req.open(
            "POST",
            `https://owid-feedback.netlify.com/.netlify/functions/hello`
        )
        req.setRequestHeader("Content-Type", "application/json;charset=UTF-8")

        req.send(JSON.stringify(json))
    })
}

class Feedback {
    @observable name: string = ""
    @observable email: string = ""
    @observable message: string = ""
}

@observer
export class FeedbackForm extends React.Component {
    feedback: Feedback = new Feedback()
    @observable loading: boolean = false
    @observable done: boolean = false
    @observable error: string | undefined

    async submit() {
        try {
            await sendFeedback(this.feedback)
            this.done = true
        } catch (err) {
            this.error = err
        } finally {
            this.loading = false
        }
    }

    @action.bound onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        this.done = false
        this.error = undefined
        this.loading = true
        this.submit()
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

    render() {
        const { loading } = this
        return (
            <form
                className={classnames("FeedbackForm", {
                    loading: this.loading
                })}
                onSubmit={this.onSubmit}
            >
                <div className="header">Leave us feedback</div>
                <div className="formBody">
                    <div className="formSection">
                        <div className="notice">
                            <p className="title">We welcome your feedback.</p>
                            <p>
                                In the current situation we read and consider
                                all feedback, but can not promise to reply to
                                all.
                            </p>
                        </div>
                    </div>
                    <div className="formSection">
                        <label htmlFor="feedback.name">Your name</label>
                        <input
                            id="feedback.name"
                            onChange={this.onName}
                            autoFocus
                            disabled={loading}
                        />
                    </div>
                    <div className="formSection">
                        <label htmlFor="feedback.email">Email address</label>
                        <input
                            id="feedback.email"
                            onChange={this.onEmail}
                            type="email"
                            required
                            disabled={loading}
                        />
                    </div>
                    <div className="formSection formSectionExpand">
                        <label htmlFor="feedback.message">Message</label>
                        <textarea
                            id="feedback.message"
                            onChange={this.onMessage}
                            rows={5}
                            required
                            disabled={loading}
                        />
                    </div>
                    {this.error ? (
                        <div style={{ color: "red" }}>{this.error}</div>
                    ) : (
                        undefined
                    )}
                    {this.done ? (
                        <div style={{ color: "green" }}>
                            Thanks for your feedback!
                        </div>
                    ) : (
                        undefined
                    )}
                </div>
                <div className="footer">
                    <button type="submit" disabled={loading}>
                        Send message
                    </button>
                </div>
            </form>
        )
    }
}

@observer
export class FeedbackPrompt extends React.Component {
    @observable isOpen: boolean = false

    @action.bound toggleOpen() {
        this.isOpen = !this.isOpen
    }

    @action.bound onClickOutside() {
        this.isOpen = false
    }

    render() {
        return (
            <div
                className={`feedbackPromptContainer${
                    this.isOpen ? " active" : ""
                }`}
            >
                {this.isOpen && (
                    <>
                        <div
                            className="overlay"
                            onClick={this.onClickOutside}
                        />
                        <div className="box">
                            <FeedbackForm />
                        </div>
                    </>
                )}
                {this.isOpen ? (
                    <button className="prompt" onClick={this.toggleOpen}>
                        <FontAwesomeIcon icon={faTimes} /> Close
                    </button>
                ) : (
                    <button
                        className="prompt"
                        data-track-click
                        data-track-note="page-open-feedback"
                        onClick={this.toggleOpen}
                    >
                        <FontAwesomeIcon icon={faCommentAlt} /> Feedback
                    </button>
                )}
            </div>
        )
    }
}

export function runFeedbackPage() {
    ReactDOM.render(
        <div className="box">
            <FeedbackForm />
        </div>,
        document.querySelector(".FeedbackPage main")
    )
}
