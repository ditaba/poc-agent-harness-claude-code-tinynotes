# Tối ưu token cho Ralph loop

12/10/2026, cập nhật sau khi harness mới chạy xong toàn bộ 31 task · Tiếp nối bài "Vì sao Tinynotes tốn token hơn SalesIntel"

## Tóm tắt

- **Toàn dự án bằng harness mới:** 31/31 task pass, qua 32 vòng (một lần bị block vì Playwright MCP không kết nối được). Tổng cộng 502 lượt gọi API, 23,95 triệu token, **$19,73**, khoảng 2,7 giờ.
- **So với lần chạy cũ trên 22 task có phiên Claude để đối chiếu (M0-deps → M4-save, cộng M4-delete):**

  | | Cũ | Mới | Thay đổi |
  | --- | --- | --- | --- |
  | Token | 67,49 triệu | 15,94 triệu | **−76%** |
  | Chi phí | $38,07 | $13,03 | **−66%** |
  | Lượt gọi API | 610 | 343 | −44% |
  | Thời gian | 107 phút | 69 phút | −36% |

  Nếu tính cả các lần thử hỏng của lần chạy cũ thì mức giảm là −78% token và −68% chi phí ($41,31 → $13,03).
- **Lợi ích tăng dần theo milestone.** Chi phí giảm 47% ở M0, 48% ở M1, 55% ở M2, 67% ở M3 và 77% ở M4. Ngữ cảnh lượt đầu của harness mới đứng yên ở 32–35 nghìn token, trong khi của harness cũ tăng từ 51 lên 77 nghìn theo độ dài của progress.
- **Ở M3–M4, agent làm ít bước mò mẫm hơn hẳn.** Lượt gọi giảm từ 421 xuống 172. Lượt gọi Playwright giảm từ 183 xuống 35, và token suy nghĩ giảm từ 36% xuống 13% output.
- **Mục `## Codebase patterns` phát huy tác dụng.** Kiến thức chỉ cần ghi một lần, mọi vòng sau đều được nhận lại. Ví dụ rõ nhất: ở M3-sign-up, agent tự rút ra cách chạy cả flow checklist trong một lệnh `browser_run_code` và ghi lại; về sau 71/72 lượt gọi Playwright đều là run-code.
- **Cờ `--disallowedTools Artifact`:** bớt 11,4 nghìn token ở mỗi lượt gọi. Lần chạy cũ chưa có tool này, nên các con số so sánh ở trên **chưa tính** khoản tiết kiệm đó.
- Mỗi vòng Claude tự ghi token và chi phí vào `.ralph/usage.csv`.

## Vấn đề

Ralph loop mở một phiên `claude -p` mới cho mỗi task. Token chủ yếu là **lượng ngữ cảnh × số lượt gọi API**, vì mỗi lần gọi tool là toàn bộ hội thoại được gửi lại. Các nguồn tốn kém tìm thấy ở lần chạy cũ:

- **Đọc file bắt buộc.** Prompt cũ (`@prd.json @agent-progress.txt @SPEC.md @CLAUDE.md`) gắn sẵn `prd.json` (41 KB), `agent-progress.txt` (tăng dần tới 57 KB) và một bản CLAUDE.md thừa (7,7 KB) vào lượt đầu. SPEC.md (70 KB) quá lớn nên không được gắn, và agent tự đọc từng phần. Phần gắn sẵn này nằm trong **mọi** lượt gọi và chiếm **28,4% tổng token**.
- **Tool `Artifact`.** Claude Code bản hiện tại tự thêm tool này vào mọi phiên, khoảng 11 nghìn token.
- **Không đo được.** Lần chạy cũ không ghi lại token, model hay effort của từng vòng.
- **Tốn phiên vô ích.** Vòng cuối tốn cả một phiên chỉ để agent đọc `prd.json` rồi in `<complete>`.

## Những gì đã thay đổi

