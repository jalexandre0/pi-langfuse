#!/bin/bash
# send-prompts.sh
# Usage: bash send-prompts.sh

BASE_URL="http://192.168.45.2:3100"
PREFIX="TRACE-TEST"


echo "Sending 20 prompts to Pi"

for i in {1..20}; do
    NUM=$(printf "%02d" $i)
    PROMPT="${PREFIX}-${NUM}: What is ${i}+${i}?"
    
    echo "[$NUM/20] Sending: ${PROMPT}"
    
    # Run Pi in non-interactive mode with a specific session
    pi -c -p "${PROMPT}" 
    
    # Wait a bit for the trace to be sent to Langfuse
    sleep 10
done

echo ""
echo "✓ 20 Prompts sent. Waiting 10s for traces to settle..."
sleep 10

echo "Running validation script..."
node /Users/jsantos/Documents/projects/pi-extensions/extensions/pi-langfuse/bug-fix/validate-traces.js \
    "${BASE_URL}" \
    "pk-lf-j9dyQZMkotQ3wCQ3NgHAGE6P" \
    "sk-lf-qGtCCscIMnuP_jX8AC9-fQp5JmJRXqHhYIY2bl20E7E" \
    "${PREFIX}"
