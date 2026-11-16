# JOBHUB – Candidate Portal: những gì chưa có

Tài liệu tổng hợp các chức năng Frontend **đã cần / đã thiết kế** nhưng **Backend chưa hỗ trợ đủ** (hoặc chưa có UI builder đầy đủ). Dùng để ưu tiên code bổ sung phía Backend (và flow FE tương ứng sau đó).

Cập nhật: 2026-11-16  
Phạm vi: Candidate Dashboard, Profile, Quản lý CV, Tạo CV.

---

## 1. CV Template Catalog

**Trạng thái hiện tại:** Không có API / model template. Trang Create CV **không** có gallery mẫu.

**Frontend đang cần:**

- Danh sách template (id, name, category, thumbnail, description, flags nếu có).
- Chi tiết template.
- Lọc theo category (ví dụ: Hiện đại / Chuyên nghiệp / Sáng tạo) nếu Backend định nghĩa.
- Tạo CV từ `templateId`.

**Gợi ý API (chưa có – cần thiết kế):**

| Method | Endpoint (gợi ý) | Mục đích |
| --- | --- | --- |
| `GET` | `/api/candidate/cv-templates` | Danh sách + filter/pagination |
| `GET` | `/api/candidate/cv-templates/:templateId` | Chi tiết + preview asset |
| `POST` | `/api/candidate/cvs` (mở rộng) hoặc `/api/candidate/cvs/from-template` | Tạo CV từ template |

**Ghi chú:** Hiện Generated CV chỉ render Harvard PDF cố định (`candidate-cv-harvard-pdf.service`). Chưa có catalog mẫu ATS đa dạng như mock UI.

---

## 2. AI CV Builder (tạo CV từ đầu bằng AI)

**Trạng thái hiện tại:** Không có flow “AI Builder” độc lập để tạo CV mới từ wizard.

**Backend đã có (nhưng khác scope):**

- `POST /api/candidate/jobs/:jobId/evaluate-cv` — đánh giá CV theo **một job**.
- `POST /api/candidate/jobs/:jobId/optimize-cv` — tối ưu CV theo **một job** → tạo draft mới.
- `POST /api/candidate/job-recommendations` — gợi ý việc theo CV mặc định.

**Frontend đang thiếu / chưa làm vì thiếu API:**

- Wizard tạo CV bằng AI không bắt buộc gắn job.
- Sinh nội dung (summary, experience bullets, skills) rồi lưu thành Generated CV.
- Chọn template đầu ra trong cùng flow AI.

**Cần Backend:**

- Endpoint khởi tạo AI CV session / generate content theo input Candidate (vị trí mục tiêu, kinh nghiệm, kỹ năng…).
- Schema request/response rõ ràng.
- Persist kết quả vào `CandidateCV` Generated (draft hoặc active theo rule hiện có).

---

## 3. ATS Score / ATS Validation / ATS Guarantee

**Trạng thái hiện tại:** Không có API ATS score hay ATS compliance cho CV.

**Frontend đã SKIP hoàn toàn** các badge kiểu “ATS 98%”, “ATS 100% guarantee”, banner cam kết ATS trên Create CV.

**Cần Backend nếu muốn làm thật:**

- Tính / trả ATS score theo CV (và tiêu chí đạt/chưa đạt).
- Không hardcode điểm trên Frontend.

---

## 4. Thống kê thư viện CV (cards kiểu mock)

Mock UI có các card:

1. Dung lượng hồ sơ / storage quota  
2. Hồ sơ ứng tuyển  
3. AI trợ lý  

**Hiện tại:**

| Card | Lý do SKIP |
| --- | --- |
| Dung lượng / quota | Không có API giới hạn số CV hoặc dung lượng thư viện. List CV summary **không** trả `uploadedFile.sizeBytes`. |
| Hồ sơ ứng tuyển | Có `GET /applications` nhưng không phải metadata thư viện CV; FE không gắn vào CV List. |
| AI trợ lý trên CV List | Không có AI summary gắn CV list. |

**Cần Backend (nếu muốn card thống kê):**

- Quota: max CV, max storage, usage hiện tại.
- (Tuỳ product) aggregate size từ uploaded files trong list hoặc endpoint riêng.

---

## 5. Profile – Open to Work / Chia sẻ hồ sơ công khai

**Trạng thái hiện tại:**

- Không có field/API “Open to Work” trên Candidate Profile.
- Không có URL hồ sơ Candidate công khai để share.
- `visibility` trên CV (`PRIVATE` / `PUBLIC`) là intent search, **không** tạo public profile URL.

**Frontend hiện xử lý:** Ẩn / toast “chưa hỗ trợ”, không fake data.

**Cần Backend:**

- Field Open to Work (nếu product cần).
- Public profile URL + authz rõ ràng (hoặc xác nhận không làm).

---

