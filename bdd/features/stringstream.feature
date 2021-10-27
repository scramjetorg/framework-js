Feature: StringStream

    Scenario: Big file processing
        Given I have StringStream created from a file "./build/test/assets/bible.txt"
        When I split it into words
        And I filter out all words longer than 8 characters
        And I aggregate words into sentences by "." as sentence end
        And I count average sentence length by words
        Then It should result with X sentences
        And It should have average sentence length of X words
