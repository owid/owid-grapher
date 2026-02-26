Feature: Search autocomplete

    Scenario: Autocomplete topic filters
        Given I am on the search page
        When I type "the povert" in the search autocomplete input
        And I select the topic suggestion "Poverty"
        Then I see "Poverty" as an active topic filter
        And the search autocomplete input is cleared after the topic is applied
        And the url contains the topic filter "Poverty"
        When I navigate back to the previous search state
        Then the url no longer contains topic filters

    Scenario: Autocomplete country filters
        Given I am on the search page
        When I type "co2 fran" in the search autocomplete input
        And I select the country suggestion "France"
        Then I see "France" as an active country filter
        And the search autocomplete input contains "co2"
        And the url contains the query "co2" and the country "France"
        When I navigate back to the previous search state
        Then the url no longer contains country filters

    Scenario: Automatic country extraction from query
        Given I am on the search page
        When I type "co2 france uk germany and the united states" in the search autocomplete input
        And I press "Enter"
        And I see "United States" as an active country filter
        Then I see "France" as an active country filter
        And I see "United Kingdom" as an active country filter
        And I see "Germany" as an active country filter
        And the search autocomplete input contains "co2"
        And the url contains the query "co2" and the countries "France", "United Kingdom", "Germany", and "United States"
        When I navigate back to the previous search state
        Then the url no longer contains country filters
        And the url no longer contains query filters

    Scenario: "Did you mean?" country filters
        Given I am on the search page
        When I type "gdp franc" in the search autocomplete input
        And I press "Enter"
        Then I see a "Did you mean?" suggestion
        And "France" is shown as a "Did you mean?" suggestion
        When I click on the "France" suggestion
        Then I see "France" as an active country filter
        And the search autocomplete input contains "gdp"
        And the url contains the query "gdp" and the country "France"
        When I navigate back to the previous search state
        Then the url no longer contains country filters
        Then the url no longer contains query filters
        When I navigate forward
        Then the url contains the query "gdp" and the country "France"

    Scenario: Search from homepage with country extraction
        Given I am on the homepage
        When I click on the homepage autocomplete input
        And I type "co2 france" in the homepage autocomplete input
        And I press "Enter"
        Then I see "France" as an active country filter
        And the search autocomplete input contains "co2"
        And the url contains the query "co2" and the country "France"
        When I navigate back to the previous page
        Then I should be on the homepage

    Scenario: Autofocus and autocomplete suggestions visibility
        Given I am on the search page
        Then the search autocomplete input should be focused
        And suggestions should not be visible
        When I type "gdp" in the search autocomplete input
        Then suggestions should be visible

    Scenario: Autofocus is only applied on initial load
        Given I am on the search page
        Then the search autocomplete input should be focused
        When I select the topic refinement "Population & Demographic Change"
        Then I see "Population & Demographic Change" as an active topic filter
        And the search autocomplete input should not be focused

    Scenario: Sync local query
        Given I am on the search page
        When I select the topic refinement "Population & Demographic Change"
        Then I see "Population & Demographic Change" as an active topic filter
        When I type "co2" in the search autocomplete input
        And I press "Enter"
        Then the search autocomplete input contains "co2"
        And the url contains the query "co2"
        When I type "local query that should be discarded after result type interaction" in the search autocomplete input
        And I press "Escape"
        And I select the result type "Writing"
        And the search autocomplete input contains "co2"
        And the url contains the query "co2"
        When I type "local query that should be discarded after country interaction" in the search autocomplete input
        And I add the country "Albania" from the country selector
        Then I see "Albania" as an active country filter
        And the url contains the country filter "Albania"
        And the search autocomplete input contains "co2"
        And the url contains the query "co2"
        And the url contains the topic filter "Population & Demographic Change"
        And the url contains the result type "writing"

    Scenario: URL sanitization with invalid country value
        Given I am on the search page with the url "/search?q=gdp&countries=Franc"
        Then the search autocomplete input contains "gdp"
        And the url is sanitized to only contain the query "gdp"

    Scenario: URL sanitization with unknown parameter name
        Given I am on the search page with the url "/search?r=gdp&countries=France"
        Then I see "France" as an active country filter
        And the search autocomplete input shows the placeholder text
        And the url is sanitized to only contain the country "France"
