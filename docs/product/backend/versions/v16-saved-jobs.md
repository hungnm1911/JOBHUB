# V16 — Saved Jobs

> **File:** `docs/product/backend/versions/v16-saved-jobs.md`
> **Vai trò:** Product Specification + Implementation Contract cho V16 — Saved Jobs.  
> **Ngôn ngữ:** Tiếng Việt  
> **Mục đích:** Chốt business flow, API surface và các implementation decision cần thiết để triển khai V16 trên backend hiện tại của JOBHUB.

---

# 1. Mục tiêu

V16 bổ sung khả năng **Saved Jobs**, cho phép Candidate đánh dấu các Job mình quan tâm để xem lại sau.

Luồng nghiệp vụ tổng quát:

```text
Candidate mở Find Jobs / Job Detail
        ↓
Save Job
        ↓
Saved Job được lưu duy nhất theo Candidate–Job
        ↓
Candidate mở Saved Jobs
        ↓
Xem trạng thái Job hiện tại
+
Nhận biết đã có Application hay chưa
        ↓
Nếu Job còn nhận hồ sơ và chưa có Application
→ đi vào Direct Apply hiện có
        ↓
Nếu Job CLOSED hoặc EXPIRED
→ vẫn giữ Saved Job
→ hiển thị trạng thái
→ không cho Apply
        ↓
Candidate có thể Unsave bất kỳ lúc nào
```

Saved Job là bookmark độc lập giữa Candidate và Job.

```text
Saved Job ≠ Application
```

Các nguyên tắc nền tảng:

```text
Save không có nghĩa là Apply.
Apply không bắt buộc phải Save.
Apply thành công không tự động Unsave.
```

V16 không tạo:

- Application mới chỉ vì Save;
- Submitted CV snapshot;
- Job snapshot;
- Recruitment Pipeline state;
- Assignment;
- Conversation;
- Message;
- Job Invitation;
- Notification type mới.

---

# 2. Phạm vi

## 2.1. Trong phạm vi

V16 bao gồm:

- Candidate Save một Job.
- Candidate Unsave một Job.
- Candidate xem Saved Jobs của chính mình.
- Mỗi Candidate–Job có tối đa một Saved Job.
- Save là idempotent.
- Unsave là idempotent.
- Concurrent Save không tạo dữ liệu trùng.
- Saved Jobs sắp xếp theo `savedAt DESC`.
- Candidate nhận biết trạng thái Job hiện tại.
- Job `CLOSED` hoặc `EXPIRED` vẫn được giữ trong Saved Jobs nếu Candidate vẫn được phép historical-read.
- Candidate nhận biết mình đã có Application cho Job hay chưa.
- Candidate có Application vẫn được Save Job.
- Apply thành công không tự động Unsave.
- Candidate có thể Save/Unsave từ Find Jobs và Job Detail.
- Candidate có thể Unsave tại Saved Jobs.
- Job không còn được phép hiển thị cho Candidate sẽ không xuất hiện trong Saved Jobs response.
- Hard delete Job hợp lệ phải xóa toàn bộ Saved Jobs liên quan.
- Saved Job không sử dụng Job snapshot.
- Saved Jobs không tạo Notification riêng.

## 2.2. Ngoài phạm vi

V16 không triển khai:

- Notification cho Saved Jobs.
- Recommendation/AI dựa trên Saved Jobs.
- Folder/collection.
- Personal note.
- Priority/ranking.
- Save history.
- Analytics cho Recruiter/Company.
- Search riêng trong Saved Jobs.
- Filter riêng trong Saved Jobs.
- User-selected sort.
- Saved Job quota.
- Auto-save khi Apply.
- Auto-unsave khi Apply.
- Application source mới.
- Pipeline detail trong Saved Job card.

---

# 3. Dependency với các version trước

## 3.1. Authentication

Chỉ Candidate hợp lệ đã đăng nhập được quản lý Saved Jobs.

Backend xác định Candidate từ authenticated context.

Client không được truyền `candidateId` tùy ý để thao tác dữ liệu của Candidate khác.

## 3.2. Job Discovery và Job Detail

V16 kế thừa Job visibility/public read rules hiện có.

Không tạo visibility rule mới riêng cho Saved Jobs.

