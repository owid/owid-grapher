#! /usr/bin/env jest

import { getAncestors, getParent } from "./Breadcrumb"

const subnavs = {
    coronavirus: [
        { label: "Coronavirus", href: "/coronavirus", id: "coronavirus" },
        {
            label: "Excess mortality",
            href: "/excess-mortality-covid",
            id: "excess-mortality",
        },
        {
            label: "Policy responses",
            href: "/policy-responses-covid",
            id: "policy-responses",
            parentId: "excess-mortality",
        },
        {
            label: "Cancellation of Public Events",
            href: "/covid-cancel-public-events",
            id: "cancel-public-events",
            parentId: "policy-responses",
        },
    ],
}

describe("breadcrumb", () => {
    const getItem = (id: string) => {
        return (
            subnavs.coronavirus.find((item) => item.id === id) || {
                label: "",
                href: "",
                id: "",
            }
        )
    }
    it("gets parent", () => {
        expect(
            getParent(getItem("cancel-public-events"), subnavs["coronavirus"])
        ).toEqual(getItem("policy-responses"))
    })
    it("gets ancestors", () => {
        expect(
            getAncestors("/covid-cancel-public-events", subnavs["coronavirus"])
        ).toEqual([
            getItem("coronavirus"),
            getItem("excess-mortality"),
            getItem("policy-responses"),
        ])
    })
})
