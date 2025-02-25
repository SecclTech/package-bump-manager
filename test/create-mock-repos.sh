#!/bin/bash

echo "📌 Starting Verdaccio..."
docker rm -f verdaccio &> /dev/null
docker run -d --name verdaccio -p 4873:4873 verdaccio/verdaccio > /dev/null 2>&1

echo "📌 Setting npm registry to Verdaccio (via environment variable)"
echo -n "@seccl:registry=http://localhost:4873" > .npmrc
echo "✅ npm will now use Verdaccio for all operations"

EXPECTED_SCOPED_REGISTRY="http://localhost:4873"
CURRENT_SCOPED_REGISTRY=$(npm config get @seccl:registry)

echo "📌 Expected Registry: '$EXPECTED_SCOPED_REGISTRY'"
echo "📌 Current Registry: '$CURRENT_SCOPED_REGISTRY'"

if [[ "$CURRENT_SCOPED_REGISTRY" == "$EXPECTED_SCOPED_REGISTRY" ]]; then
    echo "✅ Scoped packages (@seccl/*) are using Verdaccio ($CURRENT_SCOPED_REGISTRY)"
else
    echo "❌ ERROR: Scoped packages are NOT using Verdaccio! Found: $CURRENT_SCOPED_REGISTRY"
    exit 1
fi

# Ensure a Gitea user is provided
GITEA_USER="test-user"
GITEA_PASSWORD="password"
GITEA_URL="http://localhost:3000"

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

VERDACCIO_REGISTRY="http://localhost:4873"

echo "Starting Verdaccio for realistic lockfiles..."
docker run -d --name verdaccio -p 4873:4873 verdaccio/verdaccio > /dev/null

echo "Creating ${#ALL_PACKAGES[@]} npm packages..."

# Create all packages
for PACKAGE in "${ALL_PACKAGES[@]}"; do
    mkdir "$PACKAGE"
    cd "$PACKAGE" || exit
    SCOPED_PACKAGE_NAME="@seccl/$PACKAGE"

    echo "@seccl:registry=$VERDACCIO_REGISTRY" > .npmrc
    npm init -y > /dev/null

    jq --arg name "$SCOPED_PACKAGE_NAME" --arg registry "$VERDACCIO_REGISTRY" \
          '.publishConfig.registry = $registry | .publishConfig.access = "restricted"' \
          package.json > tmp.json && mv tmp.json package.json

    echo "module.exports = '$SCOPED_PACKAGE_NAME';" > index.js

    # Skip dependencies for Tier 0
    if [[ " ${TIER_1[*]} " =~ $PACKAGE ]]; then
        jq --arg dep "@seccl/core-library" '.dependencies[$dep] = "1.0.0"' package.json > tmp.json && mv tmp.json package.json
    elif [[ " ${TIER_2[*]} " =~ $PACKAGE ]]; then
        DEP1="@seccl/${TIER_1[$((RANDOM % ${#TIER_1[@]}))]}"
        DEP2="@seccl/${TIER_1[$((RANDOM % ${#TIER_1[@]}))]}"
        jq --arg dep1 "$DEP1" --arg dep2 "$DEP2" \
           '.dependencies[$dep1] = "1.0.0" | .dependencies[$dep2] = "1.0.0"' \
           package.json > tmp.json && mv tmp.json package.json
    elif [[ " ${TIER_3[*]} " =~ $PACKAGE ]]; then
        DEP1="@seccl/${TIER_2[$((RANDOM % ${#TIER_2[@]}))]}"
        DEP2="@seccl/${TIER_2[$((RANDOM % ${#TIER_2[@]}))]}"
        jq --arg dep1 "$DEP1" --arg dep2 "$DEP2" \
           '.dependencies[$dep1] = "1.0.0" | .dependencies[$dep2] = "1.0.0"' \
           package.json > tmp.json && mv tmp.json package.json
    elif [[ " ${TIER_4[*]} " =~ $PACKAGE ]]; then
        DEP1="@seccl/${TIER_3[$((RANDOM % ${#TIER_3[@]}))]}"
        DEP2="@seccl/${TIER_3[$((RANDOM % ${#TIER_3[@]}))]}"
        DEP3="@seccl/${TIER_2[$((RANDOM % ${#TIER_2[@]}))]}"  # Introduce cross-tier dependencies
        jq --arg dep1 "$DEP1" --arg dep2 "$DEP2" --arg dep3 "$DEP3" \
           '.dependencies[$dep1] = "1.0.0" | .dependencies[$dep2] = "1.0.0" | .dependencies[$dep3] = "1.0.0"' \
           package.json > tmp.json && mv tmp.json package.json
        touch serverless.ts  # Mark as deployable
    fi

     # Install dependencies & generate a proper package-lock.json
     npm install --registry $VERDACCIO_REGISTRY

     echo "📌 Publishing $SCOPED_PACKAGE_NAME to Verdaccio..."
     npm publish --registry $VERDACCIO_REGISTRY

    cd ..
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
#    gh repo create "$GITHUB_USER_OR_ORG/$PACKAGE" --private --source=. --remote=origin --push > /dev/null

    echo "GitHub repository created: https://github.com/$GITHUB_USER_OR_ORG/$PACKAGE"

    cd ..
done

echo "All packages pushed to GitHub under $GITHUB_USER_OR_ORG"


echo "📌 Stopping Verdaccio..."
docker rm -f verdaccio &> /dev/null

echo "📌 Resetting npm registry setting..."

rm .npmrc

echo "✅ npm is back to default registry"
