Feature: DataStream split function

    Scenario: Chunks can be splitted by line ending
        Given I have DataStream (String)
        And It was created from input text
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
        When The split function with "\n" param is called
        Then It should result with 9 chunks as output
