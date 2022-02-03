const DEFAULT_THUMBNAIL_URL = "http://localhost:3030/default-thumbnail.jpg"

describe("Kitchen sink", function () {
    beforeEach(() => {
        cy.visit("/kitchen-sink")
    })

    it("Tests prominent links", function () {
        cy.contains("Article link (with fallbacks, with domain)")
            .next()
            .contains(
                "Child Mortality: an everyday tragedy of enormous scale that we can make progress against"
            )
            .within(() => {
                cy.get("img").should(
                    "have.attr",
                    "src",
                    "http://localhost:3030/uploads/2021/07/Screen-Shot-2021-07-16-at-14.36.49-150x82.png"
                )
            })
        cy.contains("Article link (with fallbacks, without domain)")
            .next()
            .contains(
                "Child Mortality: an everyday tragedy of enormous scale that we can make progress against"
            )
            .within(() => {
                cy.get("img").should(
                    "have.attr",
                    "src",
                    "http://localhost:3030/uploads/2021/07/Screen-Shot-2021-07-16-at-14.36.49-150x82.png"
                )
            })
        cy.contains("Topic link (with fallbacks)")
            .next()
            .contains("Child and Infant Mortality")
            .within(() => {
                cy.get("img").should(
                    "have.attr",
                    "src",
                    "http://localhost:3030/uploads/2019/11/Child-deaths-by-cause-1990-to-2017-IHME-01-150x107.png"
                )
            })
        cy.contains("Grapher link (with fallbacks)")
            .next()
            .contains("Child mortality")
            .within(() => {
                cy.get("img").should(
                    "have.attr",
                    "src",
                    "http://localhost:3030/grapher/exports/child-mortality.svg"
                )
            })
        cy.contains(
            "Explorer link to default configuration (grapher based, with fallback title, default thumbnail)"
        )
            .next()
            .contains("COVID-19 Data Explorer")
            .within(() => {
                cy.get("img").should("have.attr", "src", DEFAULT_THUMBNAIL_URL)
            })
        cy.contains(
            "Explorer link to default configuration (spreadsheet based, with fallback title, default thumbnail)"
        )
            .next()
            .contains("CO₂ Data Explorer")
            .within(() => {
                cy.get("img").should("have.attr", "src", DEFAULT_THUMBNAIL_URL)
            })
    })
})
