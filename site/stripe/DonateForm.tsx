import React from "react"
import ReactDOM from "react-dom"
import classnames from "classnames"
import { observable, action, computed, runInAction, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { bind } from "decko"
import Recaptcha from "react-recaptcha"
import {
    DONATE_API_URL,
    BAKED_BASE_URL,
    RECAPTCHA_SITE_KEY,
} from "../../settings/clientSettings.js"

import stripe from "./stripe.js"
import { stringifyUnkownError } from "../../clientUtils/Util.js"

type Interval = "once" | "monthly"

enum CurrencyCode {
    USD = "USD",
    GBP = "GBP",
    EUR = "EUR",
}

const currencySymbolByCode: Record<CurrencyCode, string> = {
    [CurrencyCode.USD]: "$",
    [CurrencyCode.GBP]: "£",
    [CurrencyCode.EUR]: "€",
}

const ONETIME_DONATION_AMOUNTS = [10, 50, 100, 500, 1000]
const MONTHLY_DONATION_AMOUNTS = [5, 10, 20, 50, 100]

const ONETIME_DEFAULT_INDEX = 1
const MONTHLY_DEFAULT_INDEX = 1

const MIN_DONATION = 1
const MAX_DONATION = 10_000

const SUPPORTED_CURRENCY_CODES = [
    CurrencyCode.USD,
    CurrencyCode.GBP,
    CurrencyCode.EUR,
]

export const DonateForm = observer(
    class DonateForm extends React.Component {
        interval: Interval = "once"
        presetAmount?: number = ONETIME_DONATION_AMOUNTS[ONETIME_DEFAULT_INDEX]
        customAmount: string = ""
        isCustom: boolean = false
        name: string = ""
        showOnList: boolean = true
        errorMessage?: string
        isSubmitting: boolean = false
        isLoading: boolean = true
        currencyCode: CurrencyCode = CurrencyCode.USD

        captchaInstance?: Recaptcha | null
        captchaPromiseHandlers?: {
            resolve: (value: any) => void
            reject: (value: any) => void
        }

        constructor(props) {
            super(props)

            makeObservable(this, {
                interval: observable,
                presetAmount: observable,
                customAmount: observable,
                isCustom: observable,
                name: observable,
                showOnList: observable,
                errorMessage: observable,
                isSubmitting: observable,
                isLoading: observable,
                currencyCode: observable,
                captchaPromiseHandlers: observable.ref,
                setInterval: action.bound,
                setPresetAmount: action.bound,
                setCustomAmount: action.bound,
                setIsCustom: action.bound,
                setName: action.bound,
                setShowOnList: action.bound,
                setErrorMessage: action.bound,
                setCurrency: action.bound,
                amount: computed,
                intervalAmounts: computed,
                currencySymbol: computed,
            })
        }

        setInterval(interval: Interval) {
            this.interval = interval
            this.presetAmount =
                this.intervalAmounts[
                    interval === "monthly"
                        ? MONTHLY_DEFAULT_INDEX
                        : ONETIME_DEFAULT_INDEX
                ]
        }

        setPresetAmount(amount?: number) {
            this.presetAmount = amount
            this.isCustom = false
        }

        setCustomAmount(amount: string) {
            this.customAmount = amount
            this.isCustom = true
        }

        setIsCustom(isCustom: boolean) {
            this.isCustom = isCustom
        }

        setName(name: string) {
            this.name = name
        }

        setShowOnList(showOnList: boolean) {
            this.showOnList = showOnList
        }

        setErrorMessage(message?: string) {
            this.errorMessage = message
        }

        setCurrency(currency: CurrencyCode) {
            this.currencyCode = currency
        }

        get amount(): number | undefined {
            return this.isCustom
                ? parseFloat(this.customAmount || "")
                : this.presetAmount
        }

        get intervalAmounts(): number[] {
            return this.interval === "monthly"
                ? MONTHLY_DONATION_AMOUNTS
                : ONETIME_DONATION_AMOUNTS
        }

        get currencySymbol(): string {
            return currencySymbolByCode[this.currencyCode]
        }

        async submitDonation(): Promise<void> {
            if (
                !this.amount ||
                this.amount > MAX_DONATION ||
                this.amount < MIN_DONATION
            ) {
                throw new Error(
                    "You can only donate between $1 and $10,000 USD. For other amounts, please get in touch with us at donate@ourworldindata.org."
                )
            }

            const captchaToken = await this.getCaptchaToken()
            const response = await fetch(DONATE_API_URL, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    name: this.name,
                    showOnList: this.showOnList,
                    currency: this.currencyCode,
                    amount: Math.floor(this.amount * 100),
                    interval: this.interval,
                    successUrl: `${BAKED_BASE_URL}/donate/thank-you`,
                    cancelUrl: `${BAKED_BASE_URL}/donate`,
                    captchaToken: captchaToken,
                }),
            })
            const session = await response.json()
            if (!response.ok) throw session
            const result: { error: any } = await stripe.redirectToCheckout({
                sessionId: session.id,
            })
            if (result.error) {
                // If `redirectToCheckout` fails due to a browser or network
                // error, display the localized error message to your customer.
                throw result.error
            }
        }

        @bind async getCaptchaToken() {
            return new Promise((resolve, reject) => {
                if (!this.captchaInstance)
                    return reject(
                        new Error(
                            "Could not load reCAPTCHA. Please try again. If the problem persists, please get in touch with us at donate@ourworldindata.org"
                        )
                    )
                this.captchaPromiseHandlers = { resolve, reject }
                this.captchaInstance.reset()
                this.captchaInstance.execute()
            })
        }

        @bind onCaptchaLoad() {
            this.isLoading = false
        }

        @bind onCaptchaVerify(token: string) {
            if (this.captchaPromiseHandlers)
                this.captchaPromiseHandlers.resolve(token)
        }

        @bind async onSubmit(event: React.FormEvent) {
            event.preventDefault()
            this.isSubmitting = true
            this.errorMessage = undefined
            try {
                await this.submitDonation()
            } catch (error) {
                this.isSubmitting = false
                runInAction(
                    () =>
                        (this.errorMessage =
                            stringifyUnkownError(error) ||
                            "Something went wrong. Please get in touch with us at donate@ourworldindata.org")
                )
            }
        }

        render() {
            return (
                <form className="donate-form" onSubmit={this.onSubmit}>
                    <fieldset className="donate-form-interval">
                        <legend>
                            <h3>Donation type</h3>
                        </legend>
                        <div className="owid-radios">
                            <div className="owid-radio">
                                <input
                                    type="radio"
                                    id="once"
                                    value="once"
                                    name="interval"
                                    onChange={() => this.setInterval("once")}
                                    checked={this.interval === "once"}
                                />
                                <label htmlFor="once">One time</label>
                            </div>
                            <div className="owid-radio">
                                <input
                                    type="radio"
                                    id="monthly"
                                    value="monthly"
                                    name="interval"
                                    onChange={() => this.setInterval("monthly")}
                                    checked={this.interval === "monthly"}
                                />
                                <label htmlFor="monthly">Monthly</label>
                            </div>
                        </div>
                    </fieldset>

                    <fieldset className="donate-form-currency">
                        <legend>
                            <h3>Currency</h3>
                        </legend>
                        <div className="owid-radios">
                            {SUPPORTED_CURRENCY_CODES.map((code) => (
                                <div key={code} className="owid-radio">
                                    <input
                                        type="radio"
                                        id={code}
                                        value={code}
                                        name="currency"
                                        onChange={() => this.setCurrency(code)}
                                        checked={this.currencyCode === code}
                                    />
                                    <label htmlFor={code}>{code}</label>
                                </div>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="donate-form-amount">
                        <legend>
                            <h3>Amount</h3>
                        </legend>
                        <div className="radios">
                            {this.intervalAmounts.map((amount) => (
                                <div key={amount} className="owid-radio">
                                    <input
                                        type="radio"
                                        id={`amount-${amount}`}
                                        value={amount}
                                        name="amount"
                                        onChange={() =>
                                            this.setPresetAmount(amount)
                                        }
                                        checked={
                                            amount === this.presetAmount &&
                                            !this.isCustom
                                        }
                                    />
                                    <label htmlFor={`amount-${amount}`}>
                                        {this.currencySymbol}
                                        {amount}
                                    </label>
                                </div>
                            ))}
                            <div className="owid-radio custom-radio">
                                <input
                                    type="radio"
                                    id="custom"
                                    name="amount"
                                    checked={this.isCustom}
                                    onChange={(event) =>
                                        this.setIsCustom(event.target.checked)
                                    }
                                />
                                <label htmlFor="custom">
                                    {this.currencySymbol}
                                    <input
                                        type="text"
                                        placeholder="Other"
                                        name="custom-amount"
                                        className="custom-amount-input"
                                        onChange={(event) =>
                                            this.setCustomAmount(
                                                event.target.value
                                            )
                                        }
                                        value={this.customAmount}
                                    />
                                </label>
                            </div>
                        </div>
                    </fieldset>

                    <fieldset>
                        <div className="owid-block-field">
                            <label htmlFor="name">
                                <h3>Your name (optional)</h3>
                            </label>
                            <input
                                id="name"
                                type="text"
                                className="owid-input"
                                value={this.name}
                                onChange={(event) =>
                                    this.setName(event.target.value)
                                }
                            />
                        </div>
                    </fieldset>

                    <fieldset>
                        <div className="owid-checkboxes">
                            <div className="owid-checkbox-inline">
                                <input
                                    type="checkbox"
                                    id="showOnList"
                                    value="showOnList"
                                    name="type"
                                    checked={this.showOnList}
                                    onChange={(event) =>
                                        this.setShowOnList(event.target.checked)
                                    }
                                />
                                <label htmlFor="showOnList">
                                    Include me on the public{" "}
                                    <a href="/funding" target="_blank">
                                        list of donors
                                    </a>
                                </label>
                            </div>
                        </div>
                    </fieldset>

                    {this.errorMessage && (
                        <p className="error">{this.errorMessage}</p>
                    )}

                    <Recaptcha
                        ref={(inst) => (this.captchaInstance = inst)}
                        sitekey={RECAPTCHA_SITE_KEY}
                        size="invisible"
                        badge="bottomleft"
                        render="explicit"
                        onloadCallback={this.onCaptchaLoad}
                        verifyCallback={this.onCaptchaVerify}
                    />

                    <button
                        type="submit"
                        className={classnames("owid-button", {
                            disabled: this.isSubmitting,
                        })}
                        disabled={this.isLoading}
                    >
                        Donate{" "}
                        {this.amount
                            ? `${this.currencySymbol}${this.amount}`
                            : ""}{" "}
                        {this.interval === "monthly" ? "per month" : ""}
                    </button>

                    <p className="note">
                        You will be redirected to a secure page to enter your
                        payment details. We will not share any details you enter
                        with any third parties.
                    </p>

                    <p className="note">
                        This site is protected by reCAPTCHA and the Google{" "}
                        <a href="https://policies.google.com/privacy">
                            Privacy Policy
                        </a>{" "}
                        and{" "}
                        <a href="https://policies.google.com/terms">
                            Terms of Service
                        </a>{" "}
                        apply.
                    </p>
                </form>
            )
        }
    }
)

export class DonateFormRunner {
    async run() {
        ReactDOM.render(
            <DonateForm />,
            document.querySelector(".donate-form-container")
        )
    }
}

export function runDonateForm() {
    const donateForm = new DonateFormRunner()
    donateForm.run()
}
