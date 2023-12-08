import React from "react"
import ReactDOM from "react-dom"
import cx from "classnames"
import { observable, action, computed } from "mobx"
import { observer } from "mobx-react"
import { bind } from "decko"
import Recaptcha from "react-recaptcha"
import {
    DONATE_API_URL,
    BAKED_BASE_URL,
    RECAPTCHA_SITE_KEY,
} from "../../settings/clientSettings.js"
import {
    Tippy,
    stringifyUnknownError,
    titleCase,
    DonationCurrencyCode,
    DonationInterval,
    DonationRequest,
    getErrorMessageDonation,
    SUPPORTED_CURRENCY_CODES,
    getCurrencySymbol,
    DonateSessionResponse,
    PLEASE_TRY_AGAIN,
} from "@ourworldindata/utils"
import { Checkbox } from "@ourworldindata/components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight, faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import Bugsnag from "@bugsnag/js"

const ONETIME_DONATION_AMOUNTS = [10, 50, 100, 500, 1000]
const MONTHLY_DONATION_AMOUNTS = [5, 10, 20, 50, 100]

const ONETIME_DEFAULT_INDEX = 1
const MONTHLY_DEFAULT_INDEX = 1

@observer
export class DonateForm extends React.Component {
    @observable interval: DonationInterval = "once"
    @observable presetAmount?: number =
        ONETIME_DONATION_AMOUNTS[ONETIME_DEFAULT_INDEX]
    @observable customAmount: string = ""
    @observable name: string = ""
    @observable showOnList: boolean = true
    @observable errorMessage?: string
    @observable isSubmitting: boolean = false
    @observable isLoading: boolean = true
    @observable currencyCode: DonationCurrencyCode = "GBP"

    captchaInstance?: Recaptcha | null
    @observable.ref captchaPromiseHandlers?: {
        resolve: (value: any) => void
        reject: (value: any) => void
    }

    @action.bound setInterval(interval: DonationInterval) {
        this.interval = interval
        this.presetAmount =
            this.intervalAmounts[
                interval === "monthly"
                    ? MONTHLY_DEFAULT_INDEX
                    : ONETIME_DEFAULT_INDEX
            ]
    }

    @action.bound setPresetAmount(amount?: number) {
        this.presetAmount = amount
        this.customAmount = ""
    }

    @action.bound setCustomAmount(amount: string) {
        this.customAmount = amount
        this.presetAmount = undefined
    }

    @action.bound setName(name: string) {
        // capitalize first letter of each word. Words can be separated by
        // spaces or hyphens.
        this.name = titleCase(name)
    }

    @action.bound toggleShowOnList() {
        this.showOnList = !this.showOnList
    }

    @action.bound setErrorMessage(message?: string) {
        this.errorMessage = message
    }

    @action.bound setIsSubmitting(isSubmitting: boolean) {
        this.isSubmitting = isSubmitting
    }

    @action.bound setCurrency(currency: DonationCurrencyCode) {
        this.currencyCode = currency
    }

    @computed get amount(): number | undefined {
        return this.customAmount
            ? parseFloat(this.customAmount)
            : this.presetAmount
    }

    @computed get intervalAmounts(): number[] {
        return this.interval === "monthly"
            ? MONTHLY_DONATION_AMOUNTS
            : ONETIME_DONATION_AMOUNTS
    }

    @computed get currencySymbol(): string {
        return getCurrencySymbol(this.currencyCode)
    }

