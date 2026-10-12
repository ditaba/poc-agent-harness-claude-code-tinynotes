## Setup

Use Bun 1.3.14. From a fresh clone, install dependencies:

```bash
bun install
```

Copy `.env.example` to `.env` and replace `BETTER_AUTH_SECRET` with a real random
secret of at least 32 characters. Keep `BETTER_AUTH_URL=http://localhost:3000`
and `DB_PATH=data/app.db` for local use. Do not commit `.env` or `data/`.

Build and run the production app:

```bash
bun run build && bun run start
```

Or run the development server:

```bash
bun run dev
```

Open http://localhost:3000. Build, start and dev run migrations first, creating
the database if needed. A missing or invalid environment stops the command
with a message naming the variable and pointing to `.env.example`.

Run the checks from SPEC §11:

```bash
bun test
bun run lint
bun run typecheck
bun run build
```

UI acceptance uses the manual checklist in [SPEC.md](SPEC.md), run through
Playwright MCP. Run `bun run format` before validation and committing changes.

```
branch:
    + initial
    + agent-harness-implement
```

# Follow instruction in `spec-to-prd-prompts.md` in order to create PRD from `requestments.txt`

## Create CLAUDE.md after create SPEC.md

```
/clear -> Start new session with clear context
/init -> Creating CLAUDE.md
```

# Run `$ ./ralph.sh` <claude code>

## Run the agent loop with Codex

In Git Bash on Windows (or Bash on WSL/Linux/macOS):

```bash
codex login
./ralph.sh codex       # No iteration limit; run until all tasks are done
./ralph.sh codex 5     # Up to 5 iterations
```

Requires a Codex CLI with `exec --approve-for-me`, Bun and Node/npm/npx.
Independent Codex rules and skills live in `.codex/`, loaded through `AGENTS.md`.
Playwright and Context7 MCP settings are supplied by the script.
The Codex prompt is sent through stdin to preserve all lines on Windows.
The loop stops with exit code `3` if an iteration returns without a new commit
and without a completion/blocked marker. Its last Codex response is saved in
`.ralph/last-message.txt` for diagnosis.
See [RALPH.md](RALPH.md) for setup, permissions, blocked tasks and resume behavior.

## Mapping cấu hình Claude Code → Codex

Bảng này mô tả **cấu hình đang dùng trong repository**, gồm các setting CLI và
các quy tắc được agent đọc. Hai bộ hướng dẫn được duy trì độc lập; `SPEC.md`,
`prd.json` và `agent-progress.txt` là dữ liệu chung của dự án.

