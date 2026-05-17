#!/bin/bash
# send-prompts-simple.sh
# Sends 20 prompts to Pi in non-interactive mode.
# Pi will create/manage the session automatically.
# Traces will be identified by the 'TRACE-TEST-XX' string in the input.

PREFIX="TRACE-TEST"

echo "Sending 20 prompts to Pi (Non-interactive mode)..."
echo "Traces will contain: 'TRACE-TEST-01' through 'TRACE-TEST-20'"
echo "---------------------------------------------------"

for i in $(seq -w 1 20); do
    NUM=$(printf "%02d" $i)
    # The prompt includes the unique string for Langfuse tracing
    PROMPT="${PREFIX}-${NUM}: Calculate ${i} + ${i}"
    
    echo "[$NUM/20] Sending: ${PROMPT}"
    
    # Run Pi in non-interactive mode (process prompt and exit)
    # We redirect output to /dev/null to keep the terminal clean
    pi "${PROMPT}" > /dev/null 2>&1
    
    # Wait for the trace to be sent to Langfuse
    sleep 5
done

echo "---------------------------------------------------"
echo "✓ 20 Prompts sent."
echo "Waiting 15s for traces to settle in Langfuse..."
sleep 15

echo "Running validation script now..."
# Run the Node.js validation script
node /Users/jsantos/Documents/projects/pi-extensions/extensions/pi-langfuse/bug-fix/validate-traces.js \
    "http://192.168.45.2:3100" \
    "pk-lf-j9dyQZMkotQ3wCQ3NgHAGE6P" \
    "sk-lf-qGtCCscIMnuP_jX8AC9-fQp5JmJRXqHhYIY2bl20E7E" \
    "${PREFIX}"
