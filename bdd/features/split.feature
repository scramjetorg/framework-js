Feature: DataStream split function

    Scenario: Chunks can be splitted by line endings
        Given I have DataStream of type "string" created from
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
        When I call split function with "\n" param
        Then It should result with 9 chunks as output
        And Chunk nr 5 is "id dolor tristique pellentesque."