    async submitDonation(): Promise<void> {
        const requestBodyForClientSideValidation: DonationRequest = {
            name: this.name,
            showOnList: this.showOnList,
            currency: this.currencyCode,
            amount: this.amount || 0,
            interval: this.interval,
            successUrl: `${BAKED_BASE_URL}/thank-you`,
            cancelUrl: `${BAKED_BASE_URL}/donate`,
            captchaToken: "",
        }

        // Validate the request body before requesting the CAPTCHA token for
        // faster feedback in case of form errors (e.g. invalid amount).
        const errorMessage = getErrorMessageDonation(
            requestBodyForClientSideValidation
        )
        if (errorMessage) throw new Error(errorMessage)

        // Get the CAPTCHA token once the request body is validated.
        const captchaToken = await this.getCaptchaToken()

        const requestBody: DonationRequest = {
            ...requestBodyForClientSideValidation,
            captchaToken,
        }

        // Send the request to the server, along with the CAPTCHA token.
        const response = await fetch(DONATE_API_URL, {
            method: "POST",
            headers: {
                Accept: "application/json", // expect JSON in response
                "Content-Type": "application/json", // send JSON in request
            },
            body: JSON.stringify(requestBody),
        })

        const session: DonateSessionResponse = await response.json()

        if (!response.ok || !session.url) {
            throw new Error(
                session.error || `Something went wrong. ${PLEASE_TRY_AGAIN}`
            )
        }

        window.location.href = session.url
    }

    @bind async getCaptchaToken(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.captchaInstance)
                return reject(
                    new Error(`Could not load reCAPTCHA. ${PLEASE_TRY_AGAIN}`)
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
        this.setIsSubmitting(true)
        this.setErrorMessage(undefined)

        try {
            await this.submitDonation()
        } catch (error) {
            this.setIsSubmitting(false)

            const prefixedErrorMessage = stringifyUnknownError(error)
            // Send all errors to Bugsnag. This will help surface issues
            // with our aging reCAPTCHA setup, and pull the trigger on a
            // (hook-based?) rewrite if it starts failing. This reporting
            // also includes form validation errors, which are useful to
            // identify possible UX improvements or validate UX experiments
            // (such as the combination of the name field and the "include
            // my name on the list" checkbox).
            Bugsnag.notify(
                error instanceof Error ? error : new Error(prefixedErrorMessage)
            )

            if (!prefixedErrorMessage) {
                this.setErrorMessage(
                    `Something went wrong. ${PLEASE_TRY_AGAIN}`
                )
                return
            }

            const rawErrorMessage = prefixedErrorMessage.match(/^Error: (.*)$/)

            this.setErrorMessage(rawErrorMessage?.[1] || prefixedErrorMessage)
        }
    }

