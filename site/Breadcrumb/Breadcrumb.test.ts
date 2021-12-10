#! /usr/bin/env jest

import { getSubnavItem } from "../SiteSubnavigation"
import { getBreadcrumbItems, getSubnavParent } from "./Breadcrumb"

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
    it("gets parent", () => {
        expect(
            getSubnavParent(
                getSubnavItem("cancel-public-events", subnavs["coronavirus"]),
                subnavs["coronavirus"]
            )
        ).toEqual(getSubnavItem("policy-responses", subnavs["coronavirus"]))
    })
    it("gets single level breadcrumb", () => {
        expect(
            getBreadcrumbItems("coronavirus", subnavs["coronavirus"])
        ).toEqual([getSubnavItem("coronavirus", subnavs["coronavirus"])])
    })
    it("gets multi level breadcrumb", () => {
        expect(
            getBreadcrumbItems("cancel-public-events", subnavs["coronavirus"])
        ).toEqual([
            getSubnavItem("coronavirus", subnavs["coronavirus"]),
            getSubnavItem("excess-mortality", subnavs["coronavirus"]),
            getSubnavItem("policy-responses", subnavs["coronavirus"]),
            getSubnavItem("cancel-public-events", subnavs["coronavirus"]),
        ])
    })
})
