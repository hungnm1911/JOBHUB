# V15 — Job Invitation và nhánh Recruiter săn ứng viên

> **File:** `docs/product/versions/v15-job-invitation-recruiter-sourcing.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V15.

---

## 1. Mục tiêu

V15 bổ sung nhánh tuyển dụng trong đó **Recruiter chủ động tìm Candidate thông qua Candidate Search và gửi Job Invitation dựa trên một Candidate CV cụ thể**.

V15 là cầu nối giữa:

```text
V14 — Candidate Search
↓
Job Invitation
↓
Candidate Accept
↓
Application
↓
Recruitment lifecycle hiện có
```

Sau khi V15 hoàn thành, hệ thống phải hỗ trợ được luồng:

```text
Recruiter hợp lệ
↓
Tìm và Preview một Candidate CV qua V14
↓
Chọn một Job hợp lệ
↓
Gửi Job Invitation
↓
Candidate Accept hoặc Reject
↓
Nếu Accept
→ tạo Application nguồn RECRUITER_INVITATION
→ Application bắt đầu trực tiếp tại CONTACTED
→ Recruiter gửi Invitation là Assigned Recruiter ban đầu
→ tạo Conversation
→ mở ngay Candidate Availability flow
→ từ đó tiếp tục sử dụng lifecycle Application hiện có
```

V15 không tạo một Recruitment Pipeline mới.

Hai nhánh tuyển dụng nhập lại tại `Application` nhưng có hai entry point khác nhau:

```text
DIRECT_APPLICATION
→ Application bắt đầu tại APPLIED
```

và:

```text
RECRUITER_INVITATION
→ Candidate Accept Invitation
→ Application bắt đầu trực tiếp tại CONTACTED
```

---

## 2. Phạm vi

### 2.1. Trong phạm vi

V15 bao gồm:

* bắt đầu hành động Job Invitation từ một Candidate CV cụ thể được tìm qua Candidate Search;
* chọn Job sau khi đã chọn Candidate CV;
* kiểm tra quyền hiện tại của Recruiter đối với Job được chọn;
* kiểm tra lại Candidate CV theo eligibility canonical của V14 tại thời điểm gửi;
* kiểm tra Candidate là owner của Candidate CV được chọn;
* tạo Job Invitation;
* lưu ngữ cảnh bất biến của Candidate CV tại thời điểm gửi Invitation;
* lời chào tùy chọn của Recruiter trong Invitation;
* lifecycle Job Invitation:

  * `PENDING`;
  * `ACCEPTED`;
  * `REJECTED`;
  * `REVOKED`;
  * `EXPIRED`;
  * `INVALIDATED`;
* Candidate xem Invitation của chính mình;
* Candidate Accept hoặc Reject Invitation;
* current Primary Recruiter quản lý Invitation thuộc Job;
* current Primary Recruiter Revoke Invitation đang `PENDING`;
* tự hết hạn Invitation;
* làm Invitation hết hạn khi Job đóng hoặc hết thời gian nhận hồ sơ;
* chủ động invalidate Invitation khi điều kiện nghiệp vụ cần thiết không còn hợp lệ;
* chống nhiều Invitation `PENDING` cho cùng Candidate–Job;
* kiểm soát việc gửi lại Invitation theo terminal state trước đó;
* chặn Direct Apply khi cùng Candidate–Job đang có Invitation `PENDING`;
* giữ invariant một Candidate–Job có tối đa một Application;
* Accept tạo Application nguồn `RECRUITER_INVITATION`;
* Application nguồn Invitation bắt đầu trực tiếp tại `CONTACTED`;
* Recruiter gửi Invitation là Assigned Recruiter ban đầu;
* giữ lại thông tin Recruiter thực sự đã gửi Invitation để phục vụ truy vết nguồn tuyển dụng về sau;
* sử dụng Candidate CV snapshot tại thời điểm gửi Invitation làm submitted CV của Application sau Accept;
* tạo Conversation sau Accept;
* tự động mở Candidate Availability flow sau Accept;
* tích hợp Notification và realtime cho Job Invitation trên foundation V13;
* bảo đảm Notification không trở thành source of truth của Invitation;
* giữ lịch sử Invitation sau khi Invitation kết thúc.

### 2.2. Ngoài phạm vi

V15 không bao gồm:

* keyword search Candidate CV;
* full-text search Candidate CV;
* AI matching giữa Candidate CV và Job;
* Candidate recommendation;
* tự động xác định Candidate phù hợp Job nào;
* bắt Recruiter chọn Job trước khi sử dụng Candidate Search;
* Download CV qua Candidate Search;
* Direct Message trước Application;
* Conversation trước Candidate Accept;
* Chat trước Candidate Accept;
* tạo Application ngay khi gửi Invitation;
* Recruitment Pipeline riêng cho Invitation;
* cho Candidate đổi Candidate CV khi Accept;
* Replace submitted CV đối với Application nguồn Invitation;
* Candidate Withdraw đối với Application nguồn Invitation;
* chỉnh sửa lời chào sau khi Invitation đã gửi;
* yêu cầu hoặc lưu lý do Reject;
* cấu hình thời hạn Invitation bởi Recruiter;
* gia hạn Invitation;
* audit timeline riêng cho Job Invitation;
* business event history riêng chỉ để theo dõi lifecycle Job Invitation;
* Application status history mới chỉ vì V15;
* Assignment history mới chỉ vì V15;
* sourcing KPI;
* sourcing report;
* sourcing dashboard;
* thống kê hiệu suất Recruiter gửi Invitation;
* Notification khi Invitation chuyển `EXPIRED`;
* Candidate self-notification chỉ để xác nhận chính Candidate vừa Accept;
* mở Candidate Search cho Company Manager;
* Company Manager gửi hoặc Revoke Job Invitation.

Không suy diễn hoặc tự bổ sung chức năng ngoài phạm vi đã được chốt.

---

## 3. Dependency với các version trước

V15 kế thừa các business concept và invariant đã tồn tại, đặc biệt:

* V01 — Authentication;
* V01 — `User` và account lifecycle;
* V02 — Company lifecycle và trạng thái hoạt động;
* V03 — Recruiter membership trong Company;
* V05 — Job lifecycle;
* V05 — nội dung Job bất biến sau khi Job được publish;
* V05 — Job đã publish được giữ lại làm dữ liệu lịch sử;
* V05 — Job `CLOSED` / `EXPIRED` và `applicationDeadline`;
* V06 — Recruitment Team;
* V06 — Primary Recruiter;
* V06 — Supporting Recruiter;
* V07 — Candidate CV Library;
* V07 — Generated CV lifecycle;
* V07 — Uploaded CV lifecycle;
* V07 — `PUBLIC` / `PRIVATE`;
* V07 — Archive Candidate CV;
* V09 — Direct Application;
* V09 — submitted CV snapshot;
* V09 — Candidate–Job Application uniqueness;
* V09 — Candidate Replace / Withdraw boundary;
* V10 — Assignment;
* V10 — current Assigned Recruiter;
* V10 — Recruitment Pipeline;
* V10 — `CONTACTED`;
* V11 — Conversation thuộc Application;
* V11 — Chat authorization theo current Assigned Recruiter;
* V12 — Candidate Availability;
* V12 — Availability flow được mở khi Application đạt `CONTACTED`;
* V12 — Interview Schedule;
* V13 — durable Notification;
* V13 — Notification read state;
* V13 — eventual recovery và deduplication;
* V13 — realtime delivery;
* V13 — offline/reconnect resync;
* V14 — Candidate Search;
* V14 — Recruiter Candidate Search eligibility;
* V14 — Candidate CV search eligibility;
* V14 — Search/Preview current-state authorization.

V15 chủ động bổ sung Job Invitation Notification vào infrastructure Notification của V13.

V13 trước đó không sở hữu Job Invitation business behavior.

V15 không được làm thay đổi invariant của các version trước trừ các extension được tài liệu này ghi rõ.

Các extension chủ động của V15 gồm:

1. Direct Apply bổ sung precondition mới:

   ```text
   Candidate–Job có Invitation PENDING
   → không được Direct Apply
   ```

2. Application nguồn `RECRUITER_INVITATION` có entry point mới:

   ```text
   none → CONTACTED
   ```

   thay vì phải đi qua `APPLIED` hoặc `SCREENING`.

3. Việc Application nguồn Invitation được tạo trực tiếp tại `CONTACTED` tự động mở Availability flow kế thừa V12.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Candidate

Candidate là người:

* sở hữu Candidate CV;
* nhận Job Invitation;
* xem Invitation thuộc chính mình;
* Accept hoặc Reject Invitation còn hợp lệ;
* trở thành Candidate owner của Application nếu Accept thành công.

Candidate không được tự thay Candidate CV của Invitation khi Accept.

---

### 4.2. Recruiter gửi Invitation

Recruiter gửi Invitation là Recruiter thực tế thực hiện hành động gửi Job Invitation.

Recruiter này phải là current:

* Primary Recruiter; hoặc
* Supporting Recruiter

của Job được chọn tại thời điểm gửi.

Danh tính người gửi phải tiếp tục được giữ lại làm **historical sourcing attribution**.

Việc từng gửi Invitation không tự tạo quyền lâu dài đối với Application.

---

### 4.3. Primary Recruiter

Primary Recruiter là current Primary của Job theo Recruitment Team hiện tại.

Trong V15, current Primary Recruiter là actor quản lý lifecycle Invitation của Job.

Primary Recruiter có thể:

* xem lịch sử Invitation thuộc Job mà mình hiện là Primary;
* quản lý các Invitation đó;
* Revoke một Invitation `PENDING`, kể cả Invitation do Supporting Recruiter gửi.

Quyền này đến từ current Primary relationship với Job, không đến từ việc Primary có phải sender hay không.

---

### 4.4. Supporting Recruiter

Supporting Recruiter có thể gửi Invitation khi đang là Supporting hợp lệ của Job.

Supporting Recruiter không trở thành owner hoặc manager của Invitation chỉ vì mình là sender.

Supporting Recruiter không có Invitation-detail authority riêng trong V15.

Thông tin về các business outcome liên quan đến Invitation do Supporting gửi được phân phối theo Notification rules của V15.

---

### 4.5. Job Invitation

Job Invitation là lời mời của Recruiter dành cho Candidate tham gia quy trình tuyển dụng của một Job cụ thể dựa trên một Candidate CV cụ thể.

Invitation tồn tại trước Application.

```text
Invitation PENDING
≠ Application
```

Invitation chỉ tạo Application khi Candidate Accept thành công.

---

### 4.6. Invited CV Snapshot

Invited CV Snapshot là nội dung bất biến của Candidate CV được Recruiter chọn, được ghi nhận tại thời điểm Invitation được gửi thành công.

Snapshot này thể hiện đúng CV mà Recruiter dùng làm cơ sở gửi Invitation.

Snapshot không thay đổi khi Candidate chỉnh sửa CV gốc sau đó.

---

### 4.7. Invitation Sender Attribution

Invitation Sender Attribution là thông tin lịch sử cho biết Recruiter nào đã thực sự tìm và gửi Invitation dẫn tới nhánh tuyển dụng này.

Attribution:

* phải được giữ lại;
* không thay đổi do Application Reassign;
* không tự tạo read/write authority trên Application;
* có thể được sử dụng bởi các version sau cho sourcing statistics.

---

### 4.8. Assigned Recruiter

Assigned Recruiter là Recruiter hiện chịu trách nhiệm xử lý Application theo canonical V10.

Khi Candidate Accept Invitation:

```text
Assigned Recruiter ban đầu
=
Recruiter gửi Invitation
```

Sau đó Assignment lifecycle hiện có được áp dụng bình thường.

---

### 4.9. Actionable Invitation

Invitation chỉ actionable khi:

```text
status = PENDING
AND
chưa đạt điều kiện EXPIRED
AND
chưa xuất hiện điều kiện INVALIDATED
```

Persisted `PENDING` không tự chứng minh Invitation vẫn actionable nếu authoritative business state đã thay đổi.

---

## 5. Quan hệ nghiệp vụ chính

Luồng Candidate Search:

```text
Recruiter
↓
Candidate Search
↓
Candidate CV cụ thể
```

Luồng Invitation:

```text
Candidate
   │
   │ sở hữu
   ↓
