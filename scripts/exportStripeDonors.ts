import Stripe from "stripe"
import { groupBy, sum } from "lodash"

import { STRIPE_SECRET_KEY } from "serverSettings"
import { csvRow } from "utils/server/serverUtil"

const stripe = new Stripe(STRIPE_SECRET_KEY)

interface CustomerWithCharges extends Stripe.customers.ICustomer {
    charges: Stripe.charges.ICharge[]
}

async function getAll(
    getter: ({ limit, starting_after }: any) => Promise<Stripe.IList<any>>
): Promise<any[]> {
    const result = []
    let firstRun = true
    let startingAfter
    while (firstRun || startingAfter) {
        const response: Stripe.IList<any> = await getter({
            limit: 100,
            starting_after: startingAfter
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

const getAllCharges = () => getAll(stripe.charges.list.bind(stripe.charges))
const getAllCustomers = () =>
    getAll(stripe.customers.list.bind(stripe.customers))

async function getCustomersWithCharges(): Promise<CustomerWithCharges[]> {
    const [charges, customers] = await Promise.all([
        getAllCharges(),
        getAllCustomers()
    ])
    const successfulCharges = charges.filter(
        charge => charge.paid && !charge.refunded
    )
    const chargesByCustomerId = groupBy(successfulCharges, "customer")
    return customers
        .map(customer => {
            const customerWithCharge: CustomerWithCharges = {
                ...customer,
                charges: chargesByCustomerId[customer.id] || []
            }
            return customerWithCharge
        })
        .filter(customer => customer.charges.length > 0)
}

async function getDonors() {
    const customers = await getCustomersWithCharges()
    return customers.map(customer => {
        const metadata =
            (customer.charges[0] && customer.charges[0].metadata) ||
            (customer.subscriptions.data[0] &&
                customer.subscriptions.data[0].metadata)
        return {
            email: customer.email,
            name: metadata && metadata.name,
            showOnList: metadata && metadata.showOnList,
            isMonthly: customer.subscriptions.data.length > 0,
            created: new Date(customer.created * 1000).toISOString(),
            total: sum(customer.charges.map(charge => charge.amount)) / 100
        }
    })
}

function toCSV(headers: string[], data: any[]) {
    return [
        csvRow(headers),
        ...data.map(json => csvRow(headers.map(header => json[header])))
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
