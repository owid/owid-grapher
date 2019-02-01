import React = require("react")
import ReactDOM = require("react-dom")
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { observable, action, runInAction } from "mobx";
import classnames from 'classnames'

@observer
class FeedbackForm extends React.Component<{ onDismiss: () => void }> {
    @observable name: string = ""
    @observable email: string = ""
    @observable message: string = ""
    @observable loading: boolean = false
    @observable done: boolean = false
    @observable error: string|undefined

    async sendFeedback() {
        const feedback = {
            name: this.name,
            email: this.email,
            message: this.message
        }
        const req = new XMLHttpRequest()

        req.addEventListener("readystatechange", () => {
            if (req.readyState === 4) {
                if (req.status !== 200) {
                    runInAction(() => { this.loading = false; this.error = `${req.status} ${req.statusText}` })
                } else {
                    runInAction(() => { this.loading = false; this.done = true })
                }    
            }
        })

        req.open("POST", `https://owid-feedback.netlify.com/.netlify/functions/hello`)
        req.setRequestHeader("Content-Type", "application/json;charset=UTF-8")
        
        req.send(JSON.stringify(feedback))
    }

    @action.bound onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        this.done = false
        this.error = undefined
        this.loading = true
        this.sendFeedback()
    }

    @action.bound onName(e: React.ChangeEvent<HTMLInputElement>) {
        this.name = e.currentTarget.value
    }

    @action.bound onEmail(e: React.ChangeEvent<HTMLInputElement>) {
        this.email = e.currentTarget.value
    }

    @action.bound onMessage(e: React.ChangeEvent<HTMLTextAreaElement>) {
        this.message = e.currentTarget.value
    }

    render() {
        const {loading} = this
        return <form className={classnames("FeedbackForm", { loading: this.loading })} onSubmit={this.onSubmit}>
            <header>
                Leave us feedback
            </header>
            <div className="formBody">
                <div>
                    <label htmlFor="feedback.name">Your name</label>
                    <input id="feedback.name" onChange={this.onName} autoFocus disabled={loading}/>
                </div>
                <div>
                    <label htmlFor="feedback.email">Email address</label>
                    <input id="feedback.email" onChange={this.onEmail} type="email" required disabled={loading}/>
                </div>
                <div>
                    <label htmlFor="feedback.message">Message</label>
                    <textarea id="feedback.message" onChange={this.onMessage} rows={5} required disabled={loading}/>
                </div>
                {this.error ? <div style={{ color: 'red' }}>{this.error}</div> : undefined}
                {this.done ? <div style={{ color: 'green' }}>Thanks for your feedback!</div> : undefined}
            </div>
            <footer>
                <button onClick={this.props.onDismiss} disabled={loading}>Close</button>
                <button type="submit" disabled={loading}>Send</button>
            </footer>
        </form>
    }
}

@observer
class FeedbackPrompt extends React.Component {
    @observable isOpen: boolean = false

    @action.bound toggleOpen() {
        this.isOpen = !this.isOpen
    }

    render() {
        return this.isOpen ? <FeedbackForm onDismiss={this.toggleOpen}/> : <button className="FeedbackPrompt" onClick={this.toggleOpen}>
            <FontAwesomeIcon icon={faEnvelope}/> Feedback
        </button>
    }
}

export function runFeedback() {
    ReactDOM.render(<FeedbackPrompt/>, document.querySelector(".feedbackPromptContainer"))
}