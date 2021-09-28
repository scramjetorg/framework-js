#!/bin/bash

rm -f INPUT OUTPUT LOG EXPECTED
mkfifo INPUT
./spammer.sh > INPUT &
npm run test INPUT OUTPUT

for x in $(cat LOG); do
    if (( x % 2 == 0 )); then
        echo $(( x * x )) >> EXPECTED
    fi
done

diff EXPECTED OUTPUT && echo Correct results. || echo Incorrect results.
