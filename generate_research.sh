#!/bin/bash

# Script to generate research prompt step-by-step via API calls

# --- Configuration ---
KEYWORD="credit card" # Default keyword
MEDIA_SITE_NAME="BF"    # Default media site name
BASE_URL="https://keyword-killer-next-ugr9.vercel.app" # Adjust if your server runs elsewhere
# BASE_URL="http://localhost:3000" # Uncomment for local testing

# --- Command Line Arguments ---
# Allow overriding keyword and site name via arguments
if [ ! -z "$1" ]; then
  KEYWORD="$1"
fi
if [ ! -z "$2" ]; then
  MEDIA_SITE_NAME="$2"
fi

# --- New API Endpoints ---
API_STEP1_FETCH_SERP_URL="${BASE_URL}/api/writing/1-fetch-serp"
API_STEP2_ANALYZE_CONTENT_TYPE_URL="${BASE_URL}/api/writing/2-analyze-content-type"
API_STEP3_ANALYZE_USER_INTENT_URL="${BASE_URL}/api/writing/3-analyze-user-intent"
API_STEP4_ANALYZE_TITLE_URL="${BASE_URL}/api/writing/4-analyze-title"
API_STEP5_ANALYZE_BETTER_HAVE_URL="${BASE_URL}/api/writing/5-analyze-better-have"
API_STEP6_GENERATE_ACTION_PLAN_URL="${BASE_URL}/api/writing/6-generate-action-plan"
API_STEP7_GENERATE_FINAL_PROMPT_URL="${BASE_URL}/api/writing/7-generate-final-prompt"

# Check for jq
if ! command -v jq &> /dev/null
then
    echo "Error: jq is not installed. Please install jq (e.g., 'brew install jq' or 'sudo apt-get install jq')" >&2
    exit 1
fi

echo "Starting research generation for Keyword: '${KEYWORD}', Site: '${MEDIA_SITE_NAME}'"
echo "--------------------------------------------------"

# Function for API calls and error handling
call_api() {
    local step_name=$1
    local url=$2
    local input_json=$3
    local output_var_name=$4

    echo "[$step_name] Calling API: ${url}"
    # echo "[$step_name] Input JSON: ${input_json}"
    local response=$(curl -s -X POST -H "Content-Type: application/json" -d "${input_json}" "${url}")

    if [ $? -ne 0 ]; then
        echo "Error: curl command failed for ${step_name}." >&2
        exit 1
    fi

    if ! echo "${response}" | jq '.' > /dev/null 2>&1; then
        echo "Error: ${step_name} response is not valid JSON:" >&2
        echo "${response}"
        exit 1
    elif echo "${response}" | jq -e '.error' > /dev/null; then
        echo "Error: API returned an error in ${step_name}:" >&2
        echo "${response}" | jq '.'
        exit 1
    fi

    echo "[$step_name] Success."
    # Assign the response to the dynamic variable name
    eval ${output_var_name}='${response}'
}

# --- Step 1: Fetch SERP --- 
STEP1_INPUT=$(jq -n --arg kw "${KEYWORD}" --arg site "${MEDIA_SITE_NAME}" '{keyword: $kw, mediaSiteName: $site}')
call_api "Step 1: Fetch SERP" "${API_STEP1_FETCH_SERP_URL}" "${STEP1_INPUT}" "STEP1_OUTPUT_JSON"

# --- Step 2: Analyze Content Type --- 
STEP2_INPUT=$(echo "${STEP1_OUTPUT_JSON}" | jq '{ serpDocId: .id, keyword: .query, organicResults: .organicResults }')
call_api "Step 2: Analyze Content Type" "${API_STEP2_ANALYZE_CONTENT_TYPE_URL}" "${STEP2_INPUT}" "STEP2_OUTPUT_JSON"
CONTENT_TYPE_TEXT=$(echo "${STEP2_OUTPUT_JSON}" | jq -r '.analysisText')

# --- Step 3: Analyze User Intent ---
STEP3_INPUT=$(echo "${STEP1_OUTPUT_JSON}" | jq '{ serpDocId: .id, keyword: .query, organicResults: .organicResults, relatedQueries: .relatedQueries }')
call_api "Step 3: Analyze User Intent" "${API_STEP3_ANALYZE_USER_INTENT_URL}" "${STEP3_INPUT}" "STEP3_OUTPUT_JSON"
USER_INTENT_TEXT=$(echo "${STEP3_OUTPUT_JSON}" | jq -r '.analysisText')

