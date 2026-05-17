# Bug Fix: Fail-Open in before_provider_request (Empty Catch)

**Branch:** `bugfix/fail-open-provider-request`
**Date:** 2026-05-17
**Severity:** HIGH (Errors are swallowed silently)

---

## 1. How to Reproduce the Bug (Human-Friendly)

**File:** `src/index.ts`
**Lines:** ~1189 (Inside `pi.on("before_provider_request"...)`)

**The Bug:**
```typescript
try {
    // ... logic to capture payload ...
} catch (_e) {
    // ignore  <-- THE BUG IS HERE
}
```

**Why it's bad:**
If the payload is malformed or the `summarizeProviderPayload` function throws an error, the entire tracing for that request is lost. No error message is shown. Nothing is sent to Langfuse.

---

## 2. Step-by-Step Reproduction (Provoking the Error)

**Goal:** Make the `try` block fail to see if the error is truly ignored.

**Step 1 (Manual Test):**
We will modify the prompt to send a **malformed request** or trigger a condition where `summarizeProviderPayload` might fail (though it's hard to force from user side).

**Step 2 (The "Hack" way - More effective):**
Create a temporary "Poison" prompt that causes a JSON stringify error or a redaction error.
*   *Prompt:* Send a very large, circular JSON structure (if possible) or a prompt that breaks the `safeJson` function.

**Step 3 (Check Logs):**
1.  Open Pi terminal or check logs.
2.  If you see **NO Error** logged, the catch is swallowing it.
3.  **Expected (Fail-Close):** You should see an error in the console or a notification saying "Langfuse: Failed to capture request".

---

## 3. Check Existing Tests

**File:** `src/index.test.ts`

**Status:** ❌ **NO TEST COVERS THIS CATCH.**

**Analysis:**
The test file `index.test.ts` is huge (1200+ lines), but it likely mocks the event payloads to be "happy path". None of the tests likely force a `throw` inside the `before_provider_request` handler to verify the catch behavior.

---

## 4. Suggested Test Refactoring (Force the Error)

**Goal:** Ensure that if the capture fails, an error is logged (not ignored).

**Suggested Test (in `src/index.test.ts`):**
Create a mock for `summarizeProviderPayload` that throws an error.

```typescript
it("should log error if provider request capture fails", async () => {
    // Mock the summarizeProviderPayload to throw
    vi.mock('./some-module', () => ({
        summarizeProviderPayload: vi.fn(() => { throw new Error("Mocked Failure"); })
    }));

    const consoleWarnSpy = vi.spyOn(console, 'warn');
    
    // Trigger the event (simulate pi.on("before_provider_request"))
    // ... (requires complex setup of the extension context) ...
    
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Failed"));
});
```

*Note:* Testing Pi extensions is hard because of the `pi.on` context. This might require refactoring the logic inside `index.ts` into a separate function to be testable.

---

## 5. Code Review of Bug Location

**File:** `src/index.ts` (Lines ~1180-1195)

**Current Logic:**
The extension tries to be "robust" by ignoring errors. But in a tracing extension, **silence is the enemy**. If tracing fails, you *need* to know.

**The Issue:**
```typescript
} catch (_e) {
    // ignore
}
```
The variable `_e` (underscore) is a convention for "I don't care about this variable". Here, it means "I don't care about the error".

---

## 6. Suggested Refactoring Path

**Strategy:** Replace "ignore" with "visible error".

**Option A (Minimal Fix - Recommended):**
Log the error to the console so the user knows something went wrong.

**Old Code:**
```typescript
} catch (_e) {
    // ignore
}
```

**New Code:**
```typescript
} catch (e) {
    // Log the error so we don't lose traces silently
    console.error(
        "Langfuse: Failed to capture provider request.", 
        e instanceof Error ? e.message : String(e)
    );
}
```

**Option B (UI Notification):**
If Pi supports `ctx.ui.notify`, show a warning to the user.
```typescript
} catch (e) {
    ctx.ui.notify("Langfuse: Trace capture failed. Check console.");
}
```

---

## 7. Validation Strategy (Langfuse API)

**Goal:** Prove that errors are being swallowed.

**Step 1:** Add a temporary `throw new Error("Test")` at the start of the `before_provider_request` try block.
**Step 2:** Send a prompt in Pi.
**Step 3:** Check Langfuse:
*   **If NO trace appears** and **NO error in console**: Bug confirmed (Error Swallowed).
*   **If Error in console**: Fix is working (or at least not silencing).

**Step 4:** Remove the `throw` and apply the "Option A" fix.

---

## 8. Checklist for Acceptance (Human-Verified)

*   [ ] **Code Check:** Found the `// ignore` in `src/index.ts`.
*   [ ] **Provocation:** Forced an error inside the try block (temporarily).
*   [ ] **Observation:** Confirmed that NO error appeared in console (Bug confirmed).
*   [ ] **Fix Applied:** Changed `// ignore` to `console.error(...)`.
*   [ ] **Test Pass:** `npm test` passes.
*   [ ] **Build Pass:** `npm run build` succeeds.
*   [ ] **Commit:** Created commit in branch `bugfix/fail-open-provider-request`.