## 6. Editor nội dung Generated CV theo từng CV

**Trạng thái hiện tại:**

- Có API: `PUT /api/candidate/cvs/:cvId/generated-content`
- Có activate: `POST /api/candidate/cvs/:cvId/activate` (cần completeness)
- Profile page chỉnh nội dung chủ yếu quanh **CV mặc định / content CV Generated đang dùng**

**Frontend còn thiếu:**

- Màn hình / builder chỉnh đủ section Harvard cho **một `cvId` bất kỳ** sau khi tạo draft trên Create CV.
- Flow “tạo draft → sửa nội dung → kích hoạt” liền mạch trên UI.

**Cần:**

- FE builder per-CV (có thể làm trên FE với API hiện có), **hoặc**
- Backend bổ sung endpoint hỗ trợ wizard nếu muốn AI điền sẵn nội dung.

---

## 7. Upload PDF – rule Backend đang chặn một số file thật

**API có:** `POST /api/candidate/cvs/uploaded`

**Rule Backend (không đổi từ FE):**

- Magic-byte PDF (`file-type`) + parse `pdf-lib`
- Max **10 MB**, max **20 trang**
- Không password-protected
- Field bắt buộc: `name`, `visibility`, `categoryId`, `file`

**Vấn đề thực tế đã gặp:**

- Một số file `.pdf` bị reject `Uploaded CV must be a valid PDF` (không chỉ vì đuôi file).
- FE đã normalize BOM/`%PDF` lệch offset; nếu vẫn fail thì file bị Backend coi là không hợp lệ.

**Cần Backend xem xét (tuỳ product):**

- Nới / cải thiện inspector cho PDF từ Word/Canva/Chrome phổ biến hơn (nếu muốn nhận nhiều file hơn).
- Message lỗi tiếng Việt / mã lỗi ổn định cho FE map UX.
- (Tuỳ chọn) hỗ trợ DOCX nếu product cần — hiện **chỉ PDF**.

---

## 8. AI / Matching gắn Job – chưa đưa vào Create CV / CV List

Các API sau **đã có** nhưng **không** phải Create CV độc lập:

| API | Ý nghĩa |
| --- | --- |
| `POST /jobs/:jobId/match` | Match CV ↔ job |
| `POST /jobs/:jobId/evaluate-cv` | Evaluate CV theo job |
| `POST /jobs/:jobId/optimize-cv` | Tạo draft tối ưu theo job |

**Frontend:** Có thể gắn sau vào Job Detail / AI Center; **chưa** làm card AI trên Create CV vì thiếu builder độc lập.

---

## 9. Những gì Frontend Candidate Portal ĐÃ làm (để khỏi làm trùng)

Đã có UI + gọi API thật:

- Candidate Dashboard (stats, welcome, search bar dùng chung JobSearchBar)
- Candidate Profile (view/edit profile + sections từ CV Generated)
- CV List: list, preview, download, metadata edit, set default, activate, archive, replace uploaded PDF
- Create CV page (`/candidate/cvs/create`): **chỉ** 2 phương thức Backend hỗ trợ
  - Tạo Generated draft
  - Upload PDF

---

## 10. Ưu tiên đề xuất cho Backend

Thứ tự gợi ý (product phụ thuộc, có thể đổi):

1. **Generated CV content editor flow** (có thể FE-only với API hiện có) — unblock “tạo xong sửa được”.
2. **Upload PDF inspector** — giảm false reject file PDF hợp lệ từ tool phổ biến.
3. **AI CV Builder** (không bắt buộc job) — nếu muốn đúng mock Create CV.
4. **Template catalog + create from template** — nếu muốn gallery mẫu.
5. **ATS score thật** — nếu muốn badge/score; tuyệt đối không fake.
6. **Quota / storage stats** — nếu muốn card dung lượng.
7. **Open to Work + public share URL** — nếu muốn social/recruit visibility.

---

## 11. Checklist “Backend có mới được FE làm”

- [ ] `GET` danh sách CV templates (+ thumbnail)
- [ ] `POST` tạo CV từ `templateId`
- [ ] AI generate CV content không gắn `jobId` (hoặc session builder)
- [ ] ATS score / validation response gắn `cvId`
- [ ] Quota/usage thư viện CV
- [ ] Open to Work field + (optional) public profile
- [ ] (Optional) Upload chấp nhận thêm format / inspector mềm hơn
- [ ] (Optional) Error code ổn định cho upload/validation

---

## 12. Không làm trên Frontend khi chưa có Backend

- Hardcode template / ATS % / AI score / matching %
- Mock API
- Nút không có action thật
- Cam kết “ATS 100%” / “vượt mọi ATS” không có dữ liệu

---

*File này chỉ liệt kê thiếu hụt so với mock UI / nhu cầu Candidate Portal. Không thay đổi contract hiện tại.*
