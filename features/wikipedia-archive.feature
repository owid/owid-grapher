Feature: Wikipedia archive

    Charts served from the Wikipedia archive should not make requests
    to Google servers, unlike the production archive.

    Scenario: Production archive chart makes GTM requests
        Given I open "life-expectancy" from the production archive
        Then the page should make requests to Google Tag Manager

    Scenario: Wikipedia archive chart does not make GTM requests
        Given I open "life-expectancy" from the wikipedia archive
        Then the page should not make requests to Google Tag Manager