Candidate CV
   │
   │ được chọn để mời
   ↓
Job Invitation
   │
   ├── Job
   ├── Recruiter gửi
   └── Invited CV Snapshot
```

Luồng sau Accept:

```text
Job Invitation
   │
   │ ACCEPTED
   ↓
Application
   │
   ├── source = RECRUITER_INVITATION
   ├── status ban đầu = CONTACTED
   ├── Assigned Recruiter ban đầu = sender
   └── Submitted CV Snapshot = Invited CV Snapshot
   ↓
Conversation
```

Hai nhánh tuyển dụng:

```text
Candidate Direct Apply
↓
Application
source = DIRECT_APPLICATION
status ban đầu = APPLIED
```

và:

```text
Recruiter Invitation
↓
Candidate Accept
↓
Application
source = RECRUITER_INVITATION
status ban đầu = CONTACTED
```

Hai nhánh nhập lại tại Application.

Invitation không tạo một Pipeline song song.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Job Invitation Status

Các trạng thái:

* `PENDING`
* `ACCEPTED`
* `REJECTED`
* `REVOKED`
* `EXPIRED`
* `INVALIDATED`

| Trạng thái    | Ý nghĩa                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `PENDING`     | Invitation đang chờ Candidate phản hồi và chưa có terminal outcome                                      |
| `ACCEPTED`    | Candidate đã Accept thành công và Application nguồn Invitation đã được tạo                              |
| `REJECTED`    | Candidate đã chủ động từ chối Invitation                                                                |
| `REVOKED`     | current Primary Recruiter đã chủ động thu hồi Invitation                                                |
| `EXPIRED`     | Invitation không còn cơ hội phản hồi do thời hạn Invitation hoặc recruitment window của Job đã kết thúc |
| `INVALIDATED` | Invitation mất hiệu lực do một eligibility/business relationship bắt buộc không còn hợp lệ              |

Các trạng thái:

```text
ACCEPTED
REJECTED
REVOKED
EXPIRED
INVALIDATED
```

là terminal.

Không state nào trong số này quay lại `PENDING`.

---

### 6.2. Application Entry State theo source

V15 xác định hai entry point:

| Application source     | Entry status |
| ---------------------- | ------------ |
| `DIRECT_APPLICATION`   | `APPLIED`    |
| `RECRUITER_INVITATION` | `CONTACTED`  |

Application nguồn `RECRUITER_INVITATION` chưa từng tồn tại ở:

* `APPLIED`;
* `SCREENING`.

Không tạo transition giả để mô phỏng hai trạng thái này.

---

### 6.3. Invitation PENDING và current state

`PENDING` không phải bằng chứng duy nhất rằng Invitation vẫn actionable.

Ví dụ:

```text
Invitation.status = PENDING
```

nhưng nếu Job đã đóng trước đó thì business outcome phải được coi là:

```text
EXPIRED
```

Nếu sender đã mất eligibility trước đó thì Invitation phải được coi là:

```text
INVALIDATED
```

Các action Accept, Reject hoặc Revoke phải tôn trọng authoritative state hiện tại.

---

## 7. Tổ hợp trạng thái hợp lệ

Các tổ hợp chính:

| Invitation    | Application cùng Candidate–Job         | Ý nghĩa                                                                    |
| ------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `PENDING`     | Không có                               | Invitation đang chờ phản hồi                                               |
| `ACCEPTED`    | Có, nguồn `RECRUITER_INVITATION`       | Accept đã tạo Application                                                  |
| `REJECTED`    | Không có Application từ Invitation này | Candidate đã từ chối; Candidate có thể Direct Apply sau đó nếu V9 cho phép |
| `REVOKED`     | Không có Application từ Invitation này | Invitation bị Primary thu hồi                                              |
| `EXPIRED`     | Không có Application từ Invitation này | Invitation hết hiệu lực                                                    |
| `INVALIDATED` | Không có Application từ Invitation này | Invitation mất eligibility                                                 |

Một Invitation `REJECTED`, `REVOKED`, `EXPIRED` hoặc `INVALIDATED` có thể tồn tại lịch sử đồng thời với một Direct Application được Candidate tạo **sau đó**, nếu Direct Apply vẫn hợp lệ.

Một Candidate–Job có thể có nhiều Invitation lịch sử trong trường hợp các Invitation cũ là:

* `EXPIRED`;
* `REVOKED`;
* `INVALIDATED`.

Nhưng:

```text
Candidate + Job
→ tối đa một Invitation PENDING
```

và:

```text
Candidate + Job
→ tối đa một Application
```

---

## 8. Quy trình nghiệp vụ tổng thể

```text
Recruiter sử dụng Candidate Search V14
↓
Tìm / lọc / Preview một Candidate CV cụ thể
↓
Recruiter chọn gửi Job Invitation
↓
Recruiter chọn Job mình hiện là Primary hoặc Supporting
↓
Hệ thống kiểm tra lại Recruiter / Company / Recruitment Team / Job
↓
Hệ thống kiểm tra lại Candidate CV theo V14 eligibility
↓
Xác nhận Candidate là owner của Candidate CV
↓
Kiểm tra Candidate–Job chưa có Application
↓
Kiểm tra không có Invitation PENDING
↓
Kiểm tra không có REJECTED Invitation chặn resend
↓
Ghi nhận Candidate CV snapshot
↓
Tạo Invitation PENDING
↓
Candidate nhận Notification
↓
Candidate xem Invitation
↓
┌───────────────────────────────────────────┐
│ Candidate Accept                         │
│ Candidate Reject                         │
│ Primary Revoke                           │
│ Invitation Expire                        │
│ Invitation Invalidated                   │
└───────────────────────────────────────────┘
```

Nếu `ACCEPTED`:

```text
Invitation PENDING
↓
Candidate Accept
↓
Tạo Application
source = RECRUITER_INVITATION
status = CONTACTED
Assigned Recruiter = sender
Submitted CV = invited snapshot
↓
Tạo Conversation
↓
Mở Availability flow
↓
Invitation ACCEPTED
↓
Application lifecycle hiện có tiếp quản hoàn toàn
```

---

# 9. Functional Requirements

## F01 — Bắt đầu Job Invitation từ Candidate Search

### Actor

* Recruiter.

### Mục tiêu

Cho phép Recruiter hợp lệ bắt đầu nhánh săn ứng viên từ một Candidate CV cụ thể đã được khám phá thông qua Candidate Search.

### Tiền điều kiện

* Recruiter đã được xác thực.
* Recruiter còn hợp lệ trong Company.
* Candidate CV được chọn phải xác định được cụ thể.
* Recruiter phải chọn Job sau khi đã chọn Candidate CV.

### Luồng chính

1. Recruiter tìm hoặc Preview một Candidate CV qua Candidate Search.
2. Recruiter chọn hành động gửi Job Invitation.
3. Recruiter chọn một Job mình hiện là Primary hoặc Supporting.
4. Hệ thống đánh giá lại current business state trước khi cho phép gửi.

### Kết quả

Recruiter có thể đi tiếp tới F02 khi Candidate CV, Candidate, Job và Recruiter đều hợp lệ.

### Trường hợp từ chối

Từ chối khi:

* Recruiter không còn đủ quyền;
* Recruiter không còn thuộc Recruitment Team của Job;
* Job không còn nhận Invitation;
* Candidate CV không còn đáp ứng send eligibility;
* Candidate không phải owner của Candidate CV được chọn.

### Business Rules liên quan

* `BR-03`–`BR-12`

### Không thuộc chức năng này

* Job-to-CV matching;
* AI recommendation;
* tự chọn Job thay Recruiter.

---

## F02 — Gửi Job Invitation

### Actor

* Recruiter đang là current Primary hoặc Supporting của Job.

### Mục tiêu

Tạo một Job Invitation dựa trên đúng Candidate CV mà Recruiter đã chọn.

### Tiền điều kiện

* F01 đã thỏa mãn.
* Candidate–Job chưa từng có Application.
* Không có Invitation `PENDING` cho cùng Candidate–Job.
* Candidate–Job không bị chặn resend bởi một Invitation `REJECTED`.
* Job vẫn ở recruitment window hợp lệ.

### Luồng chính

1. Re-check current Recruiter eligibility.
2. Re-check current Company state.
3. Re-check current Recruitment Team relationship.
4. Re-check Job state và recruitment window.
5. Re-check Candidate CV theo V14 eligibility.
6. Xác nhận Candidate ownership của CV.
7. Kiểm tra Application và Invitation history của Candidate–Job.
8. Ghi nhận snapshot của Candidate CV.
9. Ghi nhận lời chào nếu Recruiter cung cấp.
10. Tạo Invitation ở `PENDING`.
11. Phát sinh durable Notification obligation cho Candidate.

### Kết quả

* Một Invitation `PENDING` tồn tại.
* Invited CV snapshot phản ánh đúng CV tại thời điểm gửi.
* Không tạo Application.
* Không tạo Conversation.
* Không tạo Message.
* Không tạo Chat authority.

### Trường hợp từ chối

Từ chối nếu bất kỳ required business condition nào không còn đúng.

### Business Rules liên quan

* `BR-04`–`BR-23`
* `BR-48`
* `BR-56`

### Không thuộc chức năng này

* Application creation;
* Candidate pipeline;
* Chat.

---

## F03 — Candidate xem Job Invitation

### Actor

* Candidate owner của Invitation.

### Mục tiêu

Cho phép Candidate xem các Invitation thuộc chính mình và hiểu current state của từng Invitation.

### Tiền điều kiện

* Candidate đã được xác thực.
* Invitation thuộc Candidate.

### Luồng chính

Candidate có thể xem các thông tin nghiệp vụ của Invitation, bao gồm:

* Job;
* Company của Job;
* Recruiter đã gửi Invitation;
* lời chào nếu có;
* Candidate CV snapshot được dùng để mời;
* thời điểm gửi;
* thời hạn phản hồi;
* current Invitation status.

Invitation terminal vẫn có thể xuất hiện trong lịch sử Candidate.

### Kết quả

Candidate thấy current state của Invitation.

Availability của các action:

```text
Accept
Reject
```

phải dựa trên authoritative Invitation state hiện tại, không dựa trên Notification cũ.

### Trường hợp từ chối

Candidate không được xem Invitation thuộc Candidate khác.

### Business Rules liên quan

* `BR-26`
* `BR-53`
* `BR-58`

### Không thuộc chức năng này

* sửa Invitation;
* đổi Candidate CV;
* Chat trước Accept.

---

## F04 — Candidate Accept Job Invitation

### Actor

* Candidate owner của Invitation.

### Mục tiêu

Cho phép Candidate đồng ý tham gia quy trình tuyển dụng và nhập trực tiếp vào Application lifecycle tại `CONTACTED`.

### Tiền điều kiện

Invitation phải:

* thuộc Candidate;
* còn `PENDING`;
* chưa `EXPIRED`;
* chưa có invalidating business condition xảy ra trước đó.

Đồng thời:

* Candidate vẫn đủ account eligibility;
* Company vẫn hợp lệ;
* sender vẫn đủ Invitation eligibility;
* Job vẫn còn recruitment window;
* Candidate–Job chưa có Application.

### Luồng chính

Accept thành công tạo một business outcome thống nhất:

1. Invitation chuyển `PENDING → ACCEPTED`.
2. Một Application nguồn `RECRUITER_INVITATION` được tạo.
3. Application bắt đầu trực tiếp tại `CONTACTED`.
4. Recruiter gửi Invitation trở thành Assigned Recruiter ban đầu.
5. Submitted CV của Application sử dụng invited CV snapshot đã được khóa từ lúc gửi.
6. Application được liên kết về mặt nghiệp vụ với source Invitation.
7. Conversation thuộc Application được tạo.
8. Candidate Availability flow được mở ngay.
9. Các Notification obligations của V15/V13 được phát sinh.

### Kết quả

```text
Invitation = ACCEPTED

