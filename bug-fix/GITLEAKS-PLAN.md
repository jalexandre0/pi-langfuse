# Gitleaks Implementation Plan for pi-langfuse

**Date:** 2026-05-17
**Goal:** Prevent credential leaks (AWS, Generic API Keys, JWT, Private Keys) in commits.

---

## 1. Install Gitleaks
```bash
# macOS
brew install gitleaks

# Or Download binary
# https://github.com/gitleaks/gitleaks/releases
```

## 2. Create Gitleaks Config (`.gitleaks.toml`)
Create a config file at the root of `pi-langfuse` to customize rules.

```toml
# .gitleaks.toml
title = "pi-langfuse gitleaks config"

[whitelist]
description = "Whitelisted files or paths"
files = [
    ".*\\.example$",
    ".*\\.test\\.ts$",
    ".*\\.test\\.js$",
    "^bug-fix/",
    "^\\.env\\.test$",
]

[rules.langfuse-pk]
description = "Langfuse Public Key"
regex = ''pk-lf-[a-zA-Z0-9_-]{20,}'''
entropy = 3.5
keywords = ["pk-lf-"]

[rules.langfuse-sk]
description = "Langfuse Secret Key"
regex = ''sk-lf-[a-zA-Z0-9_-]{20,}'''
entropy = 3.5
keywords = ["sk-lf-"]
```

## 3. Create Baseline (First Scan)
Since the repo already has commits with test keys or examples, create a baseline to ignore them.

```bash
cd /Users/jsantos/Documents/projects/pi-extensions/extensions/pi-langfuse

# Scan entire history and create baseline
gitleaks protect --report-format json --report-path gitleaks-report.json

# This generates fingerprints for existing leaks.
# Then we create the baseline file:
gitleaks baseline .gitleaksbaseline.toml
```

## 4. Create `.gitleaksignore`
Use the baseline created above.

```bash
# .gitleaksignore
# This file ignores findings from the baseline
--gitleaks-baseline .gitleaksbaseline.toml
```

*Actually, `.gitleaksignore` just needs the fingerprint lines from the report.*

## 5. Pre-Commit Hook (Optional)
To block commits with leaks:

```bash
# Install pre-commit
pip install pre-commit

# Create .pre-commit-config.yaml
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.24.2
    hooks:
      - id: gitleaks
EOF

# Install hook
pre-commit install
```

## 6. Run and Verify
```bash
cd /Users/jsantos/Documents/projects/pi-extensions/extensions/pi-langfuse

# Scan current state
gitleaks protect -v --redact

# If leaks found, add them to baseline or fix them
```

---

## Files to Commit:
1. `.gitleaks.toml` (Config)
2. `.gitleaksbaseline.toml` (Baseline for existing leaks)
3. `.gitleaksignore` (Ignore file - optional if using baseline)
4. `.pre-commit-config.yaml` (If using pre-commit)

## Success Criteria:
- `gitleaks protect` passes on new commits.
- Existing leaks are in baseline (not blocking).
- `.env.test` (with real keys) is ignored by whitelist.