| File | Thay đổi | Lý do |
| --- | --- | --- |
| `ralph.ts` (mới) | `next`: chọn task hợp lệ đầu tiên theo thứ tự trong `prd.json`. `context <id>`: JSON của task, mục lục SPEC kèm khoảng dòng, các dòng SPEC ứng với ID mà task nêu (D/R/AUTH/NOTE…, khai triển cả dải `NOTE-7..NOTE-11`), khối milestone, mục `## Codebase patterns` và các entry progress của task cùng những task nó phụ thuộc. `result`: ghi `.ralph/usage.csv`. | Agent không phải đọc trọn file nào. Ngữ cảnh lượt đầu giữ ở mức 32–35 nghìn token suốt dự án. |
| `ralph.sh` | Chọn task **trước** khi mở phiên, nên khi mọi task đã xong (thoát 0) hoặc đều bị block (thoát 2) thì không tốn phiên nào. Prompt đặt phần tĩnh trước, phần task cuối (để cache dùng lại được). Chạy check với output rút gọn mà vẫn giữ exit code. Entry progress tối đa 15 dòng, và kiến thức dùng lại được ghi vào Codebase patterns. Chỉ tra docs khi không chắc. | Giảm ngữ cảnh, giữ được cache qua các vòng, và tích luỹ kiến thức. |
| `ralph.sh` (cờ cho Claude) | `--output-format json`, `--exclude-dynamic-system-prompt-sections`, `--effort` (trường `effort` của task → `RALPH_EFFORT` → `medium`), `--disallowedTools Artifact`, và `--model "$RALPH_MODEL"` nếu biến này được đặt. | Đo được token, cache tốt hơn, bỏ tool không dùng, chọn effort vừa đủ. |
| `.claude/settings.json` | Hook PostToolUse chỉ chạy Prettier trên **file vừa sửa** (thay cho `prettier --write .` cả repo), và chỉ chạy khi đã có `.prettierignore`. | Không định dạng lại file người dùng đang sửa dở, và không động tới `.md` trước M0. |
| `agent-progress.txt` (mới) | Tiêu đề cộng mục `## Codebase patterns`. | `ralph.sh` cần file này. Mục patterns được đưa vào mọi vòng. |
| `CLAUDE.md`, `.codex/rules/project.md`, `AGENTS.md`, `RALPH.md` | Mô tả cơ chế mới. Docs chỉ tra khi không chắc hoặc khi check lỗi, và kết quả ghi vào Codebase patterns. `RALPH.md` có thêm cờ CLI, biến môi trường và cách theo dõi. | Giữ tài liệu khớp với hành vi. |

Nhánh Codex dùng prompt mới nhưng không ghi `usage.csv`.

## Kết quả đo

Giá Opus 5.5 dùng để quy đổi: input $4/MTok, output $20/MTok, đọc cache $0,20/MTok, ghi cache TTL 1 giờ $8/MTok (2×). `total_cost_usd` trong output của Claude Code tính theo đúng bảng giá này.

### 1. Ước tính trước khi chạy

Đây là ước tính làm trên log cũ, trước khi có lần chạy mới. Dữ liệu là 26 phiên Claude ngày 10–11/10, gồm 664 lượt gọi, 71,5 triệu token, $41,31. Mình giả định agent vẫn làm y như cũ, chỉ bỏ phần đọc bắt buộc và thay bằng ngữ cảnh do `ralph.ts` tạo (dựng lại từ `prd.json` và `agent-progress.txt` ở commit ngay trước mỗi phiên). Tỉ lệ 0,447 token/ký tự được hồi quy từ 25 phiên.

| Hạng mục | Token | Chi phí |
| --- | --- | --- |
| Phần đọc bắt buộc trong ngữ cảnh (cũ) | 28,4% | 24,9% |
| Ngữ cảnh do `ralph.ts` đưa vào (mới) | 4,4% | 3,8% |
| **Dự đoán tiết kiệm nhờ cắt ngữ cảnh** | **24,0%** | **21,0%** |

Thực tế đo được (mục 2) là **−76% token, −66% chi phí**, gấp khoảng 3 lần dự đoán. Phần dự đoán chỉ tính việc bỏ phần đọc bắt buộc. Nó không tính được việc agent làm ít bước hơn khi ngữ cảnh gọn và khi có sẵn kiến thức từ các vòng trước.

### 2. Chạy thật toàn bộ dự án

Harness mới chạy ngày 12/10 (commit `d514127`…`0fd1796`), effort `medium`, không có tool Artifact. Mỗi task được so với phiên Claude cũ đã hoàn thành chính task đó.

**Theo milestone:**

| Milestone | Lượt gọi | Token | Chi phí |
| --- | --- | --- | --- |
| M0 (5 task) | 90 → 77 | −54% | $4,92 → $2,61 (−47%) |
| M1 (3 task) | 39 → 39 | −45% | $2,74 → $1,42 (−48%) |
| M2 (4 task) | 60 → 55 | −55% | $5,02 → $2,27 (−55%) |
| M3 (5 task) | 136 → 76 | −75% | $8,89 → $2,96 (−67%) |
| M4 (5 task¹) | 285 → 96 | −87% | $16,50 → $3,78 (−77%) |
| **22 task** | **610 → 343 (−44%)** | **67,49M → 15,94M (−76%)** | **$38,07 → $13,03 (−66%)** |

