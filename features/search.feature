Feature: Search autocomplete

    Background:
        Given I am on the search page

    Scenario: Autocomplete topic filters
        When I type "the povert" in the search input
        And I select the topic suggestion "Poverty"
        Then I see "Poverty" as an active topic filter
        And the search input is cleared after the topic is applied
        And the url contains the topic filter "Poverty"
        When I navigate back to the previous search state
        Then the url no longer contains topic filters

    Scenario: Autofocus and autocomplete suggestions visibility
        Then the search bar should be focused
        And suggestions should not be visible
        When I type "gdp" in the search input
        Then suggestions should be visible



