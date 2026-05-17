# Bug Fix: Sensitive Logs (Console Leaks)

**Branch:** `bugfix/sensitive-logs`
**Date:** 2026-05-17
**Severity:** LOW (Depends on error content)

---

## 1. How to Reproduce the Bug (Log Interception)

**File:** `src/index.ts`
**Lines:** Various `catch` blocks (e.g., line ~180, ~250).

**The Bug:**
```typescript
} catch (e) {
    console.warn("📊 Langfuse: Failed to capture...", e);
}
```
If `e` is an object containing `body` or `payload` with API keys or secrets, they might be printed to the Pi console.

---

## 2. Step-by-Step Reproduction (Intercept Console)

**Step 1:** Create `bug-fix/check-logs.js`.
**Step 2:** Override `console.warn` to capture messages.
**Step 3:** Simulate an error object that contains a "secret" pattern (e.g., `sk-lf-...`).
**Step 4:** Check if the overridden `console.warn` received the secret.

**Step 3 (Manual Test):**
1.  Temporarily add a `throw new Error("Secret: sk-lf-12345")` inside `before_provider_request`.
2.  Run Pi and send a prompt.
3.  Check Pi's Developer Console or terminal output.
4.  **If you see `sk-lf-12345`**: Bug confirmed (Logs are not redacted).

---

## 3. Check Existing Tests

**File:** `src/redaction.test.ts`

**Status:** ✅ Tests exist for `redactString`, but ❌ **NO TEST** ensures `console.warn` uses redaction.

---

## 4. Validation Script (check-logs.js)

**File:** `bug-fix/check-logs.js`

```javascript
// check-logs.js
// Intercepts console.warn to see if secrets are leaked.

const originalWarn = console.warn;
let leaked = false;

console.warn = (...args) => {
    const str = args.join(' ');
    if (str.includes('sk-lf-') || str.includes('pk-lf-')) {
        leaked = true;
        console.log("❌ LEAK DETECTED:", str);
    }
    originalWarn(...args);
};

// Simulate an error being caught
const mockError = {
    message: "Test",
    body: { secret: "sk-lf-fake-key-for-test" }
};

// This simulates what index.ts does
try {
    throw mockError;
} catch (e) {
    // The current code just does console.warn("...", e);
    // If we do that here, our overridden warn will catch it.
    console.warn("Test Log:", e);
}

if (leaked) {
    console.error("❌ BUG CONFIRMED: Secrets logged to console.");
    process.exit(1);
} else {
    console.log("✅ No obvious leaks in this simulation.");
}

// Restore
console.warn = originalWarn;
```

**How to run:**
```bash
cd /Users/jsantos/Documents/projects/pi-extensions/extensions/pi-langfuse
node bug-fix/check-logs.js
```

---

## 5. Suggested Refactoring Path

**Strategy:** Apply `redactString` (from `redaction.ts`) to error logs.

**Old Code:**
```typescript
} catch (e) {
    console.warn("Langfuse: Error", e);
}
```

**New Code:**
```typescript
} catch (e) {
    const config = resolveConfig(settings); // Need config here
    const safeError = redactString(config, String(e) + JSON.stringify(e));
    console.warn("Langfuse: Error", safeError);
}
```

*Note:* This requires passing `config` to the catch block, which might be complex.

---

## 6. Checklist for Acceptance

*   [ ] **Script Run:** `node bug-fix/check-logs.js`.
*   [ ] **Manual Test:** Forced an error with a fake key in `index.ts`.
*   [ ] **Observation:** Checked Pi terminal for un-redacted keys.
*   [ ] **Fix Applied:** Ensured `redactString` is used in `catch` blocks.
*   [ ] **Commit:** `bugfix/sensitive-logs`.
