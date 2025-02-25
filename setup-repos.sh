#!/bin/bash

# Ensure a GitHub org/username is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <github-org-or-username>"
    exit 1
fi

# GitHub organisation or username (taken from CLI argument)
GITHUB_USER_OR_ORG="$1"

# Test environment directory
TEST_ENV="test-npm-env"
rm -rf "$TEST_ENV"
mkdir "$TEST_ENV"
cd "$TEST_ENV" || exit

# Define meaningful package names
TIER_0=("core-library")
TIER_1=("logger" "config-manager" "error-handler" "utils" "metrics")
TIER_2=("auth-service" "data-processor" "cache-manager" "queue-service" "notification-service")
TIER_3=("report-generator" "analytics-engine" "ai-model" "file-uploader" "search-indexer")
TIER_4=("billing-service" "user-api" "inventory-api" "email-service" "fraud-detection")

# Flatten all names for easier handling
ALL_PACKAGES=("${TIER_0[@]}" "${TIER_1[@]}" "${TIER_2[@]}" "${TIER_3[@]}" "${TIER_4[@]}")

echo "Creating ${#ALL_PACKAGES[@]} npm packages..."

# Create all packages
for PACKAGE in "${ALL_PACKAGES[@]}"; do
    mkdir "$PACKAGE"
    cd "$PACKAGE" || exit
    npm init -y > /dev/null
    echo "module.exports = '$PACKAGE';" > index.js
    cd ..
done

echo "Assigning dependencies..."

# Assign dependencies based on tiers
for ((i = 1; i < ${#ALL_PACKAGES[@]}; i++)); do
    PACKAGE="${ALL_PACKAGES[$i]}"
    TIER=$(((i - 1) / 5)) # Each tier has 5 packages

    # Get all packages from the previous tier
    PREV_TIER_START=$(((TIER - 1) * 5))

    if [ $TIER -gt 0 ]; then
        # Pick 2 dependencies from the previous tier
        DEP1="${ALL_PACKAGES[$((PREV_TIER_START + RANDOM % 5))]}"
        DEP2="${ALL_PACKAGES[$((PREV_TIER_START + RANDOM % 5))]}"

        cd "$PACKAGE" || exit
        npm link "../$DEP1" "../$DEP2"
        cd ..
    fi

    # Mark Tier 4 as deployables with a `serverless.ts` file
    if [ $TIER -eq 4 ]; then
        touch "$PACKAGE/serverless.ts"
    fi
done

echo "Initializing Git and pushing to GitHub..."

# Loop through each package, initialise Git, commit, and push to GitHub
for PACKAGE in "${ALL_PACKAGES[@]}"; do
    cd "$PACKAGE" || exit

    # Initialise Git
    git init > /dev/null
    git branch -M main

    # Create a .gitignore file
    echo "node_modules/" > .gitignore

    # Add files and commit
    git add .
    git commit -m "Initial commit for $PACKAGE" > /dev/null

    # Create GitHub repository
    gh repo create "$GITHUB_USER_OR_ORG/$PACKAGE" --public --source=. --remote=origin --push > /dev/null

    echo "GitHub repository created: https://github.com/$GITHUB_USER_OR_ORG/$PACKAGE"

    cd ..
done

echo "All packages pushed to GitHub under $GITHUB_USER_OR_ORG"