¹ M4-lib, M4-notes-list, M4-editor-page, M4-save và M4-delete. Lần chạy cũ làm M4-save-errors bằng Codex.

**Theo task:**

| Task | Lượt gọi | Ngữ cảnh lượt đầu | Ngữ cảnh TB / lượt | Token | Chi phí |
| --- | --- | --- | --- | --- | --- |
| M0-deps | 21 → 14 | 50,9k → 32,0k | 71,8k → 39,8k | 1,52M → 0,56M | $1,06 → $0,51 |
| M0-env | 13 → 14 | 54,3k → 32,1k | 65,6k → 36,7k | 0,86M → 0,52M | $0,79 → $0,41 |
| M0-spike-sqlite² | 18 → 16 | 54,6k → 32,9k | 71,9k → 38,7k | 1,30M → 0,63M | $0,96 → $0,51 |
| M0-spike-auth | 29 → 22 | 55,3k → 33,9k | 88,6k → 46,1k | 2,58M → 1,02M | $1,46 → $0,74 |
| M0-close | 9 → 11 | 56,5k → 33,8k | 64,8k → 38,9k | 0,59M → 0,43M | $0,64 → $0,42 |
| M1-env | 9 → 11 | 57,9k → 32,4k | 66,3k → 37,5k | 0,60M → 0,42M | $0,67 → $0,37 |
| M1-migrate | 16 → 14 | 57,0k → 32,6k | 76,4k → 42,9k | 1,24M → 0,61M | $1,06 → $0,54 |
| M1-db-cli | 14 → 14 | 58,3k → 33,4k | 80,0k → 42,8k | 1,13M → 0,61M | $1,01 → $0,51 |
| M2-share-token | 10 → 11 | 61,7k → 32,5k | 72,7k → 39,0k | 0,74M → 0,43M | $0,84 → $0,41 |
| M2-validation | 19 → 18 | 59,4k → 33,1k | 97,2k → 49,7k | 1,87M → 0,91M | $1,59 → $0,84 |
| M2-render | 18 → 12 | 60,8k → 32,4k | 86,8k → 39,5k | 1,58M → 0,48M | $1,26 → $0,45 |
| M2-repo | 13 → 14 | 62,6k → 33,3k | 92,5k → 44,7k | 1,22M → 0,63M | $1,33 → $0,58 |
| M3-auth-server | 22 → 11 | 63,9k → 33,4k | 94,3k → 40,9k | 2,09M → 0,45M | $1,40 → $0,41 |
| M3-auth-errors | 30 → 15 | 65,1k → 32,9k | 93,5k → 39,9k | 2,83M → 0,61M | $1,95 → $0,49 |
| M3-sign-up | 24 → 19 | 66,8k → 34,5k | 119,9k → 51,8k | 2,90M → 1,00M | $2,03 → $0,80 |
| M3-sign-in | 29 → 14 | 68,7k → 33,8k | 92,2k → 44,8k | 2,69M → 0,63M | $1,52 → $0,56 |
| M3-notes-shell | 31 → 17 | 70,1k → 33,8k | 115,6k → 50,3k | 3,60M → 0,86M | $1,98 → $0,69 |
| M4-lib | 17 → 10 | 72,0k → 33,5k | 94,6k → 40,0k | 1,63M → 0,40M | $1,40 → $0,39 |
| M4-notes-list | 92 → 35 | 73,3k → 33,8k | 152,3k → 58,8k | 14,05M → 2,07M | $4,99 → $1,14 |
| M4-editor-page | 54 → 18 | 75,3k → 34,1k | 147,1k → 51,0k | 7,98M → 0,93M | $3,61 → $0,74 |
| M4-save | 37 → 13 | 77,4k → 34,7k | 137,4k → 51,0k | 5,12M → 0,67M | $2,79 → $0,68 |
| M4-delete³ | 85 → 20 | 28,9k → 34,6k | 109,7k → 52,2k | 9,37M → 1,06M | $3,71 → $0,83 |

² So với lần chạy lại của phiên cũ. Lần chạy đầu bị block tốn thêm $1,79.
³ Phiên cũ dùng prompt "Read from disk", không gắn file, nên ngữ cảnh lượt đầu nhỏ hơn.

