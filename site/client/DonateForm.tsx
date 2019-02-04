import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { observable, action, computed } from 'mobx'
import { observer } from 'mobx-react'
import { bind } from 'decko'
import { BAKED_BASE_URL } from 'settings'

import stripe from './stripe'

type Interval = "once" | "monthly"

const ONETIME_DONATION_AMOUNTS = [10,50,100,500,1000]
const MONTHLY_DONATION_AMOUNTS = [5,10,20,50,100]

const MIN_DONATION = 0.5
const MAX_DONATION = 100000

@observer
export class DonateForm extends React.Component {
    @observable interval: Interval = "monthly"
    @observable presetAmount?: number = MONTHLY_DONATION_AMOUNTS[2]
    @observable customAmount: string = ""
    @observable isCustom: boolean = false

    @observable errorMessage?: string

    @action.bound setInterval(interval: Interval) {
        this.interval = interval
        this.presetAmount = this.intervalAmounts[2]
    }

    @action.bound setPresetAmount(amount?: number) {
        this.presetAmount = amount
        this.isCustom = false
    }

    @action.bound setCustomAmount(amount: string) {
        this.customAmount = amount
        this.isCustom = true
    }

    @action.bound setIsCustom(isCustom: boolean) {
        this.isCustom = isCustom
    }

    @action.bound setErrorMessage(message?: string) {
        this.errorMessage = message
    }

    @computed get amount(): number | undefined {
        return this.isCustom ? parseFloat(this.customAmount || "") : this.presetAmount
    }

    @computed get stripeItem() {
        if (!this.amount) return undefined
        return this.interval === "monthly"
            ? { plan: 'donation', quantity: Math.floor(this.amount * 100) }
            : { sku: 'sku_ERSZdVx0XkO7tV', quantity: Math.floor(this.amount * 100) }
    }

    @computed get intervalAmounts(): number[] {
        return this.interval === "monthly" ? MONTHLY_DONATION_AMOUNTS : ONETIME_DONATION_AMOUNTS
    }

    @bind async submitDonation(event: React.FormEvent) {
        event.preventDefault()

        if (!this.amount || (this.amount > MAX_DONATION || this.amount < MIN_DONATION)) {
            this.errorMessage = "You can only donate between $0.50 and $100,000 USD. For other amounts, please get in touch with us at donate@ourworldindata.org."
            return
        }

        this.errorMessage = undefined

        try {
            const result: { error: any } = await stripe.redirectToCheckout({
                items: [this.stripeItem],
                successUrl: `${BAKED_BASE_URL}/donate/thank-you`,
                cancelUrl: `${BAKED_BASE_URL}/donate`
            })
            if (result.error) {
                // If `redirectToCheckout` fails due to a browser or network
                // error, display the localized error message to your customer.
                this.errorMessage = result.error.message
            }
        } catch (error) {
            this.errorMessage = error && error.message
        }
    }

    render() {
        return <form className="donate-form" onSubmit={this.submitDonation}>

            <fieldset className="donate-form-interval">
                <legend>
                    <h3>Donation type</h3>
                </legend>
                <div className="radios">
                    <div className="radio">
                        <input type="radio" id="once" value="once" name="interval" onChange={() => this.setInterval("once")} checked={this.interval === "once"} />
                        <label htmlFor="once">
                            One time
                        </label>
                    </div>
                    <div className="radio">
                        <input type="radio" id="monthly" value="monthly" name="interval" onChange={() => this.setInterval("monthly")} checked={this.interval === "monthly"} />
                        <label htmlFor="monthly">
                            Monthly
                        </label>
                    </div>
                </div>
            </fieldset>

            <fieldset className="donate-form-amount">
                <legend>
                    <h3>Amount</h3>
                </legend>
                <div className="radios">
                    {this.intervalAmounts.map(amount =>
                        <div key={amount} className="radio">
                            <input type="radio" id={`amount-${amount}`} value={amount} name="amount" onChange={() => this.setPresetAmount(amount)} checked={amount === this.presetAmount && !this.isCustom} />
                            <label htmlFor={`amount-${amount}`}>
                                ${amount}
                            </label>
                        </div>
                    )}
                    <div className="radio custom-radio">
                        <input type="radio" id="custom" name="amount" checked={this.isCustom} onChange={(event) => this.setIsCustom(event.target.checked)} />
                        <label htmlFor="custom">
                            $<input type="text" placeholder="Other" name="custom-amount" className="custom-amount-input" onChange={(event) => this.setCustomAmount(event.target.value)} value={this.customAmount} />
                        </label>
                    </div>
                </div>
            </fieldset>

            {/* We cannot ask for a name yet because we need a server & database to store it */}
            {/* <fieldset className="donate-form-details">
                <legend>
                    <h3>Your name</h3>
                </legend>
                <div className="text-field-block">
                    <input type="text" id="full-name" name="full-name" />
                    <p className="note">
                        We will not publish your name without your permission
                    </p>
                </div>
            </fieldset> */}

            {this.errorMessage && <p className="error">
                {this.errorMessage}
            </p>}

            <button type="submit">
                Continue using credit card
            </button>

            <p className="note">
                You will be redirected to a secure page to enter your payment details. We will not share any of your details with any third parties.
            </p>
        </form>
    }
}

export class DonateFormRunner {
    async run() {
        ReactDOM.render(<DonateForm />, document.querySelector(".donate-form-container"))
    }
}

export function runDonateForm() {
    const donateForm = new DonateFormRunner()
    donateForm.run()
}