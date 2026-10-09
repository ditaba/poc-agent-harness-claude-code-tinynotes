# Yêu cầu → SPEC → Milestones → Tasks (prd.json)

Prompt mẫu cho từng bước, từ yêu cầu thô đến danh sách task (`prd.json`) cho Ralph loop.

| Step | Đầu vào        | Đầu ra                    | Chốt điều gì                                 |
| ---- | -------------- | ------------------------- | -------------------------------------------- |
| 1    | Yêu cầu thô    | `SPEC.md`                 | _Cái gì_ được làm                            |
| 2    | `SPEC.md`      | Mục Milestones trong SPEC | _Thứ tự_ làm                                 |
| 3    | SPEC + `CLAUDE.md` | `prd.json`            | Chia nhỏ để agent _tự làm và tự kiểm tra được_ |

**Nguyên tắc chung:**

- **Mỗi bước chạy trong một session mới** (`/clear`). File đầu ra của bước trước là thứ duy nhất được chuyển sang bước sau, giống cách Ralph hoạt động.
- **Duyệt bằng tay giữa các bước.** Lỗi ở SPEC sẽ nhân lên thành nhiều task sai ở `prd.json`.
- **Sau mỗi bước, chạy prompt review trong một session mới.** Session tạo ra file thường không tự thấy lỗi của chính nó.
- Thay phần `<...>` bằng nội dung của bạn.

---

## Step 1 — Yêu cầu → SPEC

Mục tiêu: để Claude **phỏng vấn bạn** thay vì tự đoán.

```text
I need to build: <paste the raw requirement / design brief>

Don't write any code yet. Interview me to turn this into SPEC.md.

How to interview:
- Use the AskUserQuestion tool. Ask in small batches (max 4 questions),
  each with your recommended default first, so I can just accept it.
- Cover: users and core flows, in scope / out of scope, key decisions and
  trade-offs, data model, routes/screens, error cases, security,
  tech stack with versions, testing strategy, constraints (deploy, deadline).
- Push back on anything vague or anything that adds complexity.
  Prefer the simplest solution.
- Stop when every in-scope feature has a clear, testable behavior.

Then write SPEC.md with these sections:
1. Overview
2. Scope: in scope / out of scope
3. Decisions table (D1, D2, ...)
4. Tech stack (exact pinned versions)
5. Routes / screens (with access rules)
6. Functional requirements, each with an ID (AUTH-1, NOTE-1, ...)
   and written as testable behavior: input → result, including exact UI copy
7. Error handling (error codes and what the user sees)
8. Data model (SQL)
9. Server/client design (module paths, function signatures)
10. Security
11. Testing: unit tests + manual acceptance checklist
12. Risks and mitigations
13. Open questions

Mark anything I didn't confirm as [ASSUMPTION].
```

### Review SPEC (session mới)

```text
Read SPEC.md as a senior engineer who must implement it without being able
to ask anyone. List, by section:
- Ambiguities (two engineers could build it differently)
- Contradictions between sections
- Missing error/edge cases
- Requirements that can't be tested
- Anything that adds complexity without a clear need
Don't edit the file. Give me the list, most serious first.
```

---

## Step 2 — SPEC → Milestones

Nên bật **plan mode** (`Shift + Tab`) để Claude trình bày kế hoạch cho bạn duyệt trước khi sửa file.

```text
Read SPEC.md. Plan the implementation as milestones (M0, M1, ...), one PR each.

Rules:
- M0 = setup + a throwaway spike that proves the riskiest technical
  assumption (see Risks) works end-to-end, before anything depends on it.
- Order by dependency: foundation (config, DB, schema, test utilities)
  → pure logic with tests → auth and server boundary → UI → polish.
- After the foundation, each milestone is a vertical slice a user can try.
- Each PR should be reviewable in under an hour.

For each milestone give:
- Scope: the spec sections and requirement IDs it covers
- Depends on
- "Done when": concrete checks (tests passing, items from the manual checklist)
- Main risk

Then show a coverage table: every in-scope requirement ID → exactly one
milestone. Flag any ID that isn't covered or appears twice.

Show me the plan first. After I approve, add it to SPEC.md as "Milestones".
```

---

## Step 3 — Milestones → Tasks (`prd.json`)

```text
Read SPEC.md (especially Milestones) and CLAUDE.md.
Create prd.json: a JSON array of tasks for an autonomous coding agent that
does ONE task per session, with a fresh context each time.

Task format:
{
  "id": "M3-autosave",
  "milestone": "M3",
  "description": "One line: what gets built",
  "spec": ["§9.4", "AS-1..AS-5"],
  "dependsOn": ["M1-db"],
  "acceptance": ["Observable behavior that can be checked", "..."],
  "verify": ["bun run test lib/autosave", "bun run lint"],
  "passes": false
}

Rules:
- One task = one session = one commit (about 1–5 files). Split anything bigger.
- Tests belong to the task that adds the code. Never create a separate
  "write tests" task.
- Acceptance criteria are behaviors (input → output / message / status)
  with their spec IDs, not implementation steps.
- Reference the spec instead of restating it. Use its exact names:
  routes, file paths, function names, error codes, UI copy.
- Nothing from Out of scope. No library that isn't in Tech stack.
- dependsOn only points to earlier tasks. The last task of each milestone
  runs that milestone's "Done when" checks.
- If code already exists: inspect it and set passes=true only when the
  acceptance criteria are met and the tests pass. List those tasks with
  the evidence (file, test name).

After writing, print:
1. A coverage table: requirement ID → task IDs
2. Any spec ambiguity you hit. Ask me instead of guessing.
```

### Review `prd.json` (session mới)

```text
Review prd.json against SPEC.md and CLAUDE.md. Report:
- Tasks too big for one session
- Acceptance criteria that can't be verified
- Anything out of scope, or names that differ from the spec
  (routes, columns, files, libraries)
- Requirement IDs with no task
- Wrong or missing dependsOn
Don't edit the file. List the issues, most serious first.
```

---

## Phụ lục — Viết acceptance criteria kiểm tra được

| ❌ Mơ hồ                               | ✅ Kiểm tra được                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| "Add client-side validation"           | "Wrong password shows 'Invalid email or password' (AUTH-2)"                                     |
| "Implement debounced auto-save (1-2s)" | "A burst of edits produces one save with the latest snapshot, 1 s after the last change (AS-1)" |
| "Test authorization is enforced"       | "Another user's note id calls `notFound()`, never 403 (NOTE-4)"                                 |