Implementation phải **reuse existing Job Discovery / public Job visibility logic**.

## 3.3. Direct Apply

Apply từ Saved Jobs vẫn dùng Direct Apply hiện có:

```text
source = DIRECT_APPLICATION
status = APPLIED
assignedRecruiter = null
```

V16 không tạo Application source mới.

## 3.4. Application uniqueness

Bất biến tiếp tục được giữ:

```text
Candidate + Job
→ tối đa một Application
```

Saved Job không cho phép Candidate tạo Application thứ hai.

## 3.5. Job Invitation

Saved Job và Job Invitation độc lập.

Save/Unsave không mutate Invitation.

Nếu Direct Apply cạnh tranh với Invitation thì tiếp tục dùng rule hiện hữu của version sở hữu Invitation race.

## 3.6. Hard delete Job

Saved Job không chặn hard delete.

Nếu Job đủ điều kiện hard delete theo nghiệp vụ hiện hữu thì phải:

```text
delete Saved Jobs liên quan
→ hard delete Job
```

Không để orphan Saved Job.

---

# 4. Thuật ngữ và chủ thể

## 4.1. Candidate

Candidate là actor duy nhất quản lý Saved Jobs.

Candidate được:

- Save Job;
- Unsave Job;
- xem Saved Jobs của mình;
- xem trạng thái hiện tại của Job;
- biết mình đã có Application hay chưa;
- đi vào Direct Apply nếu đủ điều kiện.

Candidate không được:

- xem Saved Jobs của Candidate khác;
- Save thay Candidate khác;
- Unsave thay Candidate khác.

## 4.2. Saved Job

Saved Job là quan hệ bookmark:

```text
Candidate
   │
   │ saves
   ↓
  Job
```

Saved Job không phải:

- Application;
- Job snapshot;
- recruitment stage;
- invitation;
- notification.

## 4.3. Saved At

`savedAt` là thời điểm Saved Job được tạo thành công lần đầu.

Save lại một Job đã lưu:

- không tạo record mới;
- không update `savedAt`;
- không đưa Job lên đầu danh sách chỉ vì Save lặp lại.

## 4.4. Current Job State

Saved Jobs luôn đọc trạng thái hiện tại của Job gốc.

Không lưu snapshot Job status tại thời điểm Save.

## 4.5. Has Application

Saved Job item có thể trả:

```text
hasApplication = true | false
```

V16 chỉ cần nhận biết đã có Application, không yêu cầu pipeline detail.

---

# 5. Data Model

## 5.1. SavedJob

Model chốt cho implementation hiện tại:

```text
SavedJob
- candidateUserId
- jobId
- savedAt
```

Không lưu:

```text
jobSnapshot
jobStatusSnapshot
applicationStatusSnapshot
companySnapshot
unsavedAt
saveHistory
```

## 5.2. Unique constraint

Phải có uniqueness tại persistence boundary:

```text
UNIQUE(candidateUserId, jobId)
```

## 5.3. Index phục vụ danh sách

Khuyến nghị:

```text
INDEX(candidateUserId, savedAt DESC)
```

để phục vụ list theo Candidate và sort gần nhất.

---

# 6. Trạng thái nghiệp vụ

Saved relation chỉ có hai trạng thái hiệu lực:

| Effective state | Ý nghĩa |
| --- | --- |
| `SAVED` | Candidate hiện có SavedJob cho Job |
| `NOT_SAVED` | Candidate hiện không có SavedJob cho Job |

Không cần persisted enum riêng.

Job state vẫn là state của Job:

- `PUBLISHED`
- `CLOSED`
- `EXPIRED`

Application indicator độc lập:

```text
PUBLISHED + hasApplication = true
CLOSED    + hasApplication = true
EXPIRED   + hasApplication = true
```

---

# 7. Luồng chính

## 7.1. Save Job

```text
Candidate mở Find Jobs / Job Detail
        ↓
Click Save
        ↓
PUT /api/candidate/saved-jobs/:jobId
        ↓
Authenticate Candidate
        ↓
Resolve Job
        ↓
Kiểm tra Job còn accessible cho Candidate
        ↓
Create SavedJob nếu chưa tồn tại
        ↓
Nếu đã tồn tại
→ giữ nguyên record + savedAt
        ↓
Success
```