**9 task trước đây chạy bằng Codex** (M4-save-errors, M5–M7) không có log Claude để so. Ở lần chạy mới, các task này tốn 10 vòng (tính cả lần M4-save-errors bị block, $0,40), 159 lượt gọi, 8,02 triệu token và $6,69. M7-checklist-15-24 kéo dài 58 phút dù chỉ có 22 lượt gọi, nên thời gian chủ yếu là chờ chứ không phải token.

### 3. Vì sao giảm nhiều hơn dự đoán

- **Ngữ cảnh lượt đầu không phình theo dự án.** Harness mới giữ ở 32,0–35,2 nghìn token. Mức tăng nhẹ đó đến từ mục Codebase patterns, cuối dự án là 26 dòng, khoảng 6 KB. Harness cũ thì tăng từ 50,9 lên 77,4 nghìn token, vì progress được gắn nguyên vào prompt. Ở cuối dự án, progress chỉ còn 36 KB (32 entry, trung bình 6,7 dòng), so với 104 KB ở lần chạy cũ.
- **Phiên ngắn hơn ở các task UI.** Ở 4 task UI của M4 (notes-list, editor-page, save, delete), phiên cũ kéo dài 37–92 lượt gọi với ngữ cảnh trung bình 110–152 nghìn token. Phiên mới chỉ 13–35 lượt gọi, ngữ cảnh trung bình 51–59 nghìn.
- **Kiến thức được dùng lại qua Codebase patterns.** Ví dụ: cách chạy cả flow Playwright trong một lệnh run-code, cách chọn selector trong `main`, mở tab mới khi tab bị treo sau HMR, mô phỏng lỗi mạng, giả lập người dùng thứ hai. Với 22 task, lượt gọi Playwright giảm từ 183 xuống 35, và output Playwright từ 215 nghìn xuống 62 nghìn ký tự.
- **Ít token suy nghĩ hơn.** Tỉ lệ giảm từ 36% xuống 13% output; từ M2 trở đi thường chỉ 3–15%. Nguyên nhân có thể là effort `medium`, cộng với việc task đã rõ ràng hơn khi ngữ cảnh gọn và có sẵn kiến thức.

### 4. Yếu tố nhiễu

- **SPEC trên nhánh này đã chứa những gì lần chạy cũ học được:** Bun 1.3.14, R1/R2/R10 đã kiểm chứng, lệnh CLI của better-auth, và bảng mã lỗi auth của §7 (vốn tìm ra ở M3-auth-errors của lần chạy cũ). Điều này giúp nhiều nhất cho các spike ở M0 và cho M3-auth-errors. Các task khác vẫn giảm 34–80% chi phí. Task ngắn như M0-close giảm ít nhất, vì phần ngữ cảnh cố định chiếm tỉ trọng lớn.
- **Lần chạy cũ không ghi lại effort.** Chưa tách riêng được tác động của `medium`.
- **Môi trường khác nhau.** Hai lần chạy dùng phiên bản CLI và tập tool khác nhau. Cả hai đều không có tool Artifact.
- **Kết quả kiểm tra tương đương.** Cả hai lần đều qua toàn bộ checklist §11 và audit §10. Lần chạy mới không phải đổi chất lượng lấy token.

### 5. Cờ `--disallowedTools Artifact`

Thử bằng hai lệnh `claude -p` một lượt trong một thư mục trống:

| | Ngữ cảnh |
| --- | --- |
| Không có cờ | 37.342 token |
| Có cờ | 25.942 token (−11.400) |

Với 502 lượt gọi của lần chạy mới, nếu không có cờ này thì lần chạy sẽ tốn thêm khoảng 5,7 triệu token, tức thêm khoảng 24% so với 23,95 triệu. Phần định nghĩa tool chủ yếu được tính theo giá đọc cache, nên tính ra chi phí chỉ khoảng $1–3.

## Cách đo lại

```bash
column -s, -t < .ralph/usage.csv   # token và chi phí của từng vòng Claude
bun ralph.ts next                  # task mà vòng tiếp theo sẽ làm
bun ralph.ts context M4-save       # ngữ cảnh prompt của task đó
npx ccusage@latest session         # tổng hợp theo phiên từ log của Claude Code
```