Application:
source = RECRUITER_INVITATION
status = CONTACTED
assigned = invitation sender
```

Invitation lifecycle đã hoàn thành nhiệm vụ.

Từ thời điểm này, Application lifecycle hiện có tiếp quản.

### Trường hợp từ chối

Accept phải thất bại nếu authoritative current state đã làm Invitation hết hạn hoặc mất eligibility, kể cả persisted Invitation vẫn chưa kịp rời `PENDING`.

### Business Rules liên quan

* `BR-34`
* `BR-37`–`BR-47`
* `BR-49`
* `BR-54`
* `BR-55`

### Không thuộc chức năng này

* tạo fake `APPLIED`;
* tạo fake `SCREENING`;
* Candidate chọn CV khác;
* tạo pipeline Invitation riêng.

---

## F05 — Candidate Reject Job Invitation

### Actor

* Candidate owner của Invitation.

### Mục tiêu

Cho phép Candidate chủ động từ chối một Invitation đang còn actionable.

### Tiền điều kiện

* Invitation thuộc Candidate.
* Invitation còn actionable.

### Luồng chính

1. Candidate chọn Reject.
2. Authoritative current state được kiểm tra.
3. Invitation chuyển:

   ```text
   PENDING → REJECTED
   ```
4. Phát sinh Notification obligation cho Recruiter đã gửi Invitation.

### Kết quả

* Không tạo Application.
* Không tạo Conversation.
* Không tạo Chat authority.
* Candidate–Job không được gửi thêm Job Invitation trong tương lai.
* Candidate vẫn có thể Direct Apply Job đó sau này nếu canonical Direct Apply rules cho phép.

### Trường hợp từ chối

Không Reject Invitation terminal hoặc Invitation đã mất hiệu lực trước đó.

### Business Rules liên quan

* `BR-20`
* `BR-25`
* `BR-26`
* `BR-30`
* `BR-34`
* `BR-36`
* `BR-50`

### Không thuộc chức năng này

* reject reason;
* blacklist Candidate khỏi Direct Apply.

---

## F06 — Primary Recruiter quản lý và Revoke Invitation

### Actor

* Current Primary Recruiter của Job.

### Mục tiêu

Cho phép current Primary quản lý lifecycle Invitation thuộc Job.

### Tiền điều kiện

* Actor hiện là Primary của chính Job.
* Invitation thuộc Job đó.

### Luồng chính

Primary có thể xem lịch sử Invitation của Job, bao gồm Invitation do:

* chính Primary gửi;
* Supporting Recruiter gửi;
* Recruiter trước đó gửi khi còn đủ quyền.

Đối với Invitation còn actionable, Primary có thể Revoke:

```text
PENDING → REVOKED
```

### Kết quả

* Candidate không còn Accept hoặc Reject được Invitation.
* Candidate nhận Notification `JOB_INVITATION_REVOKED`.
* Không tạo Application.
* Có thể gửi Invitation mới sau này nếu toàn bộ current rules cho phép.

### Trường hợp từ chối

Không Revoke khi:

* actor không phải current Primary của Job;
* Invitation đã terminal;
* một terminal cause khác đã thực sự xảy ra trước đó.

### Business Rules liên quan

* `BR-24`
* `BR-27`
* `BR-28`
* `BR-34`
* `BR-51`

### Không thuộc chức năng này

* Supporting Recruiter quản lý lifecycle Invitation;
* Company Manager Revoke.

---

## F07 — Job Invitation Expiration

### Actor

* System / Job lifecycle.

### Mục tiêu

Làm Invitation mất hiệu lực khi recruitment window kết thúc.

### Luồng chính

Invitation `PENDING` chuyển `EXPIRED` khi terminal cause đầu tiên là một trong:

1. hết cuối ngày thứ 15 của Invitation;
2. Job đạt hoặc vượt application deadline;
3. Job chuyển `CLOSED`;
4. Job trở thành `EXPIRED`.

### Kết quả

```text
PENDING → EXPIRED
```

Candidate không còn Accept hoặc Reject.

Primary không còn Revoke Invitation này.

Không tạo Notification riêng chỉ vì Invitation `EXPIRED`.

Invitation mới có thể được gửi sau này nếu Job/Candidate/Recruiter hiện lại đáp ứng đầy đủ send rules.

### Business Rules liên quan

* `BR-21`
* `BR-23`–`BR-25`
* `BR-34`
* `BR-53`

---

## F08 — Invalidate Job Invitation

### Actor

* System / source business lifecycle.

### Mục tiêu

Thu hồi Invitation khi một business eligibility bắt buộc đã thay đổi.

### Các invalidating conditions

Invitation `PENDING` phải trở thành `INVALIDATED` khi xảy ra trước terminal outcome:

* Candidate không còn ACTIVE;
* Candidate không còn đáp ứng email verification;
* Candidate Archive Candidate CV được dùng để gửi Invitation;
* Company của Job không còn hoạt động hợp lệ;
* sender không còn ACTIVE;
* sender không còn Company membership hợp lệ;
* sender không còn là Primary hoặc Supporting của Job.

### Các thay đổi không invalidate

Không invalidate chỉ vì:

* Candidate sửa nội dung CV gốc;
* CV chuyển `PUBLIC → PRIVATE`;
* Generated CV sau đó không còn `ACTIVE`.

### Luồng chính

```text
PENDING
↓
invalidating condition xảy ra
↓
INVALIDATED
```

### Kết quả

* Invitation không tự hoạt động trở lại.
* Candidate không còn Accept hoặc Reject.
* Candidate và sender nhận `JOB_INVITATION_INVALIDATED`.
* Có thể gửi Invitation mới sau này nếu current conditions được khôi phục và các rule khác cho phép.

### Business Rules liên quan

* `BR-14`–`BR-16`
* `BR-21`
* `BR-31`–`BR-34`
* `BR-52`

---

## F09 — Direct Apply và chống xung đột Candidate–Job

### Actor

* Candidate;
* Recruiter.

### Mục tiêu

Giữ Candidate–Job chỉ có một recruitment entry path đang hoạt động tại một thời điểm và bảo toàn Application uniqueness của version trước.

### Rule chính

Nếu Candidate–Job có Invitation `PENDING`:

```text
Candidate không được Direct Apply cùng Job
```

Nếu Candidate–Job đã từng có Application:

```text
Recruiter không được gửi Job Invitation
```

Nếu Candidate từng `REJECTED` Invitation:

```text
Recruiter không được gửi Invitation mới
```

nhưng:

```text
Candidate vẫn có thể Direct Apply
```

nếu Direct Apply hiện hợp lệ.

Invitation lịch sử:

```text
EXPIRED
REVOKED
INVALIDATED
```

không tự chặn:

* Invitation mới; hoặc
* Direct Apply

nếu các current business conditions khác cho phép.

### Kết quả

Không tồn tại race business:

```text
Direct Apply vs Accept Invitation
```

cho cùng một Invitation `PENDING`.

### Business Rules liên quan

* `BR-18`–`BR-22`
* `BR-35`
* `BR-36`

---

## F10 — Giữ sourcing attribution và handoff sang Application

### Actor

* System.

### Mục tiêu

Bảo đảm hệ thống luôn truy vết được Recruiter nào thực sự đã gửi Invitation mà không tạo authorization song song với Application.

### Luồng chính

1. Invitation giữ danh tính sender.
2. Khi Accept, Application được xác định là có nguồn từ chính Invitation đó.
3. Sender trở thành Assigned Recruiter ban đầu.
4. Nếu Application được Reassign sau đó:

   * current Assigned Recruiter thay đổi theo V10;
   * sender attribution của Invitation không thay đổi.
5. Sender cũ không giữ Application authority chỉ vì là original sender.

### Kết quả

Có thể xác định:

```text
ai đã source Candidate
```

và độc lập xác định:

```text
ai đang xử lý Application
```

### Business Rules liên quan

* `BR-39`
* `BR-40`
* `BR-60`

### Không thuộc chức năng này

* KPI;
* sourcing leaderboard;
* report;
* dashboard.

---

## F11 — Notification và realtime cho Job Invitation

### Actor

* System.

### Mục tiêu

Tích hợp Job Invitation vào durable Notification/realtime foundation của V13.

### Logical Notifications

#### Khi Invitation được gửi

Candidate nhận:

```text
JOB_INVITATION_RECEIVED
```

#### Khi Candidate Accept

Sender nhận hai logical Notifications độc lập:

```text
JOB_INVITATION_ACCEPTED
```

và:

```text
INVITED_APPLICATION_CREATED
```

Candidate không nhận self-notification `JOB_INVITATION_ACCEPTED`.

Application creation này không phát sinh:

```text
APPLICATION_ASSIGNED
APPLICATION_STATUS_CHANGED
```

chỉ để mô phỏng các transition chưa từng xảy ra.

Candidate nhận Availability request theo existing flow:

```text
INTERVIEW_AVAILABILITY_REQUESTED
```

#### Khi Candidate Reject

Sender nhận:

```text
JOB_INVITATION_REJECTED
```

#### Khi Primary Revoke

Candidate nhận:

```text
JOB_INVITATION_REVOKED
```

#### Khi Invitation Invalidated

Candidate và sender nhận:

```text
JOB_INVITATION_INVALIDATED
```

#### Khi Invitation Expired

Không tạo Invitation Expired Notification.

### Durability

V15 phải kế thừa V13:

```text
business transition thành công
↓
required Notification phải eventually tồn tại
```

Notification materialization/delivery tạm thời thất bại không tự rollback successful Invitation/Application business outcome.

Required Notification phải được recover và deduplicate theo canonical V13.

### Realtime

Realtime:

* chỉ phân phối thông tin nhanh cho active sessions;
* không phải durable history;
* không phải Invitation state authority;
* không replay thay cho durable HTTP resync.

### Current-state UX

Một Notification lịch sử:

```text
JOB_INVITATION_RECEIVED
```

không chứng minh Invitation vẫn `PENDING`.

Khi Candidate mở hoặc thao tác từ Notification, current Invitation state phải được đánh giá lại.

### Business Rules liên quan

* `BR-48`–`BR-59`

---

# 10. Business Rules

## BR-01 — V15 là cầu nối Candidate Search → Application

V15 không tạo Recruitment Pipeline riêng.

Invitation chỉ là lớp trung gian trước khi Application được tạo.

---

## BR-02 — Invariant version trước được ưu tiên

V15 không được phá invariant của V01–V14 trừ extension được tài liệu này ghi rõ.

Đặc biệt Candidate–Job Application uniqueness tiếp tục có hiệu lực.

---

## BR-03 — Candidate Search tiếp tục độc lập với Job

Recruiter không cần chọn Job trước khi tìm hoặc Preview Candidate CV.

Job chỉ được chọn khi Recruiter bắt đầu hành động Job Invitation.

---

## BR-04 — Chỉ Recruiter hợp lệ được gửi Invitation

Candidate, Company Manager, Platform Admin và anonymous user không được gửi Job Invitation.

---

## BR-05 — Sender phải thuộc current Recruitment Team của Job

Tại thời điểm gửi, Recruiter phải là current:

* Primary; hoặc
* Supporting

của chính Job được chọn.

---

## BR-06 — Job phải còn recruitment window hợp lệ

Không được gửi Invitation cho Job:

* `DRAFT`;
* `PENDING_APPROVAL`;
* `CLOSED`;
* `EXPIRED`;
* hoặc đã đạt application deadline.

---

## BR-07 — Không có Job–CV compatibility rule tự động

V15 không xác định CV có phù hợp Job hay không.

Recruiter tự thực hiện đánh giá tuyển dụng.

---

## BR-08 — Invitation luôn bắt đầu từ một Candidate CV cụ thể

Không được tạo Invitation chỉ dựa trên Candidate mà không xác định Candidate CV.

---

## BR-09 — Candidate phải là owner của invited CV

Candidate nhận Invitation phải là owner của Candidate CV được dùng để gửi Invitation.

---

## BR-10 — Generated CV reuse nguyên V14 eligibility khi Send

Generated CV phải đang:

```text
ACTIVE
AND PUBLIC
AND chưa Archive
AND Candidate ACTIVE
AND Candidate verified email
```

tại thời điểm gửi.

---

## BR-11 — Uploaded CV reuse nguyên V14 eligibility khi Send

Uploaded CV phải:

```text
PUBLIC
AND chưa Archive
AND Candidate ACTIVE
AND Candidate verified email
```

Uploaded CV không bị invent requirement `ACTIVE/DRAFT`.

---

## BR-12 — Send luôn dựa trên current state

Kết quả Search/Preview cũ hoặc việc biết `cvId` không tạo quyền gửi Invitation.

---

## BR-13 — Snapshot được khóa tại thời điểm Send

Invited CV snapshot phản ánh đúng Candidate CV tại successful Send.

---

## BR-14 — Snapshot không đổi sau Send

Candidate chỉnh sửa CV gốc không làm invited snapshot thay đổi.

---

## BR-15 — PRIVATE hoặc Generated mất ACTIVE sau Send không invalidate

Sau successful Send:

```text
PUBLIC → PRIVATE
```

hoặc Generated CV không còn `ACTIVE` không làm Invitation mất hiệu lực.

Các thay đổi này có thể làm CV không còn Search/Preview-eligible nhưng không hủy snapshot đã hình thành.

---

## BR-16 — Archive làm PENDING Invitation INVALIDATED

Candidate Archive chính invited CV:

```text
PENDING → INVALIDATED
```

Invitation và snapshot lịch sử vẫn được giữ.

---

## BR-17 — V15 không có Candidate CV Delete lifecycle

V15 không bổ sung Soft Delete hoặc Hard Delete business lifecycle cho Candidate CV.

---

## BR-18 — Mỗi Candidate–Job tối đa một PENDING Invitation

Rule không phụ thuộc sender hoặc Candidate CV được chọn.

---

## BR-19 — Application đã tồn tại chặn Invitation mới

Nếu Candidate–Job đã từng có Application:

```text
không được tạo Job Invitation
```

kể cả Application đã terminal.

---

## BR-20 — REJECTED chặn future Job Invitation

Sau Candidate Reject, Company không được gửi Job Invitation khác cho cùng Candidate–Job.

---

## BR-21 — EXPIRED, REVOKED và INVALIDATED cho phép gửi Invitation mới

Invitation mới chỉ được tạo nếu toàn bộ current send conditions tại thời điểm đó đều hợp lệ.

Invitation cũ không được revive.

---

## BR-22 — ACCEPTED không được gửi lại vì Application đã tồn tại

Accept thành công tạo Application và Candidate–Job Application uniqueness tiếp tục áp dụng.

---

## BR-23 — Invitation hết hạn cuối ngày thứ 15

Mỗi Invitation có response window kết thúc vào cuối ngày thứ 15 kể từ ngày gửi, nếu chưa bị terminal sớm hơn.

Recruiter không cấu hình hoặc gia hạn thời hạn này.

---

## BR-24 — Job đóng hoặc hết recruitment window làm Invitation EXPIRED

Invitation `PENDING` trở thành `EXPIRED` khi:

* Job `CLOSED`;
* Job `EXPIRED`;
* hoặc application deadline đã tới.

---

## BR-25 — Terminal Invitation không quay lại PENDING

`ACCEPTED`, `REJECTED`, `REVOKED`, `EXPIRED`, `INVALIDATED` đều terminal.

---

## BR-26 — Candidate chỉ thao tác Invitation của chính mình

Candidate chỉ được xem, Accept hoặc Reject Invitation thuộc chính Candidate.

---

## BR-27 — Current Primary quản lý lifecycle Invitation theo Job

Current Primary được xem và quản lý Invitation thuộc Job mà mình hiện là Primary.

Primary được Revoke Invitation `PENDING` kể cả khi sender là Supporting Recruiter.

---

## BR-28 — Supporting không có Invitation management authority

Supporting có thể Send nhưng không có quyền quản lý hoặc Invitation-detail authority riêng chỉ vì là sender.

---

## BR-29 — Greeting thuộc Invitation và không được sửa sau Send

Greeting là nội dung tùy chọn.

Greeting:

* không phải Message;
* không tạo Conversation;
* không mở Chat;
* không được chỉnh sửa sau successful Send.

---

## BR-30 — Reject không yêu cầu reason

Candidate Reject không yêu cầu hoặc tạo business requirement lưu lý do Reject.

---

## BR-31 — Sender mất eligibility làm Invitation INVALIDATED

Invitation `PENDING` trở thành `INVALIDATED` nếu sender:

* không còn ACTIVE;
* mất Company membership hợp lệ;
* không còn là Primary hoặc Supporting của Job.

---

## BR-32 — Candidate mất account eligibility làm Invitation INVALIDATED

Candidate không còn ACTIVE hoặc không còn đáp ứng email verification:

```text
PENDING → INVALIDATED
```

---

## BR-33 — Company mất eligibility làm Invitation INVALIDATED

Company của Job không còn operational theo canonical Company lifecycle:

```text
PENDING → INVALIDATED
```

---

## BR-34 — Business cause xảy ra trước quyết định terminal outcome

Không được dùng stale persisted `PENDING` để bỏ qua một terminal cause đã thực sự xảy ra.

Nếu invalidating cause xảy ra trước Reject/Revoke/Accept thì outcome phải là `INVALIDATED`.

Nếu expiration cause xảy ra trước thì outcome phải là `EXPIRED`.

Nếu một terminal transition hợp lệ đã hoàn thành trước khi cause khác xuất hiện thì terminal state đó được giữ.

---

## BR-35 — PENDING Invitation chặn Direct Apply

Từ V15:

```text
Candidate + Job có PENDING Invitation
→ Candidate không được Direct Apply cùng Job
```

Đây là intentional extension của Direct Apply.

---

## BR-36 — Terminal Invitation không khóa Direct Apply chỉ vì Invitation

`REJECTED`, `REVOKED`, `EXPIRED` hoặc `INVALIDATED` không tự chặn Candidate Direct Apply.

Direct Apply vẫn phải đáp ứng toàn bộ canonical V9 rules.

---

## BR-37 — Accept tạo Application trực tiếp tại CONTACTED

Application nguồn Invitation được tạo:

```text
source = RECRUITER_INVITATION
status = CONTACTED
```

---

## BR-38 — Hai nguồn Application có hai entry point khác nhau

```text
DIRECT_APPLICATION
→ APPLIED
```

```text
RECRUITER_INVITATION
→ CONTACTED
```

---

## BR-39 — Sender là Assigned Recruiter ban đầu

Recruiter gửi Invitation trở thành Assigned Recruiter ban đầu khi Candidate Accept.

Điều này áp dụng cả khi sender là Supporting Recruiter.

---

## BR-40 — Sender attribution không tạo Application authority vĩnh viễn

Sau Reassign:

```text
original invitation sender
≠
current Assigned Recruiter
```

Original sender không giữ Application authority chỉ vì từng source Candidate.

---

## BR-41 — Submitted CV của Application dùng snapshot lúc Send

Application nguồn Invitation sử dụng chính invited CV snapshot đã được khóa tại thời điểm gửi.

Không đọc lại CV gốc để tạo submitted CV mới tại thời điểm Accept.

---

## BR-42 — Candidate không được đổi hoặc Replace CV

Candidate:

* không chọn CV khác khi Accept;
* không Replace submitted CV sau khi Application được tạo từ Invitation.

---

## BR-43 — Candidate không được Withdraw Application nguồn Invitation

Application nguồn Invitation đi trực tiếp vào `CONTACTED`.

Candidate không có Candidate Withdraw action đối với Application này.

---

## BR-44 — Conversation chỉ được tạo sau Accept

Không có Conversation khi Invitation còn `PENDING`.

Successful Accept tạo Conversation thuộc Application mới.

---

## BR-45 — Accept tự động mở Availability flow

Application nguồn Invitation được tạo trực tiếp tại `CONTACTED` và ngay lập tức đi vào existing V12 Candidate Availability request flow.

Recruiter không cần thực hiện thêm một action Request Availability riêng.

---

## BR-46 — Không tạo transition giả

Không mô phỏng:

```text
APPLIED → SCREENING
SCREENING → CONTACTED
UNASSIGNED → ASSIGNED
```

cho Application được sinh trực tiếp từ Invitation.

---

## BR-47 — Accept phải tạo một business outcome hoàn chỉnh

Không được tồn tại committed business state trong đó:

* Invitation `ACCEPTED` nhưng không có Application;
* Application nguồn Invitation tồn tại nhưng source Invitation chưa `ACCEPTED`;
* Application dùng sai Candidate CV snapshot;
* Application không có initial Assigned Recruiter là sender;
* Conversation bắt buộc của Application bị thiếu.

Notification delivery không thuộc điều kiện rollback này vì tuân thủ V13 eventual recovery.

---

## BR-48 — Send tạo JOB_INVITATION_RECEIVED cho Candidate

Successful Invitation creation tạo durable Notification obligation:

```text
JOB_INVITATION_RECEIVED
```

cho Candidate.

---

## BR-49 — Accept tạo hai logical Notifications cho sender

Successful Accept tạo:

```text
JOB_INVITATION_ACCEPTED
```

và:

```text
INVITED_APPLICATION_CREATED
```

cho Recruiter gửi Invitation.

Hai event mang hai semantic riêng.

---

## BR-50 — Reject thông báo sender

Successful Reject tạo:

```text
JOB_INVITATION_REJECTED
```

cho sender.

---

## BR-51 — Revoke thông báo Candidate

Successful Revoke tạo:

```text
JOB_INVITATION_REVOKED
```

cho Candidate.

---

## BR-52 — Invalidation thông báo Candidate và sender

Successful invalidation tạo:

```text
JOB_INVITATION_INVALIDATED
```

cho Candidate và sender.

---

## BR-53 — EXPIRED không tạo Notification riêng

Không tạo Job Invitation expiration Notification.

Candidate phải thấy current Invitation state khi đọc dữ liệu hiện tại.

Candidate cũng không nhận self-notification chỉ để xác nhận chính mình vừa Accept.

---

## BR-54 — Accept mở Availability Notification cho Candidate

Do Application được tạo trực tiếp tại `CONTACTED`, successful Accept mở V12 Availability flow và tạo existing V13 obligation:

```text
INTERVIEW_AVAILABILITY_REQUESTED
```

cho Candidate.

---

## BR-55 — Accept creation không tạo APPLICATION_ASSIGNED hoặc APPLICATION_STATUS_CHANGED

Không tạo:

```text
APPLICATION_ASSIGNED
APPLICATION_STATUS_CHANGED
```

chỉ để mô phỏng Application creation vốn đã bắt đầu tại:

```text
CONTACTED + assigned sender
```

Các Notification này chỉ áp dụng cho các actual transitions tương ứng sau đó.

---

## BR-56 — V15 Notification kế thừa durability V13

Successful business transition không rollback chỉ vì durable Notification chưa materialize được ngay.

Required Notification phải eventually tồn tại, được recover và không duplicate.

---

## BR-57 — Realtime chỉ là delivery

Realtime không phải:

* Invitation persistence;
* current Invitation state;
* business success authority.

Offline user phải lấy lại durable/current data bằng canonical read flows.

---

## BR-58 — Notification lịch sử không chứng minh Invitation còn actionable

Khi mở một Invitation từ Notification, current resource state và current authorization phải được đánh giá lại.

---

## BR-59 — Notification không thay đổi lifecycle authority

Job Invitation lifecycle được xác định bởi Job Invitation và authoritative source resources, không phải Notification state.

---

## BR-60 — Sourcing attribution phải được giữ nhưng statistics được defer

Hệ thống phải tiếp tục xác định được Recruiter nào đã gửi Invitation.

V15 không yêu cầu xây KPI/report/dashboard từ dữ liệu đó.

---

## BR-61 — Tenant authority luôn derive từ Job và current Company relationship

Recruiter không được tự chọn Company khác làm tenant authority cho Invitation.

---

# 11. State Transitions

## 11.1. Job Invitation

| Hành động / business cause   | Trước     | Sau           | Actor / nguồn                     |
| ---------------------------- | --------- | ------------- | --------------------------------- |
| Gửi Invitation thành công    | Không có  | `PENDING`     | Primary hoặc Supporting Recruiter |
| Candidate Accept             | `PENDING` | `ACCEPTED`    | Candidate owner                   |
| Candidate Reject             | `PENDING` | `REJECTED`    | Candidate owner                   |
| Current Primary Revoke       | `PENDING` | `REVOKED`     | Current Primary Recruiter         |
| Hết cuối ngày thứ 15         | `PENDING` | `EXPIRED`     | System/time lifecycle             |
| Job `CLOSED`                 | `PENDING` | `EXPIRED`     | Job lifecycle                     |
| Job `EXPIRED` / tới deadline | `PENDING` | `EXPIRED`     | Job lifecycle                     |
| Candidate mất eligibility    | `PENDING` | `INVALIDATED` | Candidate lifecycle               |
| Candidate Archive invited CV | `PENDING` | `INVALIDATED` | Candidate CV lifecycle            |
| Company mất eligibility      | `PENDING` | `INVALIDATED` | Company lifecycle                 |
| Sender mất eligibility/team  | `PENDING` | `INVALIDATED` | Recruiter/team lifecycle          |

Không có transition:

```text
ACCEPTED → *
REJECTED → *
REVOKED → *
EXPIRED → *
INVALIDATED → *
```

Invitation mới sau `EXPIRED`, `REVOKED` hoặc `INVALIDATED` là một business object mới, không phải transition về `PENDING`.

---

## 11.2. Application entry do V15 tạo

| Hành động             | Trước                | Sau                           | Actor     |
| --------------------- | -------------------- | ----------------------------- | --------- |
| Accept Job Invitation | Không có Application | `CONTACTED` + Assigned sender | Candidate |

Transition này là **Application creation entry point**, không phải:

```text
APPLIED → SCREENING
```

hoặc:

```text
SCREENING → CONTACTED
```

---

## 11.3. Availability consequence

Successful Accept:

```text
Application được tạo tại CONTACTED
↓
Candidate Availability flow được mở
```

Các transition Availability và Interview sau đó tiếp tục thuộc canonical V12.

---

# 12. Authorization và ownership boundary

| Hành động                                         | Actor được phép                        | Resource / Scope                  | Điều kiện                    |
| ------------------------------------------------- | -------------------------------------- | --------------------------------- | ---------------------------- |
| Candidate Search                                  | Recruiter                              | V14 Candidate Search              | Theo V14                     |
| Send Invitation                                   | Primary hoặc Supporting Recruiter      | Candidate CV + Job                | Current eligibility hợp lệ   |
| Xem Candidate Invitation                          | Candidate                              | Invitation của chính mình         | Candidate ownership          |
| Accept                                            | Candidate                              | Invitation của chính mình         | Invitation actionable        |
| Reject                                            | Candidate                              | Invitation của chính mình         | Invitation actionable        |
| Xem/manage Job Invitations                        | Current Primary                        | Invitation thuộc Job mình Primary | Current Primary relationship |
| Revoke                                            | Current Primary                        | PENDING Invitation của Job        | Invitation actionable        |
| Supporting gửi Invitation                         | Supporting                             | Job mình Supporting               | Current team relationship    |
| Supporting quản lý/detail Invitation vì là sender | Không                                  | Invitation                        | Không có quyền riêng này     |
| Company Manager gửi Invitation                    | Không                                  | Job Invitation                    | Ngoài quyền V15              |
| Company Manager Revoke                            | Không                                  | Job Invitation                    | Ngoài quyền V15              |
| Platform Admin gửi/Revoke                         | Không                                  | Job Invitation                    | Ngoài quyền V15              |
| Chat trước Accept                                 | Không                                  | Candidate                         | Không có Conversation        |
| Application action sau Accept                     | Canonical actor của Application        | Application                       | Theo V10–V12                 |
| Chat sau Accept                                   | Candidate + current Assigned Recruiter | Conversation                      | Theo V11                     |

Candidate là owner của Candidate CV.

Candidate CV không trở thành resource thuộc Company chỉ vì được Invitation.

Job Invitation thuộc recruitment context của Job.

Việc biết:

* Candidate ID;
* Candidate CV ID;
* Invitation ID;
* Job ID

không tự tạo authorization.

---

# 13. Multi-tenant boundary

V15 có Company context thông qua Job và Recruitment Team.

Tenant authority:

```text
Authenticated Recruiter
↓
current Company membership
↓
current Recruitment Team relationship
↓
Job thuộc Company đó
↓
Invitation authority
```

Recruiter không được:

* gửi Invitation bằng membership của Recruiter khác;
* gửi Invitation cho Job của Company khác;
* dùng Job mình không còn là Primary/Supporting;
* tự gửi `companyId` khác để mở rộng quyền;
* sử dụng Candidate Search eligibility chung của V14 để bypass Job-specific Invitation authorization.

Candidate CV vẫn là resource của Candidate trên nền tảng.

Việc Company A gửi Invitation dựa trên một PUBLIC CV:

* không chuyển ownership Candidate CV sang Company A;
* không ngăn Company B tìm cùng PUBLIC CV nếu Company B có Recruiter eligible;
* không cấp Company A quyền xem Candidate CV PRIVATE khác.

Nếu Candidate Accept:

```text
Invitation
→ Application của chính Job
→ Application nằm trong Company/tenant của Job
```

Không được tạo Application vào Company hoặc Job khác với Invitation.

---

# 14. Lifecycle invariants

Các invariant sau phải luôn đúng:

1. V15 không thay Candidate Search thành Job-based search.
2. Candidate Search vẫn kết thúc ở V14 boundary trước khi actor bắt đầu Invitation action.
3. Invitation phải bắt đầu từ một Candidate CV cụ thể.
4. Candidate nhận Invitation phải là owner của Candidate CV đó.
5. Send phải re-check current V14 CV eligibility.
6. Generated và Uploaded CV giữ nguyên eligibility semantics khác nhau của V14.
7. Không tự invent `ACTIVE/DRAFT` cho Uploaded CV.
8. Không tự invent Candidate CV Delete lifecycle.
9. Recruiter chỉ gửi Invitation cho Job mình hiện là Primary hoặc Supporting.
10. Job phải còn recruitment window hợp lệ tại Send.
11. V15 không tự động match CV với Job.
12. Invited CV snapshot được khóa tại successful Send.
13. Snapshot không thay đổi khi Candidate sửa CV.
14. `PUBLIC → PRIVATE` sau Send không invalidate Invitation.
15. Generated CV mất `ACTIVE` sau Send không invalidate Invitation.
16. Archive invited CV làm PENDING Invitation `INVALIDATED`.
17. Candidate–Job có tối đa một Invitation `PENDING`.
18. Candidate–Job có tối đa một Application.
19. Application đã tồn tại ở bất kỳ status nào chặn future Job Invitation.
20. Invitation `PENDING` chặn Candidate Direct Apply cùng Job.
21. `REJECTED` chặn future Job Invitation.
22. `REJECTED` không chặn Candidate Direct Apply chỉ vì Reject.
23. `EXPIRED`, `REVOKED`, `INVALIDATED` không tự chặn Invitation mới.
24. Invitation mới luôn phải kiểm tra lại toàn bộ current eligibility.
25. Invitation hết response window vào cuối ngày thứ 15.
26. Job `CLOSED`, `EXPIRED` hoặc đến deadline làm PENDING Invitation `EXPIRED`.
27. Eligibility failure làm PENDING Invitation `INVALIDATED`.
28. Terminal cause thực sự xảy ra trước phải được tôn trọng dù persisted status chưa kịp cập nhật.
29. Invitation terminal không quay lại `PENDING`.
30. Candidate chỉ Accept/Reject Invitation thuộc chính mình.
31. Current Primary quản lý lifecycle Invitation của Job.
32. Current Primary được Revoke Invitation do Supporting gửi.
33. Supporting không có management/detail authority riêng chỉ vì là sender.
34. Greeting không phải Message và không mở Chat.
35. Reject không yêu cầu reason.
36. Invitation chưa Accept không tạo Application.
37. Invitation chưa Accept không tạo Conversation.
38. Candidate Accept tạo Application nguồn `RECRUITER_INVITATION`.
39. Application nguồn Invitation bắt đầu trực tiếp tại `CONTACTED`.
40. Application nguồn Invitation chưa từng ở `APPLIED`.
41. Application nguồn Invitation chưa từng ở `SCREENING`.
42. Sender là Assigned Recruiter ban đầu.
43. Sender attribution không đổi khi Application Reassign.
44. Sender attribution không cấp Application authority sau khi sender không còn current Assignee.
45. Submitted CV của Application dùng snapshot đã khóa tại Send.
46. Candidate không chọn CV khác lúc Accept.
47. Candidate không Replace CV trên Application nguồn Invitation.
48. Candidate không Withdraw Application nguồn Invitation.
49. Successful Accept tạo Conversation.
50. Successful Accept mở ngay Availability flow.
51. Sau Accept, Application lifecycle hiện có hoàn toàn tiếp quản.
52. Invitation không tạo Pipeline riêng.
53. Successful Accept không tạo synthetic `APPLICATION_ASSIGNED`.
54. Successful Accept không tạo synthetic `APPLICATION_STATUS_CHANGED`.
55. Sender nhận `JOB_INVITATION_ACCEPTED`.
56. Sender nhận `INVITED_APPLICATION_CREATED`.
57. Candidate nhận `INTERVIEW_AVAILABILITY_REQUESTED`.
58. Candidate không nhận self `JOB_INVITATION_ACCEPTED`.
59. `EXPIRED` không tạo Notification riêng.
60. Notification phải tuân thủ V13 durability/recovery/dedupe.
61. Realtime không phải source of truth.
62. Historical Notification không chứng minh Invitation còn actionable.
63. Current resource state luôn quyết định action availability.
64. V15 phải giữ được danh tính Recruiter thực sự đã gửi Invitation.
65. Sourcing statistics không thuộc V15.
66. V15 không tạo audit timeline riêng cho Invitation.
67. V15 không yêu cầu Application status/assignment history mới chỉ vì nhánh Invitation.
68. V15 không được mở cross-tenant authority ngoài Job/Company relationship hợp lệ.

---

# 15. Các quyết định chủ động defer

Các nội dung sau đã được xem xét nhưng chủ động không thuộc V15:

* sourcing KPI;
* sourcing statistics;
* sourcing leaderboard;
* sourcing report;
* sourcing dashboard;
* Company Manager Invitation monitoring riêng nếu cần xây thêm một feature độc lập;
* Company Manager xem Invited CV Snapshot như một quyền mới độc lập;
* audit timeline riêng cho Job Invitation;
* lịch sử event riêng cho Job Invitation;
* reject reason;
* reject reason catalog;
* chỉnh sửa greeting sau khi gửi;
* configurable Invitation expiration;
* gia hạn Invitation;
* Candidate self-notification sau Accept;
* Notification cho `EXPIRED`;
* Direct Message trước Application;
* Chat trước Accept;
* Conversation trước Accept;
* Candidate chọn CV khác khi Accept;
* Candidate recommendation;
* AI matching;
* keyword/full-text Candidate Search;
* Recruitment Pipeline riêng cho Invitation.

Các nội dung trên có thể thuộc version sau.

Không được tự implement chúng như requirement của V15.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V15.

Các quyết định về:

* persistence representation;
* schema;
* reference direction;
* index;
* query;
* concurrency mechanism cụ thể;
* expiration scheduler;
* invalidation propagation mechanism;
* Notification recovery implementation;
* Socket.IO room;
* realtime payload;
* API shape;
* HTTP contract;
* source-code structure

không phải business blocker của Product Specification này.

---

# 17. Definition of Business Completion

V15 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` — Recruiter có thể bắt đầu Invitation từ Candidate Search đúng boundary;
* `F02` — Invitation chỉ được gửi khi Candidate CV, Candidate, Recruiter, Company và Job hiện đủ điều kiện;
* `F03` — Candidate xem đúng Invitation của chính mình và current state;
* `F04` — Accept tạo đúng Application nguồn Invitation tại `CONTACTED`;
* `F05` — Reject giữ đúng terminal/resend semantics;
* `F06` — current Primary quản lý và Revoke Invitation theo Job;
* `F07` — Invitation Expiration hoạt động đúng theo day-15 và Job recruitment window;
* `F08` — Invalidation phản ánh đúng current eligibility;
* `F09` — Candidate–Job exclusion và Direct Apply compatibility được giữ;
* `F10` — sender attribution được giữ nhưng không tạo authorization song song;
* `F11` — Notification/realtime tuân thủ V13;
* toàn bộ `BR-01` đến `BR-61` được đáp ứng;
* Candidate–Job không xuất hiện nhiều Application;
* Candidate–Job không xuất hiện nhiều Invitation `PENDING`;
* V14 CV eligibility được reuse thay vì định nghĩa lại;
* Uploaded CV không bị áp Generated lifecycle;
* CV snapshot được khóa đúng tại Send;
* Candidate CV thay đổi sau Send có đúng consequence đã chốt;
* Archive làm Invitation `INVALIDATED`;
* Job Closed/Expired/deadline làm Invitation `EXPIRED`;
* `REJECTED` chặn future Invitation nhưng không khóa Direct Apply;
* `EXPIRED`, `REVOKED`, `INVALIDATED` có thể được gửi lại khi current rules cho phép;
* Application nguồn Invitation bắt đầu trực tiếp tại `CONTACTED`;
* không xuất hiện fake `APPLIED` hoặc `SCREENING`;
* sender là initial Assigned Recruiter;
* Application Reassign không làm mất sender attribution;
* sender attribution không tạo quyền Application lâu dài;
* Conversation chỉ xuất hiện sau Accept;
* Accept tự động mở Availability flow;
* Candidate không Replace hoặc Withdraw Application nguồn Invitation;
* Invitation lifecycle kết thúc khi Accept và không tiếp tục điều khiển Application;
* Invitation Notification không thay thế current Invitation state;
* required Notification được recover/deduplicate theo V13;
* các chức năng chủ động defer không bị đưa vào V15;
* không xuất hiện behavior ngoài boundary đã chốt.

