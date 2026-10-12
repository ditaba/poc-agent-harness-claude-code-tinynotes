# Vì sao Tinynotes tốn token hơn SalesIntel

Oct 11, 2026 · @Di

## Tóm tắt

Tinynotes tốn nhiều token hơn vì **cách làm**, không phải vì độ phức tạp của sản phẩm. Token chủ yếu là lượng Claude phải đọc, nhân với số lần phải đọc lại; còn code viết ra chỉ chiếm phần nhỏ. SalesIntel nhiều code hơn khoảng 40% nhưng vẫn tốn ít token hơn.

Tinynotes được làm qua 16 prompt, rải trong nhiều phiên suốt 5 ngày. Mỗi phiên nạp lại một spec khoảng 10 nghìn token, đọc lại code cũ, bắt buộc tra tài liệu, kiểm thử bằng cách điều khiển trình duyệt qua MCP, và nhiều phần code bị viết lại. SalesIntel chỉ có một prompt và một phiên liền mạch. Trong phiên đó, Claude viết theo lô lớn, tự chọn thư viện quen thuộc, không tra tài liệu và kiểm thử bằng script.

Phần lớn chênh lệch là học phí: khoá học Tinynotes cố ý cho dùng thử từng tính năng (plan mode, subagent, MCP, skill, hook, plugin, kiểm thử bằng trình duyệt), và tính năng nào cũng làm tăng token.

## Hai dự án qua số liệu

Hai dự án cùng nền tảng (Next.js, TypeScript, SQLite, Tailwind) và cỡ code tương đương, nhưng được làm theo hai cách đối lập. Số liệu lấy từ lịch sử git của hai repo (không tính file lock) và từ bản ghi phiên SalesIntel.

| Tiêu chí | Tinynotes | SalesIntel |
| --- | --- | --- |
| Cách làm | 16 prompt theo hướng dẫn từng bước, chạy trên Claude Code CLI | 1 prompt do ChatGPT soạn, chạy trên Claude Code bản web |
| Thời gian | 5 ngày (5–9/10/2026), 12 PR | 1 phiên, 1 commit (6/10/2026) |
| Code cuối cùng | khoảng 5.000 dòng | khoảng 7.000 dòng |
| Dòng thêm / xoá qua các commit | khoảng 9.000 / 1.600 | khoảng 7.300 / 2 |
| Spec | SPEC.md 559 dòng, 41 KB (khoảng 10 nghìn token), cộng CLAUDE.md 71 dòng | Nằm luôn trong prompt, gửi một lần |
| Thư viện chính | Next 16, better-auth, TipTap, libSQL/Kysely, Vitest 5, Tailwind 4 | Next 15, better-sqlite3, bcryptjs, jose, recharts (Claude tự chọn) |
| Cấu hình Claude Code | 8 skill, subagent DocsExplorer, MCP context7 và Playwright, hook định dạng, plugin typescript-lsp, lệnh /code-review | Không có |
| Tra tài liệu | Bắt buộc theo CLAUDE.md | Không |
| Kiểm thử | Playwright MCP, ảnh chụp lỗi, unit test Vitest (khoảng 2.300 dòng test) | Script e2e 31 luồng, 10 unit test |

## Token được tính thế nào

Phần lớn token là token đầu vào, tức những gì Claude đọc, chứ không phải code nó viết ra. Mỗi lần Claude gọi một công cụ (đọc file, sửa file, chạy lệnh, tra tài liệu), toàn bộ hội thoại từ đầu được gửi lại cho model. Vì vậy tổng chi phí xấp xỉ bằng **số bước × độ lớn trung bình của ngữ cảnh**.

Hai yếu tố làm con số này thay đổi:

- **Prompt cache.** Trong một phiên liền mạch, phần đầu ngữ cảnh lặp lại được cache nên rẻ hơn nhiều. Cache hết hạn sau một thời gian không hoạt động, nên mở phiên mới hoặc nghỉ lâu giữa chừng đều khiến phần đó phải xử lý lại với giá đầy đủ.
- **Token suy nghĩ.** Model và mức effort càng cao thì mỗi bước càng tốn thêm token suy nghĩ.

&#91;embedded content: ngữ cảnh qua ba bước của một phiên · minh họa\]

Vì vậy nhiều bước nhỏ trên một ngữ cảnh dài là cách tốn nhất, còn ít bước lớn trong một phiên liền mạch là cách rẻ nhất.

## Vì sao Tinynotes tốn token

