Feature: StringStream

    Scenario: Chunks can be splitted by line endings (split method)
        Given I have a StringStream created from
            """
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam finibus odio
            euismod libero sagittis ultrices. Suspendisse at ornare odio. Phasellus nec
            magna massa. Duis in sapien id mi mollis pulvinar. Etiam maximus porttitor
            leo vitae facilisis. Aliquam cursus fermentum augue at mollis. Nulla nec leo
            id dolor tristique pellentesque.

            Vivamus leo dui, maximus sit amet consequat vitae, rhoncus id nisl. Mauris quam
            velit, tristique a ipsum eu, auctor mattis odio. Vestibulum vestibulum pharetra volutpat.
            Nulla dapibus ipsum vitae quam iaculis, non gravida magna efficitur.
            """
        When I call split function with EOL character
        Then It should result with 9 chunks as output
        And Chunk nr 5 is "id dolor tristique pellentesque."

    Scenario: File processing
        Given I have a StringStream created from a file "./build/test/_assets/short.txt"
        When I split it into words
        And I filter out all words longer than 8 characters
        And I aggregate words into sentences by "." as sentence end
        And I count average sentence length by words
        Then It should result with 4 sentences
        And It should have average sentence length of 15.5 words

    Scenario: Long file processing
        Given I have a StringStream created from a file "./build/test/_assets/long.txt"
        When I split it into words
        And I filter out all words longer than 8 characters
        And I aggregate words into sentences by "." as sentence end
        And I count average sentence length by words
        Then It should result with 12709 sentences
        And It should have average sentence length of 34.22 words
