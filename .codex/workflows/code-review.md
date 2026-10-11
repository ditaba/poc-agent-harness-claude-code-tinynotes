# Code review

When the user requests a review, inspect the relevant code and its callers.
If a scope is given (bugs, security, performance), focus on that scope;
otherwise review correctness, security, regressions and maintainability.
Trace behavior against SPEC.md and applicable project rules. Prefer actionable
findings with severity, file and line references, concrete trigger and impact.
Do not modify code during a review unless the user requests fixes.
