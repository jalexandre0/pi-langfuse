#!/usr/bin/env python3
import json
import urllib.request
import urllib.parse
import base64
import sys

BASE_URL = "http://192.168.45.2:3100"
AUTH_STRING = "pk-lf-j9dyQZMkotQ3wCQ3NgHAGE6P:sk-lf-qGtCCscIMnuP_jX8AC9-fQp5JmJRXqHhYIY2bl20E7E"
AUTH_HEADER = "Basic " + base64.b64encode(AUTH_STRING.encode()).decode()

# Control Session (Default if no args)
CONTROL_SESSION = "2026-05-17T22-21-41-723Z_019e3807-e3da-7cbd-9e5f-29feac7893de"

def api_call(path, params=None):
    url = f"{BASE_URL}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    
    req = urllib.request.Request(url)
    req.add_header("Authorization", AUTH_HEADER)
    
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"Error calling {path}: {e}")
        return {}

def validate_session(session_id):
    print(f"\n{'='*60}")
    print(f"Validating Session: {session_id[:30]}...")
    print(f"{'='*60}")

    # 1. Get Traces for Session
    traces_resp = api_call("/api/public/traces", {"sessionId": session_id, "limit": 50})
    traces = traces_resp.get("data", [])
    
    if not traces:
        print(f"❌ No traces found for session.")
        return False

    print(f"Found {len(traces)} traces.")

    # 2. Prepare targets (TRACE-TEST-XX)
    targets = [f"TRACE-TEST-{str(i).zfill(2)}" for i in range(1, 21)]
    found_map = {t: False for t in targets}

    # 3. Check Observations for each trace
    for trace in traces:
        trace_id = trace["id"]
        obs_resp = api_call(f"/api/public/observations", {"traceId": trace_id})
        
        for obs in obs_resp.get("data", []):
            inp = obs.get("input")
            if inp:
                if isinstance(inp, list):
                    inp_str = json.dumps(inp)
                else:
                    inp_str = str(inp)
                
                for target in targets:
                    if target in inp_str and not found_map[target]:
                        found_map[target] = True

    # 4. Results
    found_count = sum(1 for v in found_map.values() if v)
    missing = [t for t, v in found_map.items() if not v]

    print(f"\nResult: {found_count}/20 TRACE-TEST prompts found.")
    if missing:
        print(f"Missing: {', '.join(missing)}")
        return False
    else:
        print("✅ SUCCESS: All 20 TRACE-TEST prompts arrived!")
        return True

if __name__ == "__main__":
    sessions = sys.argv[1:]
    
    if not sessions:
        print("No sessions provided. Using CONTROL session as default.")
        sessions = [CONTROL_SESSION]
    
    results = {}
    for session in sessions:
        # Clean session ID if copied with prefix
        session_id = session.strip()
        results[session_id] = validate_session(session_id)
    
    # Summary
    print(f"\n{'='*60}")
    print("FINAL SUMMARY")
    print(f"{'='*60}")
    for sid, ok in results.items():
        status = "✅ PASS" if ok else "❌ FAIL"
        print(f"{status} - {sid[:30]}...")
    
    # Exit code
    sys.exit(0 if all(results.values()) else 1)
