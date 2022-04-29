#!/bin/bash

echo "Installing $1 version..."

npm i @scramjet/framework@$1 --no-save

echo "Starting test..."

node index.js