# --- Step 4: Analyze Title ---
STEP4_INPUT=$(echo "${STEP1_OUTPUT_JSON}" | jq '{ serpDocId: .id, keyword: .query, organicResults: .organicResults }')
call_api "Step 4: Analyze Title" "${API_STEP4_ANALYZE_TITLE_URL}" "${STEP4_INPUT}" "STEP4_OUTPUT_JSON"
TITLE_RECOMMENDATION_TEXT=$(echo "${STEP4_OUTPUT_JSON}" | jq -r '.recommendationText')

# --- Step 5: Analyze Better Have ---
STEP5_INPUT=$(echo "${STEP1_OUTPUT_JSON}" | jq '{ serpDocId: .id, keyword: .query, organicResults: .organicResults, peopleAlsoAsk: .peopleAlsoAsk, relatedQueries: .relatedQueries, aiOverview: .aiOverview }')
call_api "Step 5: Analyze Better Have" "${API_STEP5_ANALYZE_BETTER_HAVE_URL}" "${STEP5_INPUT}" "STEP5_OUTPUT_JSON"
BETTER_HAVE_RECOMMENDATION_TEXT=$(echo "${STEP5_OUTPUT_JSON}" | jq -r '.recommendationText')
BETTER_HAVE_JSON=$(echo "${STEP5_OUTPUT_JSON}" | jq '.analysisJson') # Keep the JSON object

# --- Step 6: Generate Action Plan ---
STEP6_INPUT=$(jq -n \
                --arg kw "$(echo ${STEP1_OUTPUT_JSON} | jq -r .query)" \
                --arg site "${MEDIA_SITE_NAME}" \
                --arg ct "${CONTENT_TYPE_TEXT}" \
                --arg ui "${USER_INTENT_TEXT}" \
                --arg tt "${TITLE_RECOMMENDATION_TEXT}" \
                --arg bh "${BETTER_HAVE_RECOMMENDATION_TEXT}" \
            '{ keyword: $kw, mediaSiteName: $site, contentTypeReportText: $ct, userIntentReportText: $ui, titleRecommendationText: $tt, betterHaveRecommendationText: $bh }')
call_api "Step 6: Generate Action Plan" "${API_STEP6_GENERATE_ACTION_PLAN_URL}" "${STEP6_INPUT}" "STEP6_OUTPUT_JSON"
ACTION_PLAN_TEXT=$(echo "${STEP6_OUTPUT_JSON}" | jq -r '.actionPlanText')

# --- Step 7: Generate Final Prompt ---
# Note: Passing null/defaults for keywordReport, clusterName, template, suggestion, fineTunes as they aren't available here
STEP7_INPUT=$(jq -n \
                --arg kw "$(echo ${STEP1_OUTPUT_JSON} | jq -r .query)" \
                --arg ap "${ACTION_PLAN_TEXT}" \
                --arg site "${MEDIA_SITE_NAME}" \
                --arg ct "${CONTENT_TYPE_TEXT}" \
                --arg ui "${USER_INTENT_TEXT}" \
                --arg bh "${BETTER_HAVE_RECOMMENDATION_TEXT}" \
                --argjson bhJson "${BETTER_HAVE_JSON}" \
            '{ keyword: $kw, actionPlan: $ap, mediaSiteName: $site, contentTypeReportText: $ct, userIntentReportText: $ui, betterHaveRecommendationText: $bh, keywordReport: null, selectedClusterName: null, articleTemplate: "<!-- Default Outline -->", contentMarketingSuggestion: "", fineTuneNames: [], betterHaveAnalysisJson: $bhJson }')
call_api "Step 7: Generate Final Prompt" "${API_STEP7_GENERATE_FINAL_PROMPT_URL}" "${STEP7_INPUT}" "STEP7_OUTPUT_JSON"

# --- Final Output --- 
FINAL_PROMPT_TEXT=$(echo "${STEP7_OUTPUT_JSON}" | jq -r '.finalPrompt')

echo "--------------------------------------------------"
echo "Final Research Prompt Generated:"
echo "--------------------------------------------------"
echo "${FINAL_PROMPT_TEXT}"

echo "--------------------------------------------------"
echo "Script finished." 