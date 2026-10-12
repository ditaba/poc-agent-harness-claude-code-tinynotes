# Tối ưu token cho Ralph loop

12/10/2026, cập nhật sau 10 task chạy thật · Tiếp nối bài "Vì sao Tinynotes tốn token hơn SalesIntel"

## Tóm tắt

- **Đo thật trên 10 task (M0-deps → M2-validation):** so với các phiên cũ của đúng những task đó, harness mới tốn **ít hơn 51% token và 48% chi phí** ($10,09 → $5,27). Nếu tính cả lần bị block của M0-spike-sqlite ở lần chạy cũ thì mức giảm là −61% token và −56% chi phí. Số lượt gọi chỉ giảm 8% và thời gian gần như không đổi. Phần tiết kiệm đến từ việc **ngữ cảnh mỗi lượt gọi nhỏ đi gần một nửa** (xem [Chạy thật](#2-chạy-thật-10-task)).
- **Ước tính trên toàn bộ log cũ (26 phiên Claude):** riêng việc cắt ngữ cảnh giảm **24% token, 21% chi phí**. Với 10 task trên, mô hình này dự đoán khoảng 24% chi phí, tức khoảng một nửa mức đo được. Nửa còn lại đến từ việc mỗi phiên tích luỹ ít ngữ cảnh hơn và ít token suy nghĩ hơn.
- **Cờ `--disallowedTools Artifact`:** bớt **11,4 nghìn token ở mỗi lượt gọi API**, ước tính thêm 9–10% token, tức 3–5% chi phí.
- **Gộp Playwright bằng run-code:** gần như **0%**, vì phiên cũ vốn đã làm vậy. Thay đổi này đã được gỡ.
- Từ nay mỗi vòng Claude tự ghi token và chi phí vào `.ralph/usage.csv`.

## Vấn đề

Ralph loop mở một phiên `claude -p` mới cho mỗi task. Token chủ yếu là **lượng ngữ cảnh × số lượt gọi API**, vì mỗi lần gọi tool là toàn bộ hội thoại được gửi lại. Các nguồn tốn kém tìm thấy:

- **Đọc file bắt buộc.** Prompt cũ (`@prd.json @agent-progress.txt @SPEC.md @CLAUDE.md`) gắn sẵn `prd.json` (41 KB), `agent-progress.txt` (tăng dần tới 57 KB) và một bản CLAUDE.md thừa (7,7 KB) vào lượt đầu. SPEC.md (70 KB) quá lớn nên không được gắn, và agent tự đọc từng phần. Phần gắn sẵn này nằm trong **mọi** lượt gọi và chiếm **28,4% tổng token**.
- **Tool `Artifact`.** Claude Code bản hiện tại tự thêm tool này vào mọi phiên, khoảng 11 nghìn token. Lần chạy ngày 10/10 chưa có tool này.
- **Không đo được.** Lần chạy cũ không ghi lại token, model hay effort của từng vòng.
- **Tốn phiên vô ích.** Vòng cuối tốn cả một phiên chỉ để agent đọc `prd.json` rồi in `<complete>`.

## Những gì đã thay đổi

| File | Thay đổi | Lý do |
| --- | --- | --- |
| `ralph.ts` (mới) | `next`: chọn task hợp lệ đầu tiên theo thứ tự trong `prd.json`. `context <id>`: JSON của task, mục lục SPEC kèm khoảng dòng, các dòng SPEC ứng với ID mà task nêu (D/R/AUTH/NOTE…, khai triển cả dải `NOTE-7..NOTE-11`), khối milestone, mục `## Codebase patterns` và các entry progress của task cùng những task nó phụ thuộc. `result`: ghi `.ralph/usage.csv`. | Agent không phải đọc trọn file nào. Ngữ cảnh của M4-save còn 17 KB. |
| `ralph.sh` | Chọn task **trước** khi mở phiên, nên khi mọi task đã xong (thoát 0) hoặc đều bị block (thoát 2) thì không tốn phiên nào. Prompt đặt phần tĩnh trước, phần task cuối (để cache dùng lại được). Chạy check với output rút gọn mà vẫn giữ exit code. Entry progress tối đa 15 dòng. Chỉ tra docs khi không chắc. | Giảm ngữ cảnh và giữ được cache qua các vòng. |
| `ralph.sh` (cờ cho Claude) | `--output-format json`, `--exclude-dynamic-system-prompt-sections`, `--effort` (trường `effort` của task → `RALPH_EFFORT` → `medium`), `--disallowedTools Artifact`, và `--model "$RALPH_MODEL"` nếu biến này được đặt. | Đo được token, cache tốt hơn, bỏ tool không dùng, chọn effort vừa đủ. |
| `.claude/settings.json` | Hook PostToolUse chỉ chạy Prettier trên **file vừa sửa** (thay cho `prettier --write .` cả repo), và chỉ chạy khi đã có `.prettierignore`. | Không định dạng lại file người dùng đang sửa dở, và không động tới `.md` trước M0. |
| `agent-progress.txt` (mới) | Tiêu đề cộng mục `## Codebase patterns`. | `ralph.sh` cần file này. Mục patterns được đưa vào mọi vòng. |
| `CLAUDE.md`, `.codex/rules/project.md`, `AGENTS.md`, `RALPH.md` | Mô tả cơ chế mới. Docs chỉ tra khi không chắc hoặc khi check lỗi, và kết quả ghi vào Codebase patterns. `RALPH.md` có thêm cờ CLI, biến môi trường và cách theo dõi. | Giữ tài liệu khớp với hành vi. |

Nhánh Codex dùng prompt mới nhưng không ghi `usage.csv`.

## Kết quả đo

Giá Opus 5.5 dùng để quy đổi: input $4/MTok, output $20/MTok, đọc cache $0,20/MTok, ghi cache TTL 1 giờ $8/MTok (2×). `total_cost_usd` trong output của Claude Code tính theo đúng bảng giá này.

### 1. Ước tính trên log cũ

Dữ liệu là 26 phiên Claude thật ngày 10–11/10, gồm 664 lượt gọi API, 71,5 triệu token, khoảng $41,31. Các task M4-save-errors và M5–M7 chạy bằng Codex nên không có log.

Với mỗi phiên, mình lấy `prd.json` và `agent-progress.txt` ở commit ngay trước đó, rồi chạy `ralph.ts context` để có đúng ngữ cảnh mà harness mới sẽ đưa vào. Một khối ngữ cảnh vào lượt gọi j sẽ nằm lại tới hết phiên: lượt đầu tính giá ghi cache, các lượt sau tính giá đọc cache. Tỉ lệ 0,447 token/ký tự được hồi quy từ 25 phiên (phần cố định khoảng 30 nghìn token).

| Hạng mục | Token | Chi phí |
| --- | --- | --- |
| Phần đọc bắt buộc trong ngữ cảnh (cũ) | 28,4% | 24,9% |
| Ngữ cảnh do `ralph.ts` đưa vào (mới) | 4,4% | 3,8% |
| **Tiết kiệm nhờ cắt ngữ cảnh** | **24,0%** | **21,0%** |
| Tiết kiệm nhờ gộp Playwright | 0,1% | 0,1% |

- Từng task tiết kiệm 17–33%. Riêng M4-delete tốn hơn 3%, vì phiên đó dùng prompt "Read from disk" và agent đã bỏ qua việc đọc file.
- Chi phí cũ gồm: ghi cache 45,6%, đọc cache 33,3%, output 21,1%. Token suy nghĩ chiếm 36% output, tức khoảng 7,6% chi phí.
- Playwright: 88/183 lượt gọi đã dùng run-code, còn các lượt khác chỉ trả trung bình khoảng 550 ký tự, nên không còn gì để cắt.

### 2. Chạy thật 10 task

Harness mới chạy ngày 12/10 (commit `d514127`…`b43c7b0`) ở effort `medium`, không có tool Artifact, và có 13 tool. Mỗi task được so với phiên cũ đã hoàn thành chính task đó. Chi phí lấy từ log phiên và khớp với `.ralph/usage.csv`.

| Task | Lượt gọi | Ngữ cảnh lượt đầu | Ngữ cảnh TB / lượt | Token | Chi phí | Suy nghĩ (% output) |
| --- | --- | --- | --- | --- | --- | --- |
| M0-deps | 21 → 14 | 50,9k → 32,0k | 71,8k → 39,8k | 1,52M → 0,56M (−63%) | $1,06 → $0,51 (−52%) | 30 → 30 |
| M0-env | 13 → 14 | 54,3k → 32,1k | 65,6k → 36,7k | 0,86M → 0,52M (−40%) | $0,79 → $0,41 (−48%) | 50 → 29 |
| M0-spike-sqlite¹ | 18 → 16 | 54,6k → 32,9k | 71,9k → 38,7k | 1,30M → 0,63M (−52%) | $0,96 → $0,51 (−46%) | 33 → 28 |
| M0-spike-auth | 29 → 22 | 55,3k → 33,9k | 88,6k → 46,1k | 2,58M → 1,02M (−60%) | $1,46 → $0,74 (−49%) | 25 → 14 |
| M0-close | 9 → 11 | 56,5k → 33,8k | 64,8k → 38,9k | 0,59M → 0,43M (−26%) | $0,64 → $0,42 (−34%) | 34 → 22 |
| M1-env | 9 → 11 | 57,9k → 32,4k | 66,3k → 37,5k | 0,60M → 0,42M (−31%) | $0,67 → $0,37 (−44%) | 18 → 15 |
| M1-migrate | 16 → 14 | 57,0k → 32,6k | 76,4k → 42,9k | 1,24M → 0,61M (−51%) | $1,06 → $0,54 (−49%) | 37 → 16 |
| M1-db-cli | 14 → 14 | 58,3k → 33,4k | 80,0k → 42,8k | 1,13M → 0,61M (−46%) | $1,01 → $0,51 (−49%) | 31 → 15 |
| M2-share-token | 10 → 11 | 61,7k → 32,5k | 72,7k → 39,0k | 0,74M → 0,43M (−41%) | $0,84 → $0,41 (−51%) | 33 → 22 |
| M2-validation | 19 → 18 | 59,4k → 33,1k | 97,2k → 49,7k | 1,87M → 0,91M (−51%) | $1,59 → $0,84 (−48%) | 47 → 16 |
| **Tổng** | **158 → 145 (−8%)** | | | **12,43M → 6,14M (−51%)** | **$10,09 → $5,27 (−48%)** | **36 → 20** |

¹ So với lần chạy lại của phiên cũ. Lần chạy đầu bị block tốn thêm 41 lượt gọi, 3,33 triệu token, $1,79 và 13 phút. Tính cả lần đó thì tổng là 15,77M → 6,14M token (−61%) và $11,88 → $5,27 (−56%).

Những điều rút ra:

- **Ngữ cảnh lượt đầu của harness mới gần như không đổi** (32,0–33,9k), trong khi của harness cũ tăng dần theo progress (50,9k → 61,7k). Chênh lệch mỗi lượt gọi tăng từ 19k lên 26–29k token, và sẽ còn tăng ở M3–M4: phiên cũ ở M4 có ngữ cảnh lượt đầu tới 73–77k.
- **Agent làm lượng việc tương đương.** Lượt gọi 158 → 145 (−8%), tổng thời gian 34 → 33 phút. Phần tiết kiệm đến từ **ngữ cảnh trung bình mỗi lượt gọi giảm 44–49%**, chứ không phải từ việc làm ít đi.
- **Phân rã mức giảm.** Mô hình ở mục 1 dự đoán khoảng 24% chi phí cho 10 task này nhờ bớt phần đọc bắt buộc. Khoảng 24 điểm còn lại đến từ việc mỗi phiên tích luỹ ít ngữ cảnh hơn: chênh lệch giữa ngữ cảnh trung bình và ngữ cảnh lượt đầu trung bình khoảng 19k ở phiên cũ, chỉ khoảng 8k ở phiên mới. Có thể do output check được rút gọn, effort `medium` (token suy nghĩ giảm từ 36% xuống 20% output), quy tắc không đọc lại file, và SPEC đã có sẵn kiến thức. Muốn tách riêng từng yếu tố thì cần chạy A/B.

Yếu tố nhiễu:

- SPEC trên nhánh này đã chứa những gì lần chạy cũ học được (Bun 1.3.14, R1/R2/R10 đã kiểm chứng, lệnh CLI của better-auth). Điều này chủ yếu giúp các task spike của M0. Nhưng các task M1–M2, nơi ảnh hưởng đó nhỏ, vẫn giảm 44–51% chi phí, nên yếu tố này không giải thích được phần lớn mức giảm.
- Lần chạy cũ không ghi lại effort, nên chưa biết chắc bao nhiêu phần giảm là nhờ `medium`.
- Hai task ngắn (M0-close, M1-env) giảm ít nhất (−34%, −44%), vì phần cố định khoảng 30k token mỗi lượt gọi chiếm tỉ trọng lớn.
- Lần chạy cũ cũng chưa có tool Artifact, nên bảng trên **chưa tính** khoản tiết kiệm từ cờ `--disallowedTools Artifact`. Nếu so với việc chạy harness cũ ngay hôm nay thì mức giảm còn lớn hơn.

### 3. Cờ `--disallowedTools Artifact`

Thử bằng hai lệnh `claude -p` một lượt trong một thư mục trống:

| | Ngữ cảnh |
| --- | --- |
| Không có cờ | 37.342 token |
| Có cờ | 25.942 token (−11.400) |

Áp vào 664 lượt gọi của lần chạy cũ, cờ này bớt khoảng 7,6 triệu token (khoảng 9–10% token). Chi phí chỉ giảm khoảng 3–5%, vì phần định nghĩa tool chủ yếu được tính theo giá đọc cache.

## Cách đo lại

```bash
column -s, -t < .ralph/usage.csv   # token và chi phí của từng vòng Claude
bun ralph.ts next                  # task mà vòng tiếp theo sẽ làm
bun ralph.ts context M4-save       # ngữ cảnh prompt của task đó
npx ccusage@latest session         # tổng hợp theo phiên từ log của Claude Code
```

- Log phiên nằm ở `~/.claude/projects/<thư mục repo>/<session>.jsonl`. Usage của mỗi lượt gọi nằm trong `message.usage`. Cần gộp theo `message.id` vì một message được ghi thành nhiều dòng. File gắn bằng `@` nằm trong các dòng `attachment` có `type: "file"`.
- Các script phân tích (`survey.ts`, `compare.ts`, `analyze.ts`, `compare10.ts`) nằm trong scratchpad của phiên Claude và sẽ bị xoá cùng phiên. Muốn dùng lại thì yêu cầu lưu chúng vào repo. `compare10.ts` ghép từng task với phiên cũ theo id phiên. Các phiên cũ được ghép như sau: M0-deps `9582f68b`, M0-env `ac797496`, M0-spike-sqlite `982b1466` (lần bị block là `77262905`), M0-spike-auth `e271edac`, M0-close `a9424200`, M1-env `249d41ff`, M1-migrate `89a7d618`, M1-db-cli `b231b13d`, M2-share-token `3c0f927a`, M2-validation `8559827c`.
- Muốn so sánh công bằng thì chạy trên một nhánh đã reset `passes`, và ghi lại effort cùng model của cả hai bên.

## Sự cố và bài học

- **Lỡ chạy claude thật khi test.** Bài test dùng một `claude` giả, nhưng PATH được đặt bằng `C:/...`, và Git Bash tách PATH ở dấu `:` sau `C`, nên lệnh gọi phải claude thật. Kết quả là 3 vòng chạy với `--dangerously-skip-permissions` trong repo tạm, tốn khoảng $2. Repo thật không bị ảnh hưởng. Trong Git Bash, đặt PATH bằng `$(cygpath -u …)`.
- **Biến `CLAUDE_EFFORT=xhigh`** đã có sẵn trong môi trường, và đè lên mặc định `medium`. Vì vậy biến của loop dùng tiền tố `RALPH_` (`RALPH_EFFORT`, `RALPH_MODEL`).
- **Hook Prettier định dạng cả `.md`** khi `node_modules` còn sót Prettier mà chưa có `.prettierignore`. Lần đó chỉ đổi CRLF thành LF. Đã thêm điều kiện yêu cầu có `.prettierignore`.
- **Giả định Playwright sai.** Kết luận lấy từ repo cũ không đúng với repo này. Bài học: đo trên log thật trước khi tối ưu.

## Việc còn mở

- Đặt `"effort": "high"` trong `prd.json` cho những task rủi ro (spike, auth), và để `medium` cho các task còn lại.
- Gộp các task nhỏ khi tạo lại `prd.json` (ví dụ M3-sign-in vào M3-sign-up), vì mỗi phiên tốn khoảng 30 nghìn token cố định.
- Đo xem plugin `typescript-lsp` đáng giữ hay không, dựa trên `usage.csv`.
- Ghi usage cho nhánh Codex.
- So sánh lại ở các milestone M3–M5, nơi progress đã lớn, kể cả các task UI có dùng Playwright.
- Chạy A/B vài task với `RALPH_EFFORT=high` để tách riêng tác động của effort khỏi tác động của việc cắt ngữ cảnh.