Việc code chạy hoặc test pass không tự động đồng nghĩa với Business Completion nếu implementation chưa đáp ứng đầy đủ contract trên.

---

# 18. Implementation Boundary

Tài liệu này là **canonical business specification của V15**.

Tài liệu này định nghĩa:

```text
WHAT MUST HAPPEN
```

bao gồm:

* ai được gửi Job Invitation;
* Candidate CV nào có thể được dùng;
* Job nào có thể được chọn;
* Invitation lifecycle;
* snapshot semantics;
* duplicate/resend rules;
* Accept/Reject/Revoke/Expire/Invalidate behavior;
* Direct Apply compatibility;
* Application entry semantics;
* sender attribution;
* authorization boundary;
* tenant boundary;
* Notification business semantics;
* version boundary.

Tài liệu này không định nghĩa:

```text
HOW IT IS IMPLEMENTED
```

Tài liệu này không quy định:

* REST endpoint;
* HTTP method;
* HTTP status code;
* request/response body;
* controller;
* service;
* route;
* middleware implementation;
* database query;
* MongoDB/Mongoose schema;
* index cụ thể;
* reference direction cụ thể;
* transaction implementation;
* scheduler/worker implementation;
* invalidation hook implementation;
* Notification recovery implementation;
* Socket.IO room topology;
* realtime payload;
* source-code structure;
* test framework.

Các quyết định đó thuộc:

```text
Product Specification
        │
        │ business truth
        ↓
Data Contract
        │
        │ persistence truth
        ↓
Engineering Contracts
        │
        │ architecture truth
        ↓
Implementation
```

Nếu implementation hoặc data design mâu thuẫn với tài liệu này, **Product Specification là authority đối với business behavior**, trừ khi Product Specification được con người cập nhật và phê duyệt lại.
