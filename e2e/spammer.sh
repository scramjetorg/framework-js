#!/bin/bash

# output random numbers in batches of random size, with random delay
# $RANDOM -> random int between 0 and 32767
yellow="\033[33m"
red="\033[31m"
reset="\033[0m"

for i in $(seq 1 6); do
    batch_size=$((RANDOM>>12))  # 0-7 range
    for i in $(seq 1 $batch_size); do
        value=$((RANDOM>>10))  # 0-31 range

        # log to stderr for easier debugging
        echo -e 1>&2 "${yellow}Generated: $value${reset}"
        echo 1>>LOG "$value"

        # payload
        echo "$value"
    done

    delay=$(echo "scale=1; $RANDOM / 10000" | bc)
    echo -e 1>&2 "${red}Sleeping $delay seconds...${reset}"
    sleep $delay
done
