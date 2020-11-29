import Stripe from "stripe"
import { groupBy, sum } from "lodash"

import { STRIPE_SECRET_KEY } from "../adminSiteServer/utils/node_modules/serverSettings"
import { csvRow } from "serverUtils/serverUtil"

const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2020-03-02",
})

interface CustomerWithPaymentIntents extends Stripe.Customer {
    paymentIntents: Stripe.PaymentIntent[]
}

interface StripeObject {
    id: string
}

async function getAll<T extends StripeObject>(
    getter: ({ limit, starting_after }: any) => Stripe.ApiListPromise<T>
): Promise<T[]> {
    const result = []
    let firstRun = true
    let startingAfter
    while (firstRun || startingAfter) {
        const response: Stripe.ApiList<T> = await getter({
            limit: 100,
            starting_after: startingAfter,
        })
        result.push(...response.data)
        startingAfter =
            response.has_more && response.data.length > 0
                ? response.data[response.data.length - 1].id
                : undefined
        firstRun = false
    }
    return result
}

const getAllPaymentIntents = () =>
    getAll<Stripe.PaymentIntent>(
        stripe.paymentIntents.list.bind(stripe.paymentIntents)
    )
const getAllCustomers = () =>
    getAll<Stripe.Customer>(stripe.customers.list.bind(stripe.customers))

async function getCustomersWithPaymentIntents(): Promise<
    CustomerWithPaymentIntents[]
> {
    const [paymentIntents, customers] = await Promise.all([
        getAllPaymentIntents(),
        getAllCustomers(),
    ])
    const successfulPaymentIntents = paymentIntents.filter(
        (paymentIntent) => paymentIntent.status === "succeeded"
    )
    const paymentIntentsByCustomerId = groupBy(
        successfulPaymentIntents,
        "customer"
    )
    return customers
        .map((customer) => {
            const customerWithPaymentIntent: CustomerWithPaymentIntents = {
                ...customer,
                paymentIntents: paymentIntentsByCustomerId[customer.id] || [],
            }
            return customerWithPaymentIntent
        })
        .filter((customer) => customer.paymentIntents.length > 0)
}

async function getDonors() {
    const customers = await getCustomersWithPaymentIntents()
    return customers.map((customer) => {
        const metadata: Stripe.Metadata = {
            ...customer.metadata,
            ...customer.paymentIntents[0]?.metadata,
            ...customer.subscriptions?.data[0]?.metadata,
        }
        return {
            email: customer.email,
            name: metadata?.name,
            showOnList: metadata?.showOnList,
            isMonthly: !!customer.subscriptions?.data.length,
            created: new Date(customer.created * 1000).toISOString(),
            total: sum(customer.paymentIntents.map((pi) => pi.amount)) / 100,
        }
    })
}

function toCSV(headers: string[], data: any[]) {
    return [
        csvRow(headers),
        ...data.map((json) => csvRow(headers.map((header) => json[header]))),
    ].join("") // csvRow() already adds newlines
}

async function writeDonorsCSV() {
    const donors = await getDonors()
    process.stdout.write(
        toCSV(
            ["email", "name", "showOnList", "isMonthly", "total", "created"],
            donors
        )
    )
}

writeDonorsCSV()