| Chức năng / setting | Claude Code | Codex trong dự án | Cách tương ứng / khác biệt |
| --- | --- | --- | --- |
| Điểm vào quy tắc | [`CLAUDE.md`](CLAUDE.md) | [`AGENTS.md`](AGENTS.md) | `AGENTS.md` hướng dẫn Codex đọc bộ quy tắc riêng trong `.codex/`. |
| Kiến trúc, invariants, commands, quy tắc task | Nội dung `CLAUDE.md` | [`.codex/rules/project.md`](.codex/rules/project.md) | Bản riêng đã điều chỉnh cho Codex; thay đổi một bên không tự đồng bộ sang bên kia. |
| Skills triển khai | `.claude/skills/*/SKILL.md` | [`.codex/skills/`](.codex/skills/) | Đã sao chép 8 skills và tài liệu tham chiếu. Codex được yêu cầu đọc skills phù hợp qua `AGENTS.md`; không dựa vào tự động khám phá thư mục này. |
| Tra cứu tài liệu | `.claude/agents/DocsExplorer.md`, agent `sonnet` | [`.codex/workflows/docs-lookup.md`](.codex/workflows/docs-lookup.md) | Workflow trong phiên Codex hiện tại, gọi Context7 trực tiếp; không tạo sub-agent tương đương DocsExplorer. |
| Code review | `.claude/commands/code-review.md`, mode qua `$ARGUMENTS` | [`.codex/workflows/code-review.md`](.codex/workflows/code-review.md) | Hướng dẫn đọc khi được yêu cầu review; chưa đăng ký slash command hay parser `$ARGUMENTS` cho Codex. |
| File setting của agent | `.claude/settings.json`, `.claude/settings.local.json` | Các đối số `codex_args` trong [`ralph.sh`](ralph.sh) | Loop Codex truyền setting qua CLI `-c`; hiện không có `.codex/config.toml` trong dự án. `.codex/` chứa tài liệu quy tắc và skills. |
| Quyền chạy không tương tác | `claude --dangerously-skip-permissions -p` | `codex exec --approve-for-me` | Cơ chế khác nhau: phía Codex yêu cầu xét duyệt quyền tự động, không dùng cờ bypass sandbox. |
| Sandbox và network | Không có setting `sandbox.enabled` trong hai file `.claude/settings*.json` hiện tại | `--approve-for-me` và `-c sandbox_workspace_write.network_access=true` | Loop Codex yêu cầu workspace sandbox và bật network. Không thể kết luận sandbox Claude đã bật chỉ từ các file hiện có. |
| Danh sách quyền cục bộ | `.claude/settings.local.json`: `permissions.allow: []` | Không có allowlist riêng trong dự án | Codex dùng cơ chế xét duyệt của CLI; setting và policy cấp người dùng/tổ chức vẫn có thể ảnh hưởng phiên chạy. |
| Format sau sửa file | Hook `PostToolUse`, matcher `Edit\|Write`, chạy `bun run format` | Quy tắc trong `AGENTS.md`, `project.md` và prompt Ralph | Codex được yêu cầu format trước checks và commit; chưa có hook tự chạy sau mỗi lần sửa file. |
| TypeScript LSP | `.claude/settings.json`: `typescript-lsp@claude-plugins-official: true` | Chưa cấu hình plugin LSP tương ứng | `bun run typecheck` là bước kiểm tra TypeScript trong loop; không thay thế chức năng LSP. |
| Playwright MCP | Quy tắc yêu cầu Playwright; hiện không có `.mcp.json` trong repository | `-c mcp_servers.playwright.command="npx"`, args `-y @playwright/mcp@latest`, startup timeout 60 giây | Loop Codex khai báo MCP mỗi phiên để kiểm tra UI. Cấu hình MCP Claude ngoài repository không được sao chép. |
| Context7 MCP | DocsExplorer hướng dẫn dùng Context7; hiện không có `.mcp.json` trong repository | `-c mcp_servers.context7.url="https://mcp.context7.com/mcp"` | Loop Codex khai báo HTTP MCP mỗi phiên để tra cứu tài liệu. |
| Model | Ralph không truyền model cho phiên Claude chính; DocsExplorer khai báo `sonnet` | Biến môi trường `CODEX_MODEL` → `--model`, nếu bỏ trống dùng mặc định CLI | Không ánh xạ tên model Claude sang model Codex. |
| Phiên mới mỗi vòng | Một lần gọi `claude -p` cho mỗi task | Một lần gọi `codex exec` cho mỗi task | Cả hai đọc tiến độ từ file, không resume lịch sử chat của vòng trước. |
| Kết quả và điều kiện dừng | Script đọc output Claude đã capture | Codex stream tiến độ, script đọc `--output-last-message` | Cùng dùng `<complete>ALL_TASKS_DONE</complete>` và `<blocked>…</blocked>`; phía Codex chỉ xét phản hồi cuối. |
| Checks, tiến độ và commit | Quy tắc `CLAUDE.md` và prompt Ralph | Quy tắc `.codex/rules/project.md`, `AGENTS.md` và prompt Ralph | Cùng yêu cầu checks, cập nhật task/log và commit; đây là chỉ dẫn cho agent, script không tự thực hiện checks hoặc commit. |

Lưu ý: phần Sandbox Mode trong `RALPH.md` có ví dụ cấu hình Claude; ví dụ đó
không phản ánh đầy đủ nội dung `.claude/settings*.json` hiện có. Bảng trên lấy
các file và đối số thực tế của script làm căn cứ.