    render() {
        return (
            <form className="donate-form" onSubmit={this.onSubmit}>
                <fieldset>
                    <legend className="overline-black-caps">Frequency</legend>
                    <div className="donation-options">
                        <input
                            type="button"
                            value="Give once"
                            onClick={() => this.setInterval("once")}
                            className={cx("donation-options__button", {
                                active: this.interval === "once",
                            })}
                        />
                        <input
                            type="button"
                            value="Monthly"
                            onClick={() => this.setInterval("monthly")}
                            className={cx("donation-options__button", {
                                active: this.interval === "monthly",
                            })}
                        />
                    </div>
                </fieldset>

                <fieldset>
                    <legend>Currency</legend>
                    <div className="donation-options">
                        {SUPPORTED_CURRENCY_CODES.map((code) => (
                            <input
                                type="button"
                                value={`${code} (${getCurrencySymbol(code)})`}
                                onClick={() => this.setCurrency(code)}
                                className={cx("donation-options__button", {
                                    active: this.currencyCode === code,
                                })}
                                key={code}
                            />
                        ))}
                    </div>
                </fieldset>

                <fieldset>
                    <legend>Amount</legend>
                    <div className="donation-options donation-options--grid">
                        {this.intervalAmounts.map((amount) => (
                            <input
                                type="button"
                                value={`${this.currencySymbol}${amount}`}
                                onClick={() => this.setPresetAmount(amount)}
                                className={cx("donation-options__button", {
                                    active:
                                        amount === this.presetAmount &&
                                        !this.customAmount,
                                })}
                                key={`${amount}-${this.interval}`}
                            />
                        ))}
                        <div
                            className={cx("donation-custom-amount", {
                                active: !!this.customAmount,
                            })}
                        >
                            <label htmlFor="donation-custom-amount__input">
                                {this.currencySymbol}
                            </label>
                            <input
                                type="text"
                                placeholder="Other"
                                id="donation-custom-amount__input"
                                className="donation-custom-amount__input"
                                onChange={(event) =>
                                    this.setCustomAmount(event.target.value)
                                }
                                value={this.customAmount}
                            />
                        </div>
                    </div>
                </fieldset>

                <fieldset className="donation-public-checkbox">
                    <Checkbox
                        label={
                            <span className="donation-public-checkbox__label">
                                Include my name on our{" "}
                                <a href="/funding" target="_blank">
                                    public list of donors
                                </a>
                            </span>
                        }
                        checked={this.showOnList}
                        onChange={() => this.toggleShowOnList()}
                    />
                </fieldset>

                {this.showOnList && (
                    <fieldset>
                        <label
                            className="donation-name__label"
                            htmlFor="donation-name__input"
                        >
                            Full name (required if ticked)
                        </label>
                        <input
                            id="donation-name__input"
                            type="text"
                            className="donation-name__input"
                            value={this.name}
                            onChange={(event) =>
                                this.setName(event.target.value)
                            }
                        />
                    </fieldset>
                )}

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
                <div className="donation-payment">
                    <button
                        type="submit"
                        className="donation-submit"
                        disabled={this.isLoading || this.isSubmitting}
                    >
                        Donate now
                        <FontAwesomeIcon
                            icon={faArrowRight}
                            className="donation-submit__icon"
                        />
                    </button>

                    <ul className="donation-payment-benefits">
                        <li className="donation-payment-benefits__item">
                            🇬🇧 Your donation qualifies for Gift Aid in the UK{" "}
                            <Tippy
                                appendTo={() => document.body}
                                content={
                                    <div>
                                        <p>
                                            Your donation qualifies for Gift Aid
                                            if you pay tax in the UK, and have
                                            signed the Gift Aid declaration.
                                        </p>
                                        <p>
                                            Every £1 that you donate with Gift
                                            Aid is worth £1.25 to us, at no
                                            extra cost to you.
                                        </p>
                                    </div>
                                }
                                interactive
                                placement="bottom"
                                theme="owid-footnote"
                                trigger="mouseenter focus click"
                            >
                                <FontAwesomeIcon icon={faInfoCircle} />
                            </Tippy>
                        </li>
                        <li className="donation-payment-benefits__item">
                            You can donate using credit card, debit card, SEPA,
                            iDEAL and more
                        </li>
                    </ul>
                </div>
                <div className="donation-payment">
                    <p className="donation-payment__or">
                        For US donors, our partner every.org facilitates
                        tax-deductible giving and offers more payment options.
                    </p>
                    <a
                        href="https://www.every.org/ourworldindata?donateTo=ourworldindata#/donate/card"
                        className="donation-submit donation-submit--light"
                    >
                        Donate via every.org
                        <FontAwesomeIcon
                            icon={faArrowRight}
                            className="donation-submit__icon"
                        />
                    </a>

                    <ul className="donation-payment-benefits">
                        <li className="donation-payment-benefits__item">
                            🇺🇸 Your donation is tax-deductible in the US{" "}
                            <Tippy
                                appendTo={() => document.body}
                                content={
                                    <div>
                                        <p>
                                            Your donation is made to Every.org,
                                            a tax-exempt US 501(c)(3) charity
                                            that grants unrestricted funds to
                                            Our World in Data on your behalf.
                                            This means that if you are a US
                                            taxpayer, 100% of your donation is
                                            tax-deductible to the extent allowed
                                            by US law.
                                        </p>
                                        <p>
                                            After your donation payment is
                                            confirmed by Every.org, you will
                                            immediately get a tax-deductible
                                            receipt emailed to you.
                                        </p>
                                    </div>
                                }
                                interactive
                                placement="bottom"
                                theme="owid-footnote"
                                trigger="mouseenter focus click"
                            >
                                <FontAwesomeIcon icon={faInfoCircle} />
                            </Tippy>
                        </li>
                        <li className="donation-payment-benefits__item">
                            You can donate in US dollars using PayPal, Venmo,
                            direct US bank transfer (ACH), credit card and more
                        </li>
                        <li className="donation-payment-benefits__item">
                            You can use this option for donor-advised fund (DAF)
                            grants
                        </li>
                    </ul>
                </div>

                <p className="donation-note">
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