DB thay đổi:

```text
Nếu chưa Saved:
INSERT SavedJob(candidateUserId, jobId, savedAt)

Nếu đã Saved:
NO INSERT
NO UPDATE savedAt
```

## 7.2. Unsave Job

```text
Candidate click Unsave
        ↓
DELETE /api/candidate/saved-jobs/:jobId
        ↓
Delete SavedJob theo Candidate + Job nếu tồn tại
        ↓
Nếu không tồn tại
→ không mutation
        ↓
Success
```

DB thay đổi:

```text
Có SavedJob → DELETE
Không có     → NO CHANGE
```

## 7.3. Xem Saved Jobs

```text
Candidate mở Saved Jobs
        ↓
GET /api/candidate/saved-jobs
        ↓
Load SavedJob của Candidate
        ↓
Resolve current Job + Company
        ↓
Filter Job không còn accessible
        ↓
Giữ CLOSED / EXPIRED nếu historical-readable
        ↓
Check Application existence
        ↓
Sort savedAt DESC
        ↓
Return list
```

DB thay đổi:

```text
Không mutation.
Chỉ query SavedJob + Job + Company + Application existence.
```

## 7.4. Save state tại Find Jobs / Job Detail

Khi Candidate authenticated gọi Job Discovery / Job Detail:

```text
Check SavedJob(candidateUserId, jobId)
        ↓
Return isSaved = true | false
```

Chốt implementation:

```text
Option A — Candidate-aware enrichment
```

Không tạo API riêng để đọc save state.

## 7.5. Apply từ Saved Jobs

```text
Saved Job
   ↓
Click Apply
   ↓
Dùng Direct Apply API hiện tại
   ↓
Backend revalidate Job + Candidate + CV + Application uniqueness
   ↓
Create Application nếu hợp lệ
   ↓
SavedJob vẫn giữ nguyên
   ↓
Lần đọc sau hasApplication = true
```

DB thay đổi:

```text
CREATE Application
NO DELETE SavedJob
```

## 7.6. Job lifecycle

### Job CLOSED

```text
SavedJob giữ nguyên
Job vẫn hiển thị nếu historical-readable
Apply disabled
```

### Job EXPIRED

```text
SavedJob giữ nguyên
Job vẫn hiển thị nếu historical-readable
Apply disabled
```

### Job inaccessible

```text
SavedJob có thể vẫn tồn tại trong DB
Nhưng không được trả trong Saved Jobs response
```

Không auto-delete SavedJob chỉ vì resource tạm thời inaccessible.

## 7.7. Hard delete Job

```text
Request hard delete
        ↓
Existing Job delete rules xác nhận đủ điều kiện
        ↓
Delete SavedJobs referencing Job
        ↓
Delete Job
```

Cleanup phải nằm trong consistency boundary đủ để không tạo orphan SavedJob.

---

# 8. Functional Requirements

## F01 — Save Job

Candidate có thể Save Job từ Find Jobs hoặc Job Detail.

### API

```http
PUT /api/candidate/saved-jobs/:jobId
```

### Input

Path:

```text
jobId
```

Không có business body.

### Kết quả

- Candidate–Job có tối đa một SavedJob.
- `savedAt` chỉ được set khi record được tạo lần đầu.
- Save lặp lại vẫn success.

---

## F02 — Unsave Job

### API

```http
DELETE /api/candidate/saved-jobs/:jobId
```

Unsave Job chưa được Save vẫn success.

Không mutate:

- Job;
- Application;
- Invitation;
- Conversation;
- Notification.

---

## F03 — View Saved Jobs

### API

```http
GET /api/candidate/saved-jobs
```

Sort bắt buộc:

```text
savedAt DESC
```

Danh sách rỗng vẫn là success.

Không có search/filter/sort selection trong V16.

---

## F04 — Save state tại Find Jobs / Job Detail

Candidate authenticated phải nhận được:

```json
{
  "isSaved": true
}
```

hoặc:

```json
{
  "isSaved": false
}
```

trong Candidate-aware Job projection.

Guest/actor khác không có Candidate Saved state.

---