- Log phiên nằm ở `~/.claude/projects/<thư mục repo>/<session>.jsonl`. Usage của mỗi lượt gọi nằm trong `message.usage`. Cần gộp theo `message.id` vì một message được ghi thành nhiều dòng. File gắn bằng `@` nằm trong các dòng `attachment` có `type: "file"`.
- Các script phân tích (`survey.ts`, `compare.ts`, `analyze.ts`, `compare10.ts`, `compareAll.ts`) nằm trong scratchpad của phiên Claude và sẽ bị xoá cùng phiên. Muốn dùng lại thì yêu cầu lưu chúng vào repo.
- Phiên cũ được ghép với từng task (theo 8 ký tự đầu của id phiên):
  - M0-deps `9582f68b`, M0-env `ac797496`, M0-spike-sqlite `982b1466` (lần bị block: `77262905`), M0-spike-auth `e271edac`, M0-close `a9424200`
  - M1-env `249d41ff`, M1-migrate `89a7d618`, M1-db-cli `b231b13d`
  - M2-share-token `3c0f927a`, M2-validation `8559827c`, M2-render `f9d6bbd5`, M2-repo `42ed7ca0`
  - M3-auth-server `fadfa7d0`, M3-auth-errors `c8c552d3`, M3-sign-up `9422995b`, M3-sign-in `0148203d`, M3-notes-shell `964b63ec`
  - M4-lib `c5a6b0ff`, M4-notes-list `d1f0764b`, M4-editor-page `c83f470f`, M4-save `359f644e`, M4-delete `c358c397`
  - Các lần thử hỏng: `366cfcaf`, `e747f9fc`, `212d8bce`
- Phiên mới được nhận ra nhờ prompt bắt đầu bằng `Follow CLAUDE.md for project rules.`, với task ghi ở dòng `## Task: <id>`.
- Muốn so sánh công bằng thì chạy trên một nhánh đã reset `passes`, và ghi lại effort cùng model của cả hai bên.

## Sự cố và bài học

- **Lỡ chạy claude thật khi test.** Bài test dùng một `claude` giả, nhưng PATH được đặt bằng `C:/...`, và Git Bash tách PATH ở dấu `:` sau `C`, nên lệnh gọi phải claude thật. Kết quả là 3 vòng chạy với `--dangerously-skip-permissions` trong repo tạm, tốn khoảng $2. Repo thật không bị ảnh hưởng. Trong Git Bash, đặt PATH bằng `$(cygpath -u …)`.
- **Biến `CLAUDE_EFFORT=xhigh`** đã có sẵn trong môi trường, và đè lên mặc định `medium`. Vì vậy biến của loop dùng tiền tố `RALPH_` (`RALPH_EFFORT`, `RALPH_MODEL`).
- **Hook Prettier định dạng cả `.md`** khi `node_modules` còn sót Prettier mà chưa có `.prettierignore`. Lần đó chỉ đổi CRLF thành LF. Đã thêm điều kiện yêu cầu có `.prettierignore`.
- **Ước tính Playwright ban đầu sai hướng.** Mình ước tính quy tắc "gộp bằng run-code" trong prompt chỉ tiết kiệm khoảng 0%, nên đã gỡ quy tắc đó. Thực tế lượt gọi Playwright vẫn giảm 81%, vì agent tự học cách này rồi ghi vào Codebase patterns. Bài học: ước tính trên log cũ chỉ cho cận dưới. Những thay đổi giúp agent làm ít bước hơn chỉ đo được bằng lần chạy thật.
- **Playwright MCP đôi khi không kết nối được** (`CONNECT_TIMEOUT 30000ms`), làm M4-save-errors bị block một lần. Quy tắc block đã hoạt động đúng: agent dừng lại chứ không bỏ qua bước kiểm tra.

## Việc còn mở

- **Giới hạn mục Codebase patterns.** Mục này đang 6 KB và được đưa vào mọi vòng. Nếu dự án dài hơn, nên gom nhóm lại hoặc chỉ đưa các dòng liên quan đến task.
- **Chạy A/B vài task với `RALPH_EFFORT=high`** để tách riêng tác động của effort khỏi tác động của ngữ cảnh.
- **Effort cho task rủi ro.** Effort `medium` đã đủ cho cả 31 task, kể cả spike và auth. Chỉ cần đặt `"effort": "high"` cho task nào thực sự gặp vấn đề chất lượng.
- **Gộp các task nhỏ** khi tạo lại `prd.json` (ví dụ M7-readme-cleanup chỉ tốn $0,31 và 6 lượt gọi), vì mỗi phiên tốn khoảng 32 nghìn token ngữ cảnh cố định ở mọi lượt gọi.
- **Tìm hiểu vì sao M7-checklist-15-24 mất 58 phút.** Có thể do chờ server hoặc timeout của Playwright.
- Đo xem plugin `typescript-lsp` đáng giữ hay không, dựa trên `usage.csv`.
- Ghi usage cho nhánh Codex.