Tám nguyên nhân dưới đây cộng dồn với nhau. Ba nguyên nhân đầu tác động mạnh nhất, vì chúng làm tăng cả số bước lẫn độ dài ngữ cảnh.

1. **Nhiều phiên, phiên nào cũng nạp lại từ đầu.** Có 16 prompt và 12 PR trong 5 ngày. Mỗi phiên mới nạp lại system prompt, CLAUDE.md (khoảng 2 nghìn token), danh sách skill và công cụ MCP. Hầu hết prompt gắn `@SPEC.MD` (khoảng 10 nghìn token), CLAUDE.md còn yêu cầu đọc SPEC trước khi làm, và việc nghỉ giữa các bài học khiến cache hết hạn.
2. **Phải đọc lại code cũ trước mỗi tính năng.** Vì làm từng tính năng một, prompt nào cũng bắt đầu bằng việc tìm hiểu code đang có. Plan mode (prompt #3, #7 đến #10) khảo sát codebase để lập kế hoạch, rồi khi bắt tay vào làm lại đọc thêm một lượt nữa.
3. **Kiểm thử qua Playwright MCP (prompt #15).** Mỗi lần bấm hoặc chuyển trang là một lượt riêng và trả toàn bộ nội dung trang vào ngữ cảnh. Phần này cứ tích lũy qua vòng “thấy lỗi, sửa, thử lại”.
4. **Có những prompt chỉ đọc mà gần như không viết code.** Prompt #5 và #6 giống hệt nhau, đều kiểm tra auth và DB so với tài liệu chính thức. Lệnh `/code-review` yêu cầu đọc toàn bộ codebase từng file một, còn prompt #12 và #13 gửi ảnh chụp màn hình lỗi.
5. **Bắt buộc tra tài liệu.** CLAUDE.md ghi “you MUST look up the official documentation”, nên việc nào liên quan đến thư viện cũng kéo trang tài liệu dài về qua DocsExplorer, context7 hoặc WebFetch. Các thư viện lại đều là bản mới, mà với bản mới thì Claude ít chắc chắn hơn.
6. **Chi phí phụ sau mỗi lần sửa file.** Hook chạy `oxfmt` sau mỗi Edit/Write làm file thay đổi ngay sau khi Claude viết, nên Claude phải nhận thông báo thay đổi hoặc đọc lại file. Plugin typescript-lsp thêm thông báo lỗi kiểu vào ngữ cảnh, và mỗi milestone phải chạy lint, test, build. Skill React còn kèm một file tham khảo 34 KB (khoảng 8 nghìn token).
7. **Viết đi viết lại.** Commit chia sẻ ghi chú thêm 1.797 dòng và xoá 703 dòng. Prompt Vitest yêu cầu tách hàm để dễ test nên phải sửa 53 file. Việc chuyển sang libSQL/Turso ở cuối, nằm ngoài hướng dẫn, sửa 27 file (thêm 599, xoá 452 dòng).
8. **Spec rất chặt.** SPEC.md quy định sẵn chữ ký hàm, mã lỗi, nội dung giao diện, ranh giới chống XSS và autosave có thử lại, nên Claude phải đối chiếu nhiều lần. Một ứng dụng “đơn giản” nhưng có tiêu chuẩn chất lượng cao vẫn tốn nhiều bước kiểm tra.

## Vì sao SalesIntel rẻ hơn

Phiên SalesIntel chạy liền một mạch từ một prompt dài đến lúc commit và push. Nó vẫn có kiểm thử kỹ (một lần build sạch, 10 unit test, 31 luồng trên trình duyệt), nên khác biệt không nằm ở chỗ có kiểm thử hay không, mà ở bốn cách làm dưới đây.

1. **Viết theo lô lớn và không đọc lại code của mình.** Mỗi bước tạo cùng lúc 4–8 file, khoảng 500–980 dòng, nên chỉ hơn chục bước là ra phần lớn ứng dụng. Code vừa viết đã nằm sẵn trong ngữ cảnh, và các lần “Read” trong cả phiên chỉ để xem 4 ảnh chụp màn hình.
2. **Không tra tài liệu.** Prompt để Claude tự chọn stack, và nó chọn những thư viện quen (Next.js 15, better-sqlite3, bcryptjs, jose) rồi tự viết phần auth. Phiên không dùng subagent hay MCP nào.
3. **Kiểm thử bằng script.** Claude tự viết `tests/e2e.mjs` gồm 31 luồng và chạy nó bằng một lệnh, kết quả trả về chỉ vài dòng đạt hoặc lỗi. Ảnh chụp được lưu ra file. Lỗi tràn giao diện trên mobile mất khoảng 5 lần chạy mới sửa xong, nhưng lần nào cũng rẻ.
4. **Spec gửi một lần, kiểm tra ngay trong phiên.** Prompt dài vài nghìn token nằm ở đầu ngữ cảnh và được cache suốt phiên. Prompt có sẵn yêu cầu “Before declaring the task complete: Run and test all major flows… Fix broken flows”, nên việc kiểm tra diễn ra khi ngữ cảnh còn nóng.

Phiên hiện hiển thị cấu hình Opus 5.5 với mức effort Medium. Nếu Tinynotes chạy ở mức effort cao hơn, mỗi bước sẽ tốn thêm token suy nghĩ.

## Đánh đổi và giới hạn

Rẻ hơn không có nghĩa là tốt hơn, và phân tích này cũng có những giới hạn cần biết.

- **Tinynotes là học phí, không phải lãng phí.** Mỗi bài học cố ý dùng một tính năng, nhờ vậy bạn hiểu được plan mode, subagent, MCP, skill và hook làm gì.
- **One-shot có rủi ro.** SalesIntel giao về khoảng 7.000 dòng code mà chưa ai đọc lại. Dữ liệu hoàn toàn là giả lập. Theo báo cáo cuối phiên, phần gọi Claude API chưa chạy thật lần nào, vì mọi tính năng AI đều chạy bằng bộ luật dự phòng.
- **Chưa có số token thật.** Các con số token trong tài liệu này đều ước tính từ kích thước file, khoảng 4 byte một token. Thứ tự mức độ ảnh hưởng của các nguyên nhân là suy luận, chưa đo đạc.
- **Chưa biết cấu hình model của Tinynotes.** Model và mức effort đã dùng trong CLI không ghi lại trong repo.

## Cách làm tiết kiệm token

Nên giữ spec và CLAUDE.md như Tinynotes, nhưng làm việc theo nhịp của SalesIntel.

1. **Mỗi milestone một phiên dài,** với yêu cầu lớn và rõ, thay vì nhiều prompt nhỏ.
2. **Không gắn `@SPEC.MD` mỗi lần.** Hãy tách spec thành nhiều file theo mục, hoặc chỉ dẫn đến đúng mục cần dùng.
3. **Nới quy tắc tra tài liệu** trong CLAUDE.md thành “chỉ tra khi không chắc chắn hoặc với thư viện mới”.
4. **Kiểm thử bằng script,** tức là để Claude tự viết script e2e như `tests/e2e.mjs` thay vì điều khiển trình duyệt qua MCP. Code review chỉ nên giới hạn ở các file vừa thay đổi.
5. **Ghi điều kiện hoàn thành vào prompt,** ví dụ “test và sửa xong mới báo hoàn thành”, để việc kiểm tra nằm chung phiên với việc viết code.
6. **Chạy formatter ở cuối lượt** bằng hook Stop, thay vì sau mỗi Edit/Write.
7. **Dọn ngữ cảnh:** dùng `/clear` giữa các việc không liên quan, `/compact` khi phiên đã dài, và tránh nghỉ lâu khi đang làm dở một việc.
8. **Chọn mức effort vừa đủ.** Với việc viết code theo một spec đã rõ, mức Medium thường là đủ.

## Kiểm chứng và nguồn

Công cụ cộng đồng ccusage cho biết số token thật của từng phiên. Nó đọc log cục bộ của Claude Code, nên cần chạy trên chính máy đã làm Tinynotes:

```bash
npx ccusage@latest session
```

Kết quả sẽ chỉ ra bài học nào tốn nhiều nhất, và các nguyên nhân ở trên có đúng thứ tự hay không. Model và mức effort đang dùng thì xem bằng lệnh `/model` trong Claude Code.

Nguồn đã dùng:

- [Hướng dẫn từng bước Tinynotes (hand-on-steps-notes.md)](https://github.com/ditaba/poc-agentic-ai-claude-code-tinynotes/blob/main/hand-on-steps-notes.md)
- [Repo Tinynotes](https://github.com/ditaba/poc-agentic-ai-claude-code-tinynotes): SPEC.md, CLAUDE.md, thư mục .claude, lịch sử commit
- [Repo SalesIntel-VN](https://github.com/ditaba/SalesIntel-VN): docs/ARCHITECTURE.md, lịch sử commit
- [Phiên Claude Code SalesIntel](https://claude.ai/code/session_01LBerrWFVBSxRDtmbJvxtce): prompt đầu, các bước làm và báo cáo cuối phiên