## F05 — Current Job status

Saved Jobs phản ánh Job hiện tại:

```text
PUBLISHED → đang tuyển nếu còn đủ điều kiện
CLOSED    → Đã đóng
EXPIRED   → Đã hết hạn
```

CLOSED/EXPIRED không auto-unsave.

---

## F06 — Has Application

Nếu tồn tại Application Candidate–Job:

```text
hasApplication = true
```

Saved Jobs không trả pipeline detail.

---

## F07 — Apply từ Saved Jobs

Apply dùng Direct Apply API hiện hữu.

Không có API Apply riêng cho Saved Jobs.

SavedJob vẫn tồn tại sau Apply.

---

## F08 — Inaccessible Job

Nếu Job không còn accessible/public cho Candidate:

```text
không trả Job đó trong GET Saved Jobs
```

Không leak Job qua bookmark.

---

## F09 — Hard delete cleanup

Trước khi hard delete Job:

```text
delete SavedJobs referencing Job
```

Không để orphan SavedJob.

---

## F10 — Idempotency và concurrency

### Save

```text
Save NOT_SAVED → create → success
Save SAVED     → no-op  → success
```

Concurrent Save:

```text
n request Save
→ tối đa 1 SavedJob
```

Unique conflict do race phải normalize thành success nếu record đã tồn tại.

### Unsave

```text
Unsave SAVED     → delete → success
Unsave NOT_SAVED → no-op  → success
```

### Save vs Unsave

Mỗi mutation phải atomic trên Candidate–Job relation.

Final state chỉ được là:

```text
SAVED
NOT_SAVED
```

---

# 9. Business Rules

1. Saved Jobs chỉ thuộc Candidate.
2. Candidate identity lấy từ authenticated context.
3. Candidate chỉ quản lý Saved Jobs của chính mình.
4. Saved Job không phải Application.
5. Apply không yêu cầu Save.
6. Candidate đã Apply vẫn được Save.
7. Apply thành công không auto-unsave.
8. Một Candidate–Job có tối đa một SavedJob.
9. Save idempotent.
10. Unsave idempotent.
11. Save lại không đổi `savedAt`.
12. Concurrent Save không được duplicate.
13. Saved Jobs sort theo `savedAt DESC`.
14. Không có sort bắt buộc khác.
15. Saved Job đọc current Job state.
16. CLOSED vẫn được giữ nếu historical-readable.
17. EXPIRED vẫn được giữ nếu historical-readable.
18. CLOSED/EXPIRED không được Apply.
19. Frontend state không bypass backend Apply validation.
20. Inaccessible Job không được expose.
21. Saved Job không lưu snapshot.
22. Saved Job và Application độc lập.
23. `hasApplication` chỉ cần existence.
24. Apply từ Saved Jobs vẫn là `DIRECT_APPLICATION`.
25. Application uniqueness vẫn giữ.
26. Saved Job không mutate Invitation.
27. Saved Job không tạo Conversation.
28. Saved Job không tạo Assignment.
29. Saved Job không tạo Notification.
30. Saved Job không chặn hard delete.
31. Hard delete phải cleanup Saved Jobs.
32. Không để orphan SavedJob.
33. Không có Saved Job history/audit bắt buộc.
34. Không giới hạn số Saved Jobs trong V16.
35. Không dùng Saved Jobs làm recommendation semantics trong V16.

---

# 10. Authorization và Ownership

| Hành động | Actor | Scope |
| --- | --- | --- |
| Save Job | Candidate | Candidate hiện tại + Job accessible |
| Unsave Job | Candidate | Saved relation của chính Candidate |
| Xem Saved Jobs | Candidate | Saved Jobs của chính Candidate |
| Xem `isSaved` | Candidate | Candidate hiện tại + Job |
| Apply từ Saved Jobs | Candidate | Direct Apply hiện hữu |
| Quản lý Saved Jobs người khác | Không actor nào | Không cho phép |

Recruiter, Company Manager và Platform Admin không có Saved Jobs capability trong V16.

---

# 11. Privacy Boundary

Candidate A và Candidate B có thể Save cùng một Job nhưng không được thấy Saved relation của nhau.

V16 không expose:

- save count cho Company;
- Candidate list đã Save Job;
- recruitment signal cho Recruiter;
- analytics từ Saved Jobs.

---

# 12. API Contract

## API-V16-01 — Save Job

```http
PUT /api/candidate/saved-jobs/:jobId
```

### Success

```json
{
  "message": "Job saved successfully.",
  "saved": true,
  "savedAt": "ISO-8601"
}
```

Save lại Job đã Saved:

- vẫn success;
- không duplicate;
- không đổi `savedAt`.

---

## API-V16-02 — Unsave Job

```http
DELETE /api/candidate/saved-jobs/:jobId
```

### Success

```json
{
  "message": "Job unsaved successfully.",
  "saved": false
}
```

Unsave Job chưa Saved vẫn success.

---

## API-V16-03 — List Saved Jobs

```http
GET /api/candidate/saved-jobs
```

### Minimum response item

```json
{
  "job": {
    "id": "...",
    "title": "...",
    "company": {
      "id": "...",
      "name": "...",
      "logoUrl": "..."
    },
    "location": {},
    "employmentType": "...",
    "workModes": [],
    "salaryText": "...",
    "status": "PUBLISHED",
    "publishedAt": "...",
    "applicationDeadline": "..."
  },
  "savedAt": "ISO-8601",
  "hasApplication": false
}
```

Các field Job/Company phải dùng naming phù hợp với canonical projection/backend hiện tại.

### Sort

```text
savedAt DESC
```

### Search / Filter / Sort selection

Không hỗ trợ trong V16.

---

# 13. Integration với Job Discovery và Job Detail

Chốt dùng Candidate-aware enrichment.

Khi Candidate authenticated dùng Find Jobs / Job Detail:

```json
{
  "isSaved": true
}
```

hoặc:

```json
{
  "isSaved": false
}
```

Không tạo N+1 API riêng từ frontend để check từng Job.

Implementation phải reuse existing Job Discovery/public visibility resolver.

---

# 14. Integration với Direct Apply

Apply từ Saved Jobs không có endpoint mới.

Dùng Direct Apply API hiện hữu của backend.

Sau Apply:

```text
Application được tạo
SavedJob vẫn tồn tại
hasApplication = true
```

V16 không thay đổi Direct Apply validation.

---

# 15. Integration với Hard Delete Job

Không tạo Job deletion flow riêng cho V16.

Phải tích hợp vào existing Job hard-delete service.

Flow:

```text
Existing hard-delete eligibility
        ↓
Delete SavedJobs referencing Job
        ↓
Delete Job
```

Cleanup phải được thực hiện trong cùng consistency boundary phù hợp với backend hiện tại.

---

# 16. HTTP Policy

| Scenario | HTTP |
| --- | ---: |
| Save thành công / đã Saved sẵn | `200` |
| Unsave thành công / chưa Saved sẵn | `200` |
| List thành công | `200` |
| Invalid input/path | `400` |
| Chưa authenticated | `401` |
| Actor không phải Candidate | `403` |
| Job không tồn tại / inaccessible | `404` |
| Unexpected server error | `500` |

Error envelope phải reuse project-wide error contract.

---

# 17. Implementation Decisions for Current Backend

Các quyết định sau được chốt để coding agent không phải tự suy diễn.

## 17.1. Model

```text
SavedJob
```

Fields:

```text
candidateUserId
jobId
savedAt
```

## 17.2. Indexes

Bắt buộc:

```text
UNIQUE(candidateUserId, jobId)
```

Khuyến nghị:

```text
INDEX(candidateUserId, savedAt DESC)
```

## 17.3. Pagination

V16 không bắt buộc business pagination.

Nếu backend hiện tại đã có standard pagination helper thì được phép reuse.

Không tự thiết kế pagination contract mới khác convention của project.

## 17.4. Save state integration

Chốt:

```text
Option A — Candidate-aware enrichment
```

Job Discovery / Job Detail trả `isSaved` cho Candidate authenticated.

## 17.5. Visibility

Không implement visibility rule mới.

Phải reuse existing Job Discovery/public/historical visibility logic.

## 17.6. Inaccessible Job persistence

Không auto-delete SavedJob chỉ vì Job tạm thời inaccessible.

