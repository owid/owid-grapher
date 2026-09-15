Feature: Latest feed

    Scenario: Filtering the feed by content type
        Given I am on the latest page
        When I filter the feed by type "Data updates"
        Then the feed is filtered to the type "data-update"
        And every card in the feed is a data update
        When I filter the feed by type "All"
        Then the feed is no longer filtered by type

    Scenario: Data updates expand in place under their type filter
        Given I am on the latest page
        Then the first data update card is compact
        When I filter the feed by type "Data updates"
        Then the first data update card is expanded
        And the first data update card offers a copy link

    Scenario: A compact data update card links to its standalone page
        Given I am on the latest page
        When I open the first data update card
        Then I am on a standalone page
        And the breadcrumb links back to the "Data updates" feed
        When I follow the breadcrumb back to the feed
        Then the feed is filtered to the type "data-update"

    Scenario: Data insights read in place, with an Expanded/Compact toggle
        Given I am on the latest page
        Then I do not see the view toggle
        When I filter the feed by type "Data Insights"
        Then I see the view toggle
        And the view toggle is set to "Expanded"
        And the first data insight card is expanded
        When I select the "Compact" view
        Then the first data insight card is compact

    Scenario: Filtering the feed by topic
        Given I am on the latest page
        When I select the topic pill "Population and Demographic Change"
        Then the feed is filtered to the topic "Population and Demographic Change"
        When I select the topic pill "All"
        Then the feed is no longer filtered by topic

    Scenario: URL sanitization of a legacy topic param
        Given I am on the latest page with the url "/latest?topic=Health"
        Then the feed is no longer filtered by topic
        And the feed is no longer filtered by type

    Scenario: URL sanitization of an unknown type value
        Given I am on the latest page with the url "/latest?type=not-a-type"
        Then the feed is no longer filtered by type

    Scenario: Deep-linked data updates expand on arrival
        Given I am on the latest page
        When I deep-link to the first data update card
        Then the deep-linked data update card is expanded

    Scenario: The reveal-on-scroll-up arm brings the filters back on scrolling up
        Given I am on the latest page in the "reveal-on-scroll-up" sticky filters arm
        When I scroll down the feed
        Then the filters are only partly in view
        When I scroll back up the feed
        Then the filters are fully in view

    Scenario: The not-sticky arm leaves the filters behind
        Given I am on the latest page in the "not-sticky" sticky filters arm
        When I scroll down the feed
        Then the filters have scrolled out of view
        When I scroll back up the feed
        Then the filters have scrolled out of view

    Scenario: The fully-sticky arm keeps the filters pinned
        Given I am on the latest page in the "fully-sticky" sticky filters arm
        When I scroll down the feed
        Then the filters are fully in view
        When I scroll back up the feed
        Then the filters are fully in view
