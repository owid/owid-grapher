const DEFAULT_THUMBNAIL_URL = "http://localhost:3030/default-thumbnail.jpg"
const OVERRIDE_THUMBNAIL_URL =
    "http://localhost:3030/uploads/2021/01/covid-country-profiles-768x404.png"

describe("Kitchen sink", function () {
    beforeEach(() => {
        // The content of that page is backed up in kitchenSink.wordpress.html,
        // but isn't read from there. The master copy lives in the wordpress database.
        cy.visit("http://localhost:8080/admin/posts/preview/48730")
        cy.get('[type="email"]').type("admin@example.com")
        cy.get('[type="password"]').type("admin")
        cy.get('[type="submit"]').click()
    })

    it("Tests prominent links", function () {
        const testProminentLink = ({ testTitle, title, src, href }) => {
            cy.contains(testTitle)
                .next()
                .contains(title)
                .within(($a) => {
                    src && cy.get("img").should("have.attr", "src", src)
                    href && $a.attr("href") === href
                })
        }

        const testProminentLinkRemoved = ({ testTitle }) => {
            cy.contains(testTitle).next().contains("(link removed)")
        }

        // Standard prominent links
        // With automatic fallback
        testProminentLink({
            testTitle:
                "Article link (with fallbacks, with domain, with protocol)",
            title: "Child mortality: an everyday tragedy of enormous scale that we can make progress against",
            src: "http://localhost:3030/uploads/2021/07/Screen-Shot-2021-07-16-at-14.36.49-150x82.png",
        })
        testProminentLink({
            testTitle:
                "Article link (with fallbacks, with domain, without protocol)",
            title: "Child mortality: an everyday tragedy of enormous scale that we can make progress against",
            src: "http://localhost:3030/uploads/2021/07/Screen-Shot-2021-07-16-at-14.36.49-150x82.png",
        })
        testProminentLink({
            testTitle:
                "Article link (with fallbacks, without domain, without protocol)",
            title: "Child mortality: an everyday tragedy of enormous scale that we can make progress against",
            src: "http://localhost:3030/uploads/2021/07/Screen-Shot-2021-07-16-at-14.36.49-150x82.png",
        })
        testProminentLink({
            testTitle: "Topic link (with fallbacks)",
            title: "Child and Infant Mortality",
            src: "http://localhost:3030/uploads/2019/11/Child-deaths-by-cause-1990-to-2017-IHME-01-150x107.png",
        })
        testProminentLink({
            testTitle: "Grapher link (with fallbacks)",
            title: "Child mortality",
            src: "http://localhost:3030/grapher/exports/child-mortality.svg",
        })
        testProminentLink({
            testTitle:
                "Explorer link to default configuration (spreadsheet based, with fallback title, default thumbnail)",
            title: "COVID-19 Data Explorer",
            src: DEFAULT_THUMBNAIL_URL,
        })
        testProminentLink({
            testTitle:
                "Explorer link to specific configuration (spreadsheet based, with fallback title, default thumbnail)",
            title: "Estimate of the effective reproduction rate (R) of COVID-19",
            src: DEFAULT_THUMBNAIL_URL,
        })
        testProminentLink({
            testTitle:
                "Explorer link to default configuration (grapher based, with fallback title, default thumbnail)",
            title: "CO₂ Data Explorer",
            src: DEFAULT_THUMBNAIL_URL,
        })
        testProminentLink({
            testTitle:
                "Explorer link to specific configuration (grapher based, with fallback title, default thumbnail)",
            title: "Methane emissions",
            src: DEFAULT_THUMBNAIL_URL,
        })
        testProminentLinkRemoved({
            testTitle: "External link (no title)",
        })

        // With overrides
        testProminentLink({
            testTitle: "Article link (with overrides)",
            title: "[OVERRIDE] Child Mortality: an everyday tragedy of enormous scale that we can make progress against",
            src: OVERRIDE_THUMBNAIL_URL,
        })
        testProminentLink({
            testTitle: "Topic link (with overrides)",
            title: "[OVERRIDE] Child and Infant Mortality",
            src: OVERRIDE_THUMBNAIL_URL,
        })
        testProminentLink({
            testTitle: "Grapher link (with overrides)",
            title: "[OVERRIDE] Child mortality",
            src: OVERRIDE_THUMBNAIL_URL,
        })
        testProminentLink({
            testTitle: "Explorer link (with overrides)",
            title: "[OVERRIDE] COVID-19 Data Explorer",
            src: OVERRIDE_THUMBNAIL_URL,
        })
        testProminentLink({
            testTitle: "External link (with title override)",
            title: "Child mortality (wikipedia)",
        })

        // With redirects
        testProminentLink({
            testTitle:
                "Article link redirected to article (in wordpress, single redirect)",
            title: "CO2 emissions by fuel",
            src: "http://localhost:3030/uploads/2020/08/CO2-by-source-150x106.png",
        })
        testProminentLink({
            testTitle:
                "[NOT RECOMMENDED] Article redirected to article (in wordpress, multiple redirects)",
            title: "Coronavirus (COVID-19) Testing",
            src: "http://localhost:3030/uploads/2021/01/covid-testing-150x79.png",
        })
        testProminentLink({
            testTitle:
                "Article link redirected to article (in wordpress, with overrides)",
            title: "[OVERRIDE] CO2 by fuel",
            src: "http://localhost:3030/uploads/2020/08/CO2-by-source-150x106.png",
        })
        testProminentLink({
            testTitle: "Grapher link redirected to article (in wordpress)",
            title: "Democracy",
            src: "http://localhost:3030/uploads/2021/12/democratic-rights-thumbnail-150x59.png",
        })
        testProminentLink({
            testTitle: "Grapher link redirected to grapher (in admin)",
            title: "Per capita CO₂ emissions",
            src: "http://localhost:3030/grapher/exports/co-emissions-per-capita.svg",
        })
        testProminentLink({
            testTitle:
                "Grapher link redirected to grapher (in admin, with query string in source)",
            title: "Per capita CO₂ emissions",
            src: "http://localhost:3030/grapher/exports/co-emissions-per-capita.svg",
            href: "http://localhost:3030/grapher/co-emissions-per-capita?country=FRA~USA",
        })
        testProminentLink({
            testTitle:
                "Article link redirected to explorer (in wordpress, with query string in source and target)",
            title: "Share of SARS-CoV-2 sequences that are the omicron variant",
            src: DEFAULT_THUMBNAIL_URL,
            href: "http://localhost:3030/explorers/coronavirus-data-explorer?facet=none&Metric=Omicron+variant+%28share%29&Interval=7-day+rolling+average&Relative+to+Population=true&Color+by+test+positivity=false&country=USA~ITA~CAN~DEU~GBR~FRA~JPN",
        })
        testProminentLink({
            testTitle: "Grapher link redirected to explorer (in explorer code)",
            title: "Cumulative confirmed COVID-19 cases",
            src: DEFAULT_THUMBNAIL_URL,
        })
        testProminentLink({
            testTitle:
                "[NOT RECOMMENDED] Grapher link redirected to grapher (in wordpress)",
            title: "Adjusted net savings per capita",
            src: "http://localhost:3030/grapher/exports/adjusted-net-savings-per-person.svg",
        })
    })
})