Chỉ filter khỏi public Saved Jobs response.

## 17.7. Hard delete

Phải cleanup SavedJobs trong existing Job hard-delete flow trước khi delete Job.

## 17.8. Error handling

Reuse:

- auth middleware;
- role middleware;
- validation helpers;
- project error classes;
- response/error envelope hiện tại.

Không tạo error framework riêng cho V16.

## 17.9. Project structure

Follow current backend conventions:

```text
model
service
controller
route
test
```

Không tự thay đổi architecture.

## 17.10. Scope control

Không thêm:

- notification;
- recommendation;
- analytics;
- search/filter Saved Jobs;
- new Application source;
- snapshot;
- audit history;
- quota.

---

# 18. Acceptance Tests

Agent phải bổ sung test tối thiểu cho các case sau.

## Save

- Save Job mới.
- Save Job đã Saved.
- Save lại không đổi `savedAt`.
- Concurrent Save không duplicate.
- Save inaccessible Job bị reject.
- Candidate A không ảnh hưởng Candidate B.
- Recruiter/Company Manager/Platform Admin không dùng được Saved Jobs.

## Unsave

- Unsave Job đang Saved.
- Unsave Job chưa Saved vẫn success.
- Unsave không mutate Application.
- Unsave không mutate Invitation.

## List

- List chỉ trả Saved Jobs của current Candidate.
- Sort `savedAt DESC`.
- `PUBLISHED` được trả.
- `CLOSED` được giữ nếu historical-readable.
- `EXPIRED` được giữ nếu historical-readable.
- Inaccessible Job không được trả.
- Empty list trả success.
- `hasApplication = false` khi chưa Apply.
- `hasApplication = true` khi đã có Application.

## Job Discovery / Detail

- Candidate authenticated nhận đúng `isSaved`.
- Save/Unsave làm `isSaved` thay đổi đúng.
- Actor khác không nhận Candidate-specific Saved state.

## Direct Apply

- Apply từ Saved Jobs dùng Direct Apply hiện hữu.
- Application được tạo đúng source/status.
- SavedJob không bị delete.
- List sau Apply trả `hasApplication = true`.
- Không tạo Application thứ hai.

## Hard delete

- Job đủ điều kiện hard delete cleanup toàn bộ SavedJobs.
- Không còn orphan SavedJob.
- Existing Application/Invitation hard-delete guards không bị nới lỏng.

---

# 19. Definition of Completion

V16 được coi là hoàn thành khi:

- Save hoạt động idempotent.
- Unsave hoạt động idempotent.
- Candidate–Job uniqueness được bảo đảm tại DB.
- Concurrent Save không tạo duplicate.
- Candidate chỉ thấy Saved Jobs của mình.
- Saved Jobs sort `savedAt DESC`.
- Current Job state được phản ánh đúng.
- CLOSED/EXPIRED được xử lý đúng historical visibility.
- Inaccessible Job không bị leak.
- `hasApplication` đúng.
- Apply từ Saved Jobs dùng Direct Apply hiện hữu.
- Apply không auto-unsave.
- Job Discovery / Job Detail có Candidate-specific `isSaved`.
- Hard delete cleanup SavedJobs.
- Không để orphan SavedJob.
- Không phá Application uniqueness.
- Không thay đổi Invitation semantics.
- Không tạo side effect ngoài phạm vi V16.
- Toàn bộ test mới và test regression hiện hữu pass.

---

# 20. Final Boundary

```text
V16 — Saved Jobs
│
├── Candidate Save State
│   ├── Save
│   ├── Unsave
│   └── Idempotency / Concurrency
│
├── Saved Jobs List
│   ├── Current Job State
│   ├── savedAt DESC
│   └── Has Application
│
├── Job Discovery Integration
│   └── isSaved
│
├── Direct Apply Integration
│   └── vẫn dùng DIRECT_APPLICATION
│
└── Lifecycle Integration
    ├── CLOSED / EXPIRED vẫn giữ Saved Job
    ├── Inaccessible Job không public
    └── Hard delete cleanup Saved Jobs
```

Business truth cuối cùng:

```text
Saved Job
= Candidate bookmark
≠ Application
≠ Invitation
≠ Pipeline
```
