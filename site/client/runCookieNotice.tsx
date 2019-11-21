import ReactDOM = require("react-dom")
import * as React from "react"
import * as Cookies from "js-cookie"
import * as classnames from "classnames"
import { observable, action, runInAction } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCheck } from "@fortawesome/free-solid-svg-icons/faCheck"

const VERSION: string = "2019-10-09"
const COOKIE_NAME: string = "cookienotice"

@observer
export class CookieNotice extends React.Component {
    @observable accepted: boolean = false
    @observable mounted: boolean = false

    componentDidMount() {
        setTimeout(() => {
            runInAction(() => (this.mounted = true))
        }, 200)
    }

    @action.bound onAccept() {
        // Set a cookie for 3 years
        Cookies.set(COOKIE_NAME, VERSION, { expires: 365 * 3 })
        this.accepted = true
    }

    render() {
        return (
            <div
                className={classnames("cookie-notice", {
                    open: this.mounted && !this.accepted
                })}
            >
                <div className="wrapper">
                    <div className="owid-row">
                        <div className="owid-col owid-col--lg-1 explanation">
                            <p>
                                We use cookies to give you the best experience
                                on our website. By continuing without changing
                                your cookie settings, we assume you agree to
                                this.
                            </p>
                        </div>
                        <div className="owid-col owid-col--lg-0 actions">
                            <a href="/privacy-policy" className="button">
                                Read the privacy policy
                            </a>
                            <button
                                className="button accept"
                                onClick={this.onAccept}
                            >
                                <span className="icon">
                                    <FontAwesomeIcon icon={faCheck} />
                                </span>{" "}
                                I agree
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

export function runCookieNotice() {
    if (Cookies.get(COOKIE_NAME) !== VERSION) {
        const div = document.createElement("div")
        document.body.appendChild(div)
        ReactDOM.render(<CookieNotice />, div)
    }
}
