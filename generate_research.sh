#!/bin/bash

# Script to generate research prompt step-by-step via API calls

# --- Configuration ---
KEYWORD="credit card" # Default keyword
MEDIA_SITE_NAME="BF"    # Default media site name
BASE_URL="https://keyword-killer-next-ugr9.vercel.app" # Adjust if your server runs elsewhere

# --- Command Line Arguments ---
# Allow overriding keyword and site name via arguments
if [ ! -z "$1" ]; then
  KEYWORD="$1"
fi
if [ ! -z "$2" ]; then
  MEDIA_SITE_NAME="$2"
fi

# API Endpoints
STEP1_URL="${BASE_URL}/api/writing/steps/1-analyze"
STEP2_URL="${BASE_URL}/api/writing/steps/2-plan"
STEP3_URL="${BASE_URL}/api/writing/steps/3-finalize"

# Check for jq
if ! command -v jq &> /dev/null
then
    echo "Error: jq is not installed. Please install jq (e.g., 'brew install jq' or 'sudo apt-get install jq')" >&2
    exit 1
fi

echo "Starting research generation for Keyword: '${KEYWORD}', Site: '${MEDIA_SITE_NAME}'"
echo "--------------------------------------------------"

# --- Step 1: Analyze ---
echo "[Step 1] Calling Analyze API: ${STEP1_URL}"
STEP1_INPUT=$(jq -n --arg kw "${KEYWORD}" --arg site "${MEDIA_SITE_NAME}" '{keyword: $kw, mediaSiteName: $site}')

STEP1_OUTPUT=$(curl -s -X POST -H "Content-Type: application/json" -d "${STEP1_INPUT}" "${STEP1_URL}")

# Check for curl error
if [ $? -ne 0 ]; then
    echo "Error: curl command failed for Step 1." >&2
    exit 1
fi

# Check for API error in response (simple check for 'error' key)
if ! echo "${STEP1_OUTPUT}" | jq '.' > /dev/null 2>&1; then
    echo "Error: Step 1 response is not valid JSON:" >&2
    echo "${STEP1_OUTPUT}"
    exit 1
elif echo "${STEP1_OUTPUT}" | jq -e '.error' > /dev/null; then
    echo "Error: API returned an error in Step 1:" >&2
    echo "${STEP1_OUTPUT}" | jq '.' # Pretty print the error JSON
    exit 1
fi

echo "[Step 1] Success. Received intermediate data."
# echo "[Step 1] Data: ${STEP1_OUTPUT}" # Uncomment for debugging

# --- Step 2: Plan ---
echo "[Step 2] Calling Plan API: ${STEP2_URL}"
# Step 2 input is the direct output from Step 1
STEP2_OUTPUT=$(curl -s -X POST -H "Content-Type: application/json" -d "${STEP1_OUTPUT}" "${STEP2_URL}")

# Check for curl error
if [ $? -ne 0 ]; then
    echo "Error: curl command failed for Step 2." >&2
    exit 1
fi

# Check for API error in response
if ! echo "${STEP2_OUTPUT}" | jq '.' > /dev/null 2>&1; then
    echo "Error: Step 2 response is not valid JSON:" >&2
    echo "${STEP2_OUTPUT}"
    exit 1
elif echo "${STEP2_OUTPUT}" | jq -e '.error' > /dev/null; then
    echo "Error: API returned an error in Step 2:" >&2
    echo "${STEP2_OUTPUT}" | jq '.' # Pretty print the error JSON
    exit 1
fi

echo "[Step 2] Success. Received action plan data."
# echo "[Step 2] Data: ${STEP2_OUTPUT}" # Uncomment for debugging

# --- Step 3: Finalize ---
echo "[Step 3] Calling Finalize API: ${STEP3_URL}"
# Step 3 input is the direct output from Step 2
FINAL_PROMPT=$(curl -s -X POST -H "Content-Type: application/json" -d "${STEP2_OUTPUT}" "${STEP3_URL}")

# Check for curl error
if [ $? -ne 0 ]; then
    echo "Error: curl command failed for Step 3." >&2
    exit 1
fi

# Check if the final output seems like JSON before assuming it's the prompt
# A simple check: does it start with '{'? If not, or if it's a JSON error, report it.
if [[ "${FINAL_PROMPT}" != \{* ]] || echo "${FINAL_PROMPT}" | jq -e '.error' > /dev/null 2>&1; then
     echo "Error: API response in Step 3 was not the expected prompt or contained an error:" >&2
     # Try to pretty-print if it's JSON, otherwise print raw
     if echo "${FINAL_PROMPT}" | jq '.' > /dev/null 2>&1; then
        echo "${FINAL_PROMPT}" | jq '.'
     else
        echo "${FINAL_PROMPT}"
     fi
     exit 1
fi

echo "--------------------------------------------------"
echo "[Step 3] Success. Final Research Prompt Generated:"
echo "--------------------------------------------------"
echo "${FINAL_PROMPT}"

echo "--------------------------------------------------"
echo "Script finished." 