# V13 — Notification và phân phối realtime

> **File:** `docs/product/versions/v13-notification-realtime-distribution.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V13.

---

## 1. Mục tiêu

V13 bổ sung lớp **Notification lâu dài** và **phân phối realtime** cho các nghiệp vụ đã tồn tại từ các version trước, đồng thời hoàn thiện phân phối realtime cho Chat.

Sau khi V13 hoàn thành, hệ thống phải:

* lưu được Notification lâu dài cho các sự kiện nghiệp vụ thuộc phạm vi V13;
* cho người dùng xem lại Notification kể cả khi đã offline tại thời điểm sự kiện xảy ra;
* quản lý trạng thái chưa đọc/đã đọc của từng Notification;
* phân phối Notification mới theo realtime tới các phiên đang hoạt động của đúng người nhận;
* phân phối Message mới theo realtime mà không thay đổi quyền Chat đã được xác định từ V11;
* phản ánh realtime các thay đổi quan trọng về khả năng tương tác của Conversation;
* cho phép client đồng bộ lại bằng dữ liệu lâu dài khi bị mất kết nối hoặc bỏ lỡ realtime event;
* bảo đảm Notification bắt buộc cuối cùng không bị mất dù việc tạo Notification tạm thời thất bại;
* không tạo Notification trùng cho cùng một logical business event và cùng một người nhận.

V13 không thay thế nghiệp vụ nguồn và không biến realtime thành nguồn dữ liệu chính.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

* Notification lâu dài.
* Danh sách Notification của người dùng.
* Trạng thái chưa đọc/đã đọc của từng Notification.
* Tổng số Notification chưa đọc.
* Mở Notification và kiểm tra lại resource hiện tại.
* Notification cho Direct Application.
* Notification cho Assign Application.
* Notification cho Reassign Application.
* Notification cho Unassign Application.
* Notification cho thay đổi Recruitment Status thuộc phạm vi đã chốt.
* Notification khi Application `HIRED`.
* Notification khi Application `REJECTED`.
* Notification khi Candidate Withdraw Application.
* Notification khi Candidate được yêu cầu cung cấp Availability.
* Notification khi Candidate first-submit Availability.
* Notification khi Interview Schedule được tạo.
* Notification khi Interview Schedule thay đổi hoặc bị hủy.
* Notification khi Candidate Confirm Interview Schedule.
* Notification khi Candidate Decline Interview Schedule.
* Notification khi có Message mới.
* Phân phối Notification realtime.
* Phân phối Message realtime.
* Realtime state update khi Conversation trở thành không thể gửi Message do Application `UNASSIGNED`.
* Realtime state update khi Conversation trở lại writable sau khi Application được Assign.
* Realtime state update khi Conversation trở thành read-only do Application terminal.
* Đồng bộ lại bằng dữ liệu lâu dài sau khi client reconnect.
* Eventual consistency giữa nghiệp vụ nguồn và durable Notification.
* Chống tạo duplicate Notification cho cùng một logical event và cùng recipient.

### 2.2. Ngoài phạm vi

* Job Invitation Notification.
* Message read receipt.
* Typing indicator.
* Online/offline presence.
* Last seen.
* Message reaction.
* Edit Message.
* Delete Message.
* Voice Message.
* Video call.
* Dashboard realtime.
* Thống kê realtime.
* Mark all Notifications as read.
* Mark Notification từ đã đọc về chưa đọc.
* Delete Notification.
* Archive Notification.
* Notification retention policy.
* Badge riêng theo từng module.
* Notification preference.
* Cho phép người dùng tắt Notification theo từng event.
* Email Notification.
* Push Notification trên thiết bị.
* SMS Notification.
* Socket replay toàn bộ event đã bỏ lỡ.
* Candidate chủ động yêu cầu đổi lịch phỏng vấn.
* Bổ sung trạng thái `COMPLETED` cho `InterviewSchedule`.
* `INTERVIEW_SCHEDULE_COMPLETED` Notification/event.

Không suy diễn hoặc tự bổ sung các chức năng ngoài phạm vi đã được chốt.

---

## 3. Dependency với các version trước

V13 sử dụng các business concept đã tồn tại trước đó:

* V01 — `User`, Authentication và trạng thái User.
* V02 — Company lifecycle.
* V03 — Recruiter và CompanyMember lifecycle.
* V05/V06 — Job, Primary Recruiter, Recruitment Team và responsibility.
* V09 — Direct Application và Withdraw.
* V10 — Application Assignment, Unassign, Reassign và Recruitment Pipeline.
* V11 — Conversation, Message, Chat authorization và Conversation lifecycle.
* V12 — Candidate Availability và Interview Schedule lifecycle.

V13 kế thừa canonical Assignment model:

```text
UNASSIGNED
→ ASSIGNED(A)

ASSIGNED(A)
→ ASSIGNED(B)

ASSIGNED(A)
→ UNASSIGNED
```

Application non-terminal có thể tồn tại ở trạng thái `UNASSIGNED`.

V13 kế thừa quyền Chat từ V11 và không mở thêm actor mới được Chat.

V13 kế thừa toàn bộ Candidate Availability và Interview Schedule lifecycle của V12.

V13 chỉ sử dụng các Interview Schedule state đã tồn tại trong V12 và không bổ sung state mới.

Job Invitation không phải dependency nghiệp vụ bắt buộc của V13 và toàn bộ Notification liên quan Job Invitation được defer khỏi version này.

V13 không được làm thay đổi các invariant đã chốt của version trước, trừ khi tài liệu này ghi rõ behavior mới của lớp Notification/realtime.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Candidate

User sở hữu Application.

Candidate có thể là:

* người thực hiện Direct Apply;
* người Withdraw Application;
* người gửi Message;
* người gửi Availability;
* người Confirm hoặc Decline Interview Schedule;
* recipient của các Notification liên quan tiến trình Application, Assignment và Interview.

### 4.2. Assigned Recruiter

Recruiter đang giữ responsibility hiện tại của Application.

Assigned Recruiter có thể là recipient của:

* Application Assignment;
* Candidate Withdraw khi Application đang Assigned;
* Candidate first-submit Availability;
* Candidate Confirm Schedule;
* Candidate Decline Schedule;
* Message Candidate gửi.

V13 luôn phân biệt **current Assigned Recruiter** với Recruiter từng xử lý Application trong quá khứ.

### 4.3. Outgoing Recruiter

Recruiter đang giữ responsibility trước khi Application bị Reassign hoặc Unassign.

Outgoing Recruiter có thể nhận Notification về việc responsibility thay đổi theo các rule được định nghĩa trong V13.

Việc nhận Notification lịch sử không cấp lại quyền xử lý Application hoặc Chat.

### 4.4. Primary Recruiter

Primary Recruiter của Job.

Trong V13, Primary nhận Notification theo vai trò Primary trong các trường hợp đã chốt:

* có Direct Application mới đang `UNASSIGNED`;
* Candidate Withdraw một Application đang `UNASSIGNED`.

Primary không mặc nhiên nhận toàn bộ Notification của Job.

### 4.5. Company Manager

Company Manager có thể là actor của các Assignment mutation đã được version trước cho phép.

V13 không mở thêm quyền nghiệp vụ cho Company Manager.

Nếu Company Manager là actor của một event, rule loại actor khỏi recipient vẫn được áp dụng khi phù hợp.

### 4.6. Actor

User thực hiện business action làm phát sinh event.

Một số event có thể phát sinh từ lifecycle hoặc hành vi hệ thống và không có human actor trực tiếp.

Actor không tự quyết định recipient.

### 4.7. Recipient

User sở hữu một Notification cụ thể.

Một logical event có thể có nhiều recipient.

Mỗi recipient có read state độc lập.

### 4.8. Durable Notification

Bản ghi lịch sử lâu dài cho biết một business event đã xảy ra đối với recipient.

Notification không phải bản sao authoritative của current resource state.

### 4.9. Realtime event

Tín hiệu được phân phối tới client đang hoạt động để client cập nhật nhanh dữ liệu hoặc trạng thái giao diện.

Realtime event không thay thế dữ liệu đã được lưu lâu dài và không tự cấp quyền nghiệp vụ.

---

## 5. Quan hệ nghiệp vụ chính

### 5.1. Business event và Notification

```text
Business event
   │
   │ 1 — N
   ↓
Notification theo từng recipient
```

Một business event có thể tạo Notification cho nhiều recipient.

Mỗi recipient có Notification riêng để duy trì read state độc lập.

---

### 5.2. User và Notification

```text
User
 │
 │ 1 — N
 ↓
Notification
```

Notification thuộc một recipient User cụ thể.

User chỉ được thao tác read state của Notification thuộc chính mình.

---

### 5.3. Resource và Notification

Notification có thể phản ánh một sự kiện liên quan đến:

* Application;
* Message;
* Candidate Availability flow;
* Interview Schedule.

Notification chỉ ghi nhận rằng event đã xảy ra.

Resource hiện tại vẫn là nguồn quyết định:

* current state;
* current ownership;
* current authorization;
* action nào còn hợp lệ.

---

### 5.4. Application, Conversation và Message

```text
Application
   │
   ↓
Conversation
   │
   ↓
Message
```

V13 không thay đổi quan hệ nghiệp vụ này.

Chat tiếp tục thuộc từng Application.

---

### 5.5. Application và current Assignee

```text
Application
   │
   ├── UNASSIGNED
   │
   └── ASSIGNED → current Assigned Recruiter
```

Recipient của nhiều Notification V13 phụ thuộc vào Assignment state thực tế tại thời điểm business event được ghi nhận.

Phần này chỉ mô tả **quan hệ nghiệp vụ**.

Không mô tả persistence implementation tại đây.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Notification read state

Các trạng thái:

* `UNREAD`
* `READ`

| Trạng thái | Ý nghĩa                                                |
| ---------- | ------------------------------------------------------ |
| `UNREAD`   | Recipient chưa mở chính Notification đó.               |
| `READ`     | Recipient đã mở chính Notification đó ít nhất một lần. |

Transition duy nhất:

```text
UNREAD
  ↓ mở chính Notification
READ
```

Không có transition:

```text
READ
→ UNREAD
```

---

### 6.2. Assignment state được V13 quan sát

V13 không sở hữu Assignment lifecycle nhưng phải xử lý đúng hai trạng thái:

* `UNASSIGNED`
* `ASSIGNED`

| Trạng thái   | Ý nghĩa đối với V13                                      |
| ------------ | -------------------------------------------------------- |
| `UNASSIGNED` | Application hiện không có Recruiter chịu responsibility. |
| `ASSIGNED`   | Application có current Assigned Recruiter.               |

---

### 6.3. Conversation interaction mode được V13 phản ánh realtime

Các mode nghiệp vụ được V13 quan sát:

* `WRITABLE`
* `PAUSED_UNASSIGNED`
* `READ_ONLY`

| Mode                | Ý nghĩa                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `WRITABLE`          | Application non-terminal và đang có current Assigned Recruiter; Chat được phép theo V11.                                 |
| `PAUSED_UNASSIGNED` | Application non-terminal nhưng đang `UNASSIGNED`; Conversation history được giữ nhưng không được gửi NORMAL Message mới. |
| `READ_ONLY`         | Application đã terminal; Conversation không còn writable.                                                                |

Các mode này mô tả behavior nghiệp vụ mà V13 phải phản ánh realtime.

V13 không quy định cách lưu các mode này.

---

## 7. Tổ hợp trạng thái hợp lệ

### 7.1. Application và Conversation interaction mode

| Application lifecycle | Assignment                                | Conversation mode   |
| --------------------- | ----------------------------------------- | ------------------- |
| Non-terminal          | `ASSIGNED`                                | `WRITABLE`          |
| Non-terminal          | `UNASSIGNED`                              | `PAUSED_UNASSIGNED` |
| Terminal              | Bất kỳ trạng thái lịch sử nào còn tồn tại | `READ_ONLY`         |

---

### 7.2. Notification và resource state

Notification read state độc lập với current state của resource.

Các trường hợp sau đều hợp lệ:

| Notification | Resource hiện tại             | Ý nghĩa                           |
| ------------ | ----------------------------- | --------------------------------- |
| `UNREAD`     | còn hiệu lực                  | Event đã xảy ra và chưa được mở.  |
| `READ`       | còn hiệu lực                  | Event đã được mở.                 |
| `UNREAD`     | đã thay đổi hoặc mất hiệu lực | Notification lịch sử vẫn tồn tại. |
| `READ`       | đã thay đổi hoặc mất hiệu lực | Notification lịch sử vẫn tồn tại. |

Việc resource thay đổi hoặc mất hiệu lực không tự thay đổi read state và không xóa Notification.

---

## 8. Quy trình nghiệp vụ tổng thể

### 8.1. Durable Notification

```text
Nghiệp vụ nguồn thành công
        ↓
Xác định logical business event
        ↓
Xác định đúng recipient theo current business state
        ↓
Durable Notification phải cuối cùng tồn tại
        ↓
Nếu recipient đang online:
phân phối Notification realtime
```

Việc lưu Notification có thể hoàn thành sau business mutation theo eventual consistency.

Business mutation hợp lệ không bị rollback chỉ vì Notification tạm thời chưa tạo được.

---

### 8.2. Mở Notification

```text
User mở Notification
        ↓
Kiểm tra Notification thuộc User hiện tại
        ↓
Notification trở thành READ nếu trước đó UNREAD
        ↓
Xác định resource liên quan
        ↓
Kiểm tra current authorization
        ↓
Kiểm tra current resource state
        ↓
Chỉ cho phép action hiện còn hợp lệ
```

---

### 8.3. Chat realtime

```text
V11 chấp nhận và lưu Message hợp lệ
        ↓
Message trở thành dữ liệu lâu dài
        ↓
V13 tạo required Chat Notification
        ↓
Phân phối Message realtime
        ↓
Phân phối Notification realtime khi durable Notification đã tồn tại
```

V13 không quyết định quyền gửi Message.

---

### 8.4. Conversation state realtime

```text
Application Assignment/lifecycle thay đổi
        ↓
Conversation interaction mode thay đổi
        ↓
V13 phân phối realtime state update
        ↓
Client cập nhật UI
```

Nếu client bỏ lỡ realtime state update, backend vẫn phải áp dụng current authorization của V11.

---

### 8.5. Reconnect

```text
Client mất kết nối
        ↓
Có thể bỏ lỡ realtime event
        ↓
Client reconnect
        ↓
Đồng bộ lại từ dữ liệu lâu dài và current resource state
```

V13 không yêu cầu replay toàn bộ realtime event đã bỏ lỡ.

---

# 9. Functional Requirements

## F01 — Notification Inbox và read state

### Actor

* Authenticated User.

### Mục tiêu

Cho phép User xem các Notification lâu dài thuộc chính mình và quản lý trạng thái chưa đọc/đã đọc của từng Notification.

### Tiền điều kiện

* User đã được xác thực.
* Notification thuộc recipient User hiện tại.

### Luồng chính

1. User truy cập danh sách Notification của chính mình.
2. Hệ thống cung cấp các Notification lâu dài thuộc User.
3. Notification chưa từng được mở được coi là `UNREAD`.
4. Khi User mở chính Notification, Notification chuyển sang `READ`.
5. Tổng unread được phản ánh theo toàn bộ Notification chưa đọc của User.
6. Nếu User mở resource liên quan, quyền và current state của resource phải được kiểm tra lại.

### Kết quả

* User xem được lịch sử Notification của chính mình.
* Read state được giữ lâu dài.
* Notification đã đọc không tự trở lại unread.
* Notification cũ vẫn tồn tại dù resource đã thay đổi hoặc mất hiệu lực.

### Trường hợp từ chối

* User cố đọc hoặc thay đổi read state của Notification thuộc User khác.
* User cố dùng Notification để vượt qua authorization của resource hiện tại.

### Business Rules liên quan

* `BR-01`
* `BR-02`
* `BR-03`
* `BR-04`
* `BR-05`
* `BR-06`
* `BR-07`
* `BR-08`

### Không thuộc chức năng này

* Mark all as read.
* Mark as unread.
* Delete Notification.
* Archive Notification.
* Retention policy.

---

## F02 — Direct Application Notification

### Actor

* Candidate.

### Mục tiêu

Thông báo cho các bên cần biết khi Candidate Direct Apply thành công.

### Tiền điều kiện

* Direct Apply đã thành công theo V09.
* Application mới ở trạng thái nguồn đã được V09/V10 xác nhận hợp lệ.
* Application đang `UNASSIGNED`.

### Luồng chính

1. Candidate Direct Apply thành công.
2. Hệ thống ghi nhận business event `DIRECT_APPLICATION_CREATED`.
3. Candidate được xác định là recipient.
4. Primary Recruiter của Job được xác định là recipient.
5. Candidate nhận Notification xác nhận ứng tuyển thành công.
6. Primary nhận Notification rằng có hồ sơ mới chưa được phân công.

### Kết quả

* Candidate có Notification lâu dài xác nhận Direct Apply.
* Primary có Notification lâu dài về hồ sơ mới chưa được phân công.
* Application vẫn `UNASSIGNED`.

### Trường hợp từ chối

* Direct Apply không thành công.
* Application không thực sự được tạo.

### Business Rules liên quan

* `BR-09`
* `BR-10`
* `BR-11`
* `BR-12`

### Không thuộc chức năng này

* Tự Assign Application cho Primary.
* Notification Job Invitation.

---

## F03 — Assignment Notification

### Actor

* Actor được version Assignment trước đó cho phép thực hiện Assign, Reassign hoặc Unassign.
* System lifecycle đối với automatic Unassign.

### Mục tiêu

Thông báo đúng các bên khi responsibility của Application thay đổi mà không làm thay đổi canonical Assignment behavior.

### Tiền điều kiện

* Assignment mutation đã thành công theo V10.
* Current Assignment state đã được xác định từ backend.

### Luồng chính

#### Assign

1. Application chuyển `UNASSIGNED → ASSIGNED(B)`.
2. Phát sinh `APPLICATION_ASSIGNED`.
3. Candidate và Recruiter B là candidate recipients.
4. Actor được loại khỏi recipient nếu actor đồng thời là recipient.

#### Reassign

1. Application chuyển `ASSIGNED(A) → ASSIGNED(B)`.
2. Phát sinh duy nhất `APPLICATION_REASSIGNED`.
3. Candidate, Recruiter A và Recruiter B là candidate recipients.
4. Actor được loại khỏi recipient nếu trùng recipient.

#### Unassign

1. Application chuyển `ASSIGNED(A) → UNASSIGNED`.
2. Phát sinh `APPLICATION_UNASSIGNED`.
3. Candidate và Recruiter A là candidate recipients.
4. Actor được loại khỏi recipient nếu trùng recipient.
5. Candidate-facing Notification chỉ phản ánh rằng hồ sơ hiện chưa có người phụ trách hoặc đang chờ người phụ trách mới.

### Kết quả

* Responsibility change được phản ánh bằng đúng event tương ứng.
* Candidate không bị lộ nguyên nhân nội bộ dẫn tới automatic/manual Unassign.
* Reassign không bị biểu diễn giả thành Unassign rồi Assign.

### Trường hợp từ chối

* Assignment mutation nguồn thất bại.
* Actor hoặc recipient được suy ra từ dữ liệu stale phía client thay vì current state.

### Business Rules liên quan

* `BR-10`
* `BR-11`
* `BR-13`
* `BR-14`
* `BR-15`
* `BR-16`
* `BR-17`
* `BR-18`
* `BR-19`

### Không thuộc chức năng này

* Thực hiện Assign/Reassign/Unassign.
* Thay đổi Application Status.
* Mở rộng quyền Chat.

---

## F04 — Application Status và Withdraw Notification

### Actor

* Actor được phép thay đổi Recruitment Status theo version trước.
* Candidate đối với Withdraw.

### Mục tiêu

Thông báo đúng những thay đổi quan trọng của Application lifecycle.

### Tiền điều kiện

* Application transition đã thành công theo canonical Application lifecycle.

### Luồng chính

#### Non-terminal status change

1. Application chuyển sang một non-terminal status thuộc phạm vi:

   * `SCREENING`;
   * `CONTACTED`;
   * `INTERVIEW_SCHEDULED`;
   * `INTERVIEW_COMPLETED`.
2. Phát sinh `APPLICATION_STATUS_CHANGED`.
3. Candidate là recipient sau actor filtering.

#### Hired

1. Application chuyển thành công sang `HIRED`.
2. Phát sinh `APPLICATION_HIRED`.
3. Candidate là recipient.
4. Không đồng thời tạo `APPLICATION_STATUS_CHANGED` cho cùng transition.

#### Rejected

1. Application chuyển thành công sang `REJECTED`.
2. Phát sinh `APPLICATION_REJECTED`.
3. Candidate là recipient.
4. Không đồng thời tạo `APPLICATION_STATUS_CHANGED` cho cùng transition.

#### Withdraw

1. Candidate Withdraw Application hợp lệ.
2. Candidate là actor và không nhận Notification xác nhận.
3. Nếu Application đang `ASSIGNED`, current Assigned Recruiter là recipient.
4. Nếu Application đang `UNASSIGNED`, Primary Recruiter của Job là recipient.

### Kết quả

* Application lifecycle được phản ánh đúng mà không tạo duplicate semantic event.
* Primary chỉ nhận Withdraw Notification theo vai trò Primary khi Application đang `UNASSIGNED`.

### Trường hợp từ chối

* Application transition nguồn thất bại.
* Recipient được suy ra từ Assignment state cũ thay vì current state.

### Business Rules liên quan

* `BR-10`
* `BR-11`
* `BR-20`
* `BR-21`
* `BR-22`
* `BR-23`

### Không thuộc chức năng này

* Thực hiện Recruitment Pipeline transition.
* Thực hiện Withdraw thay Candidate.

---

## F05 — Candidate Availability Notification

### Actor

* Assigned Recruiter đối với yêu cầu Availability.
* Candidate đối với first-submit Availability.

### Mục tiêu

Thông báo hai mốc nghiệp vụ chính của Availability flow mà V13 đã chốt.

### Tiền điều kiện

* Nghiệp vụ nguồn thuộc V12 đã thành công.

### Luồng chính

#### Availability requested

1. Application đi vào flow yêu cầu Candidate cung cấp lịch rảnh.
2. Phát sinh `INTERVIEW_AVAILABILITY_REQUESTED`.
3. Candidate là recipient.

#### First submit

1. Candidate submit Candidate Availability lần đầu thành công.
2. Nếu Application hiện `ASSIGNED(A)`, A là recipient.
3. Nếu Application hiện `UNASSIGNED`, không có Recruiter recipient.
4. Không fallback về Primary Recruiter.
5. Những lần Candidate sửa Availability đã tồn tại không tạo Notification.

### Kết quả

* Candidate biết khi cần cung cấp Availability.
* Current Assignee biết khi Candidate first-submit Availability nếu Assignee tồn tại.
* Không biến Primary thành fallback recipient của Interview flow.

### Trường hợp từ chối

* Availability operation nguồn thất bại.
* Attempt tạo Notification cho Recruiter cũ hoặc future Assignee khi Application hiện `UNASSIGNED`.

### Business Rules liên quan

* `BR-10`
* `BR-24`
* `BR-25`
* `BR-26`
* `BR-27`

### Không thuộc chức năng này

* Notification cho mọi lần Availability edit.
* Tự tạo hoặc sửa Candidate Availability.

---

## F06 — Interview Schedule Notification

### Actor

* Current Assigned Recruiter đối với Schedule creation/change theo V12.
* Candidate đối với Confirm/Decline.

### Mục tiêu

Thông báo đúng các mốc Interview Schedule đã được chốt mà không thay đổi V12 lifecycle.

### Tiền điều kiện

* Interview operation nguồn đã thành công theo V12.

### Luồng chính

#### Schedule created

1. Schedule được tạo thành công ở `PROPOSED`.
2. Phát sinh `INTERVIEW_SCHEDULE_CREATED`.
3. Candidate là recipient.

#### Schedule changed

1. Schedule thay đổi theo behavior V12 thuộc phạm vi V13.
2. Trường hợp Schedule chuyển `CANCELLED` cũng thuộc event này.
3. Phát sinh `INTERVIEW_SCHEDULE_CHANGED`.
4. Candidate là recipient.

#### Candidate confirms

1. Candidate Confirm Schedule hợp lệ.
2. Phát sinh `INTERVIEW_SCHEDULE_CONFIRMED`.
3. Nếu Application đang `ASSIGNED(A)`, A là recipient.
4. Nếu Application đang `UNASSIGNED`, không có Recruiter recipient.

#### Candidate declines

1. Candidate Decline Schedule hợp lệ.
2. Phát sinh `INTERVIEW_SCHEDULE_DECLINED`.
3. Nếu Application đang `ASSIGNED(A)`, A là recipient.
4. Nếu Application đang `UNASSIGNED`, không có Recruiter recipient.

### Kết quả

* Candidate nhận được Notification về Schedule mới hoặc Schedule thay đổi.
* Current Assignee nhận được phản hồi Confirm/Decline nếu Assignee tồn tại.
* Recruiter cũ, Schedule creator không còn là Assignee, Primary không phải Assignee và future Assignee không nhận thay current Assignee.
* V13 không bổ sung completion state hoặc completion event cho Interview Schedule.

### Trường hợp từ chối

* Schedule operation nguồn thất bại.
* Recipient được xác định từ stale assignee.
* Attempt fallback Confirm/Decline Notification về Primary khi Application `UNASSIGNED`.

### Business Rules liên quan

* `BR-10`
* `BR-28`
* `BR-29`
* `BR-30`
* `BR-31`
* `BR-32`
* `BR-33`

### Không thuộc chức năng này

* Thay đổi Schedule lifecycle.
* Candidate reschedule request.
* Bổ sung trạng thái `COMPLETED` cho `InterviewSchedule`.
* `INTERVIEW_SCHEDULE_COMPLETED` Notification/event.

---

## F07 — Chat Message Notification và realtime Message

### Actor

* Candidate owner.
* Current Assigned Recruiter.
* System Message đã được V11 tạo hợp lệ.

### Mục tiêu

Phân phối Message mới theo realtime và tạo Notification lâu dài cho phía cần nhận.

### Tiền điều kiện

* Message đã được V11 chấp nhận và lưu thành công.
* Authorization gửi Message do V11 quyết định.

### Luồng chính

#### Candidate gửi Message

1. Candidate gửi NORMAL Message hợp lệ.
2. Message được lưu thành công.
3. Current Assigned Recruiter là Notification recipient.
4. Message được phân phối realtime.

#### Assigned Recruiter gửi Message

1. Current Assigned Recruiter gửi NORMAL Message hợp lệ.
2. Message được lưu thành công.
3. Candidate là Notification recipient.
4. Message được phân phối realtime.

#### SYSTEM Message

1. V11 tạo SYSTEM Message hợp lệ.
2. SYSTEM Message cũng được coi là Message mới trong V13.
3. Notification recipient được xác định theo quyền Conversation sau business transition tương ứng.
4. Message được phân phối realtime.

### Kết quả

* Message lâu dài và realtime delivery phản ánh cùng một Message đã thành công.
* Human sender không nhận Chat Notification xác nhận cho chính Message mình gửi.
* Chat Notification không cấp quyền Chat.

### Trường hợp từ chối

* Message không được V11 chấp nhận.
* Actor không còn quyền Chat theo current Application state.
* Recipient được suy ra từ Assignee cũ.

### Business Rules liên quan

* `BR-10`
* `BR-34`
* `BR-35`
* `BR-36`
* `BR-37`

### Không thuộc chức năng này

* Message read receipt.
* Typing indicator.
* Online presence.
* Edit/Delete Message.

---

## F08 — Conversation realtime state

### Actor

* Hệ thống phản ánh kết quả Assignment hoặc Application lifecycle đã thành công.

### Mục tiêu

Cho phép client cập nhật ngay khả năng tương tác với Conversation khi business state thay đổi.

### Tiền điều kiện

* Application hoặc Assignment transition nguồn đã thành công.

### Luồng chính

#### Application bị Unassign

1. Application chuyển `ASSIGNED → UNASSIGNED`.
2. Conversation interaction mode trở thành `PAUSED_UNASSIGNED`.
3. V13 phân phối realtime state update.
4. UI phải có khả năng phản ánh rằng không thể gửi Message mới.

#### Application được Assign lại

1. Application chuyển `UNASSIGNED → ASSIGNED`.
2. Nếu Application vẫn non-terminal, Conversation interaction mode trở thành `WRITABLE`.
3. V13 phân phối realtime state update.

#### Application terminal

1. Application chuyển sang terminal state.
2. Conversation interaction mode trở thành `READ_ONLY`.
3. V13 phân phối realtime state update.

### Kết quả

* Client có thể cập nhật UI nhanh theo current interaction mode.
* Conversation state realtime không tạo durable Notification riêng.
* Missed realtime event không làm thay đổi backend authorization.

### Trường hợp từ chối

* Client cố gửi Message dựa trên UI stale khi backend current state không còn cho phép.
* Client coi realtime event là nguồn cấp quyền.

### Business Rules liên quan

* `BR-38`
* `BR-39`
* `BR-40`
* `BR-41`

### Không thuộc chức năng này

* Thay đổi V11 Conversation authorization.
* Lưu presence hoặc trạng thái socket lâu dài.
* Durable Notification riêng chỉ để báo Conversation mode thay đổi.

---

## F09 — Realtime Notification distribution và multi-session

### Actor

* Recipient User.

### Mục tiêu

Phân phối Notification mới tới các phiên đang hoạt động của đúng recipient mà không thay đổi durable ownership.

### Tiền điều kiện

* Durable Notification tương ứng đã tồn tại.
* User là recipient của Notification.

### Luồng chính

1. Durable Notification tồn tại.
2. Nếu recipient có một hoặc nhiều active session, Notification được phân phối realtime tới các phiên đang hoạt động của recipient.
3. Read state vẫn là read state chung của User.
4. Tổng unread phản ánh cùng một durable Notification set giữa các phiên.

### Kết quả

* User đang online nhận Notification nhanh.
* User đang offline không mất Notification.
* Nhiều phiên của cùng User không tạo nhiều durable Notification cho cùng event.

### Trường hợp từ chối

* Phân phối Notification realtime cho User không phải recipient.
* Tạo thêm Notification lâu dài chỉ vì User có nhiều active session.

### Business Rules liên quan

* `BR-04`
* `BR-08`
* `BR-42`
* `BR-43`
* `BR-44`

### Không thuộc chức năng này

* Device-specific push Notification.
* Per-device read state.
* Presence management.

---

## F10 — Offline resynchronization

### Actor

* Authenticated User.

### Mục tiêu

Cho phép client phục hồi current state sau khi offline hoặc bỏ lỡ realtime event mà không phụ thuộc vào replay của Socket.

### Tiền điều kiện

* User đã được xác thực.
* Client reconnect hoặc cần đồng bộ lại.

### Luồng chính

1. Client có thể đã bỏ lỡ một hoặc nhiều realtime event.
2. Client reconnect.
3. Client tải lại durable Notification cần thiết.
4. Client tải lại current state của resource khi cần.
5. Client tiếp tục hoạt động dựa trên dữ liệu hiện tại.

### Kết quả

* Missed realtime event không làm mất durable Notification.
* Client không cần Socket replay toàn bộ lịch sử event.
* Current resource state vẫn được phục hồi từ nguồn dữ liệu lâu dài.

### Trường hợp từ chối

* Client dùng realtime history cũ để bỏ qua current authorization.
* Client coi event đã bỏ lỡ là lý do thay đổi business state phía backend.

### Business Rules liên quan

* `BR-02`
* `BR-45`
* `BR-46`

### Không thuộc chức năng này

* Replay toàn bộ Socket events.
* Message delivery receipt.

---

## F11 — Durable Notification recovery và chống duplicate

### Actor

* Hệ thống.

### Mục tiêu

Bảo đảm required Notification cuối cùng tồn tại mà không làm business mutation nguồn thất bại chỉ vì Notification tạm thời chưa được tạo.

### Tiền điều kiện

* Business mutation nguồn đã thành công.
* Business event thuộc loại bắt buộc tạo Notification.
* Recipient hợp lệ đã được xác định.

### Luồng chính

1. Business mutation nguồn thành công.
2. Required Notification được yêu cầu tạo.
3. Nếu Notification chưa được tạo thành công ngay, business result vẫn giữ nguyên.
4. Hệ thống phải tiếp tục bảo đảm Notification cuối cùng được tạo.
5. Việc thực hiện lại cùng logical event không được tạo thêm Notification cho cùng recipient.
6. Notification realtime chỉ được phân phối khi durable Notification tương ứng thực sự tồn tại.

### Kết quả

* Business operation không bị rollback chỉ vì lỗi Notification tạm thời.
* Required Notification không bị silently lost.
* Một logical event tạo tối đa một Notification cho mỗi recipient.
* Không xuất hiện realtime Notification không có durable Notification tương ứng.

### Trường hợp từ chối

* Bỏ mất required Notification vĩnh viễn sau business success.
* Tạo hai hoặc nhiều Notification cho cùng logical event và cùng recipient.
* Phân phối Notification realtime trong khi durable Notification tương ứng chưa tồn tại.

### Business Rules liên quan

* `BR-47`
* `BR-48`
* `BR-49`
* `BR-50`

### Không thuộc chức năng này

* Cách kỹ thuật thực hiện retry/recovery.
* Cách xác định technical event identity.
* Cơ chế persistence cụ thể.

---

# 10. Business Rules

## BR-01 — Notification là dữ liệu lâu dài

Mọi Notification bắt buộc thuộc phạm vi V13 cuối cùng phải tồn tại lâu dài và có thể được recipient xem lại.

---

## BR-02 — Realtime không phải nguồn dữ liệu chính

Realtime event không thay thế durable data hoặc current resource state.

Client phải có khả năng tải lại dữ liệu khi cần.

---

## BR-03 — Notification không cấp quyền resource

Việc User nhận Notification không làm User tự động có quyền hiện tại đối với Application, Conversation, Message hoặc Interview resource liên quan.

Authorization phải được kiểm tra lại khi resource được truy cập.

---

## BR-04 — Offline không làm mất Notification

Recipient offline tại thời điểm event xảy ra vẫn phải có durable Notification tương ứng sau khi Notification được ghi nhận thành công.

---

## BR-05 — Notification không bị xóa do resource thay đổi

Notification lịch sử vẫn tồn tại khi resource:

* thay đổi trạng thái;
* bị Reassign;
* bị Cancel;
* trở thành terminal;
* mất hiệu lực;
* không còn cho recipient quyền thao tác.

---

## BR-06 — Notification read state

Notification có:

```text
UNREAD
```

khi recipient chưa mở chính Notification, và:

```text
READ
```

sau khi recipient mở chính Notification.

---

## BR-07 — Chỉ mở chính Notification mới chuyển sang READ

Không tự chuyển Notification sang `READ` chỉ vì:

* Notification xuất hiện trong danh sách;
* Notification được phân phối realtime;
* User mở trang Notifications;
* User đang xem resource liên quan;
* User truy cập resource bằng một luồng khác.

---

## BR-08 — Read state dùng chung cho User

Read state thuộc recipient User và được dùng chung giữa các phiên của cùng User.

V13 không có read state riêng cho từng session hoặc thiết bị.

---

## BR-09 — Direct Apply là self-notification exception

Candidate được nhận Notification xác nhận cho chính hành động Direct Apply thành công.

Đây là ngoại lệ của rule actor filtering.

---

## BR-10 — Actor filtering

Mặc định, nếu human actor đồng thời nằm trong candidate recipient set của một event thì actor bị loại khỏi recipient.

Chỉ các ngoại lệ được ghi rõ trong tài liệu này mới được phép tự nhận Notification xác nhận.

---

## BR-11 — Recipient phải được xác định từ current backend state

Recipient không được xác định từ Assignee, Application Status, Schedule Status hoặc ownership stale do client cung cấp.

Recipient phải phản ánh state hợp lệ tại thời điểm business event được ghi nhận.

---

## BR-12 — Direct Application recipients

`DIRECT_APPLICATION_CREATED` tạo Notification cho:

* Candidate;
* Primary Recruiter của Job.

Event không tự Assign Application cho Primary.

---

## BR-13 — Assign recipients

Khi:

```text
UNASSIGNED
→ ASSIGNED(B)
```

`APPLICATION_ASSIGNED` có candidate recipients:

* Candidate;
* Recruiter B.

Sau đó áp dụng `BR-10`.

---

## BR-14 — Reassign là một business event riêng

Khi:

```text
ASSIGNED(A)
→ ASSIGNED(B)
```

chỉ tạo Assignment event:

```text
APPLICATION_REASSIGNED
```

Không biểu diễn cùng mutation thành:

```text
APPLICATION_UNASSIGNED
+
APPLICATION_ASSIGNED
```

---

## BR-15 — Reassign recipients

`APPLICATION_REASSIGNED` có candidate recipients:

* Candidate;
* outgoing Recruiter A;
* new Recruiter B.

Sau đó áp dụng `BR-10`.

---

## BR-16 — Unassign phải có Notification nghiệp vụ

Mọi successful transition:

```text
ASSIGNED(A)
→ UNASSIGNED
```

thuộc manual hoặc automatic Unassign đều phát sinh `APPLICATION_UNASSIGNED`.

---

## BR-17 — Unassign recipients

`APPLICATION_UNASSIGNED` có candidate recipients:

* Candidate;
* outgoing Recruiter A.

Sau đó áp dụng `BR-10`.

---

## BR-18 — Candidate-facing Unassign không tiết lộ nguyên nhân nội bộ

Candidate chỉ được thông báo rằng Application hiện chưa có người phụ trách hoặc đang chờ người phụ trách mới.

Không đưa nguyên nhân nội bộ như:

* Recruiter bị LOCK;
* Recruiter bị TERMINATE;
* Recruiter bị remove khỏi Recruitment Team;
* lifecycle action từ Company Manager;
* lifecycle action từ Platform Admin.

---

## BR-19 — Notification không phải cơ chế khóa Chat

`APPLICATION_UNASSIGNED` không trực tiếp cấp hoặc thu hồi quyền gửi Message.

Khả năng gửi Message phải được xác định từ current Application/Conversation state theo V11.

---

## BR-20 — Non-terminal Application Status Notification

`APPLICATION_STATUS_CHANGED` chỉ dùng cho các non-terminal status thuộc phạm vi:

* `SCREENING`;
* `CONTACTED`;
* `INTERVIEW_SCHEDULED`;
* `INTERVIEW_COMPLETED`.

Candidate là recipient sau actor filtering.

---

## BR-21 — Terminal Application event riêng

`HIRED` và `REJECTED` dùng event riêng:

* `APPLICATION_HIRED`;
* `APPLICATION_REJECTED`.

Không tạo thêm `APPLICATION_STATUS_CHANGED` cho cùng transition.

---

## BR-22 — Candidate không nhận Withdraw self-notification

Candidate thực hiện Withdraw không nhận Notification xác nhận `APPLICATION_WITHDRAWN`.

---

## BR-23 — Withdraw recipient theo Assignment state

Nếu Application Withdraw khi:

```text
ASSIGNED(A)
```

recipient là current Assigned Recruiter A.

Nếu Application Withdraw khi:

```text
UNASSIGNED
```

recipient là Primary Recruiter của Job.

Không gửi đồng thời cho cả Primary và Assigned Recruiter.

---

## BR-24 — Availability request

Khi Interview flow yêu cầu Candidate cung cấp Availability, Candidate nhận `INTERVIEW_AVAILABILITY_REQUESTED`.

Event này độc lập với `APPLICATION_STATUS_CHANGED`.

---

## BR-25 — First-submit Availability Notification

Candidate first-submit Availability thành công tạo Notification cho current Assigned Recruiter nếu Application đang `ASSIGNED`.

---

## BR-26 — Availability edit không tạo Notification

Các lần Candidate sửa Availability đã tồn tại không tạo thêm Notification trong V13.

---

## BR-27 — First-submit khi UNASSIGNED không có fallback recipient

Nếu Candidate first-submit Availability khi Application đang `UNASSIGNED`:

* không notify Primary;
* không notify outgoing Recruiter;
* không giữ Notification chờ future Assignee.

Future Assignee phải đọc current Availability sau khi được Assign.

---

## BR-28 — Schedule created Notification

Khi Interview Schedule được tạo thành công ở trạng thái `PROPOSED`, Candidate nhận `INTERVIEW_SCHEDULE_CREATED`.

---

## BR-29 — Schedule changed Notification

Các thay đổi Schedule thuộc phạm vi đã chốt, bao gồm chuyển sang `CANCELLED`, tạo `INTERVIEW_SCHEDULE_CHANGED` cho Candidate.

Không tạo event riêng `INTERVIEW_SCHEDULE_CANCELLED`.

---

## BR-30 — Schedule Confirm recipient

Candidate Confirm Schedule hợp lệ:

* notify current Assigned Recruiter nếu Application đang `ASSIGNED`;
* không notify Recruiter nào nếu Application đang `UNASSIGNED`.

Candidate không nhận self-notification.

---

## BR-31 — Schedule Decline recipient

Candidate Decline Schedule hợp lệ:

* notify current Assigned Recruiter nếu Application đang `ASSIGNED`;
* không notify Recruiter nào nếu Application đang `UNASSIGNED`.

Candidate không nhận self-notification.

---

## BR-32 — Không fallback Interview response khi UNASSIGNED

Confirm/Decline khi Application `UNASSIGNED` không fallback Notification về:

* Primary;
* outgoing Recruiter;
* Schedule creator;
* future Assignee.

---

## BR-33 — V13 không bổ sung Interview Schedule completion state/event

V13 kế thừa nguyên trạng Interview Schedule lifecycle của V12 và không bổ sung trạng thái `COMPLETED` cho `InterviewSchedule`.

V13 không định nghĩa `INTERVIEW_SCHEDULE_COMPLETED`.

Nếu Application có transition sang `INTERVIEW_COMPLETED` theo canonical pipeline của version nguồn, Notification của Application được xử lý theo `APPLICATION_STATUS_CHANGED`; V13 không suy diễn thêm một Schedule transition không tồn tại trong V12.

---

## BR-34 — Mỗi Message mới thuộc Chat realtime

Mỗi Message được V11 lưu thành công thuộc phạm vi realtime của V13, bao gồm:

* Candidate NORMAL Message;
* Assigned Recruiter NORMAL Message;
* SYSTEM Message do V11 tạo.

---

## BR-35 — Candidate Message recipient

Khi Candidate gửi Message hợp lệ, current Assigned Recruiter là Chat Notification recipient.

---

## BR-36 — Recruiter Message recipient

Khi current Assigned Recruiter gửi Message hợp lệ, Candidate là Chat Notification recipient.

Human sender không nhận Notification xác nhận cho Message chính mình gửi.

---

## BR-37 — SYSTEM Message theo quyền Conversation hiện tại

SYSTEM Message tạo Chat Notification theo recipient hợp lệ sau business transition tương ứng.

Recruiter đã mất quyền Conversation không được nhận Message mới chỉ vì từng là Assignee.

---

## BR-38 — Unassign làm Conversation không writable

Khi Application non-terminal chuyển:

```text
ASSIGNED
→ UNASSIGNED
```

Conversation interaction mode trở thành `PAUSED_UNASSIGNED`.

NORMAL Message mới không được phép cho tới khi current business state lại cho phép.

---

## BR-39 — Assign lại có thể làm Conversation writable

Khi Application non-terminal chuyển:

```text
UNASSIGNED
→ ASSIGNED
```

Conversation interaction mode trở lại `WRITABLE`.

---

## BR-40 — Terminal Application làm Conversation READ_ONLY

Khi Application trở thành terminal, Conversation interaction mode trở thành `READ_ONLY`.

---

## BR-41 — Conversation state event là realtime-only

Các state update:

* `WRITABLE`;
* `PAUSED_UNASSIGNED`;
* `READ_ONLY`

được dùng để cập nhật client realtime và không tạo durable Notification riêng chỉ vì Conversation mode thay đổi.

---

## BR-42 — Notification realtime đến mọi active session của recipient

Nếu recipient có nhiều active session, Notification realtime được phân phối cho các phiên đang hoạt động của recipient.

Không tạo thêm durable Notification theo số session.

---

## BR-43 — Tổng unread dùng chung

V13 chỉ yêu cầu tổng số Notification `UNREAD` của User.

Không có unread badge riêng theo module.

---

## BR-44 — Realtime Notification phải tương ứng với durable Notification

Không được phân phối Notification realtime khiến client tin rằng một Notification tồn tại nếu durable Notification tương ứng chưa tồn tại.

---

## BR-45 — Socket không replay toàn bộ missed events

V13 không yêu cầu replay toàn bộ realtime event mà client đã bỏ lỡ khi offline.

---

## BR-46 — Reconnect phải đồng bộ lại current data

Sau reconnect, client phải có khả năng lấy lại durable Notification và current resource state thay vì phụ thuộc vào Socket history.

---

## BR-47 — Notification sử dụng eventual consistency

Business mutation nguồn hợp lệ không bị rollback chỉ vì required Notification tạm thời chưa được tạo thành công.

---

## BR-48 — Required Notification phải được recover

Nếu một event bắt buộc có Notification nhưng Notification chưa được tạo ngay, hệ thống phải bảo đảm Notification cuối cùng được tạo.

Không được silently drop required Notification.

---

## BR-49 — Một logical event tối đa một Notification trên mỗi recipient

Cùng một logical business event không được tạo nhiều Notification cho cùng một recipient do retry hoặc recovery.

Các business event khác nhau vẫn được phép tạo các Notification riêng biệt.

---

## BR-50 — Realtime không được tạo business success giả

Không được phát Notification realtime hoặc Message realtime về một dữ liệu chưa thực sự trở thành business result hợp lệ.

Realtime không được biến một operation thất bại thành success trên UI.

---

# 11. State Transitions

## 11.1. Notification-owned transition

| Hành động             | Trước    | Sau    | Actor          |
| --------------------- | -------- | ------ | -------------- |
| Mở chính Notification | `UNREAD` | `READ` | Recipient User |

Không có transition `READ → UNREAD` trong V13.

---

## 11.2. Source transitions được V13 quan sát

Các transition dưới đây do module nguồn sở hữu; V13 chỉ tạo Notification hoặc realtime consequence.

| Business transition nguồn              | Trước                              | Sau                           | V13 consequence                                                                             |
| -------------------------------------- | ---------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| Assign                                 | `UNASSIGNED`                       | `ASSIGNED(B)`                 | `APPLICATION_ASSIGNED`; Conversation có thể trở lại `WRITABLE`.                             |
| Reassign                               | `ASSIGNED(A)`                      | `ASSIGNED(B)`                 | `APPLICATION_REASSIGNED`; giữ Conversation theo V11.                                        |
| Unassign                               | `ASSIGNED(A)`                      | `UNASSIGNED`                  | `APPLICATION_UNASSIGNED`; Conversation → `PAUSED_UNASSIGNED`.                               |
| Application non-terminal status change | Non-terminal status trước          | Non-terminal status mới       | `APPLICATION_STATUS_CHANGED` nếu thuộc phạm vi BR-20.                                       |
| Hire                                   | Non-terminal                       | `HIRED`                       | `APPLICATION_HIRED`; Conversation → `READ_ONLY`.                                            |
| Reject                                 | Non-terminal                       | `REJECTED`                    | `APPLICATION_REJECTED`; Conversation → `READ_ONLY`.                                         |
| Withdraw                               | `APPLIED`                          | `WITHDRAWN`                   | `APPLICATION_WITHDRAWN`; Conversation nếu tồn tại trở thành read-only theo lifecycle nguồn. |
| Schedule create                        | Không có active Schedule tương ứng | `PROPOSED`                    | `INTERVIEW_SCHEDULE_CREATED`.                                                               |
| Schedule change/cancel                 | Trạng thái hợp lệ trước            | Trạng thái mới thuộc flow V12 | `INTERVIEW_SCHEDULE_CHANGED` nếu thuộc BR-29.                                               |
| Candidate Confirm                      | `PROPOSED`                         | `CONFIRMED`                   | `INTERVIEW_SCHEDULE_CONFIRMED`.                                                             |
| Candidate Decline                      | `PROPOSED`                         | `DECLINED`                    | `INTERVIEW_SCHEDULE_DECLINED`.                                                              |

V13 không được tự tạo thêm source transition ngoài các transition đã tồn tại trong canonical version trước.

---

# 12. Authorization và ownership boundary

| Hành động                                   | Actor được phép                                 | Resource / Scope               | Điều kiện                                                              |
| ------------------------------------------- | ----------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| Xem Notification                            | Authenticated User                              | Notification của chính User    | User là recipient.                                                     |
| Mở Notification                             | Authenticated User                              | Notification của chính User    | User là recipient.                                                     |
| Chuyển Notification sang `READ`             | Authenticated User                              | Notification của chính User    | User mở chính Notification.                                            |
| Truy cập resource từ Notification           | Actor đã được module nguồn cho phép             | Resource hiện tại              | Phải kiểm tra current authorization; Notification không cấp quyền.     |
| Nhận Candidate Chat Message                 | Current Assigned Recruiter                      | Conversation của Application   | Phải còn current Chat authority theo V11.                              |
| Nhận Recruiter Chat Message                 | Candidate owner                                 | Conversation của Application   | Candidate sở hữu Application.                                          |
| Gửi NORMAL Message                          | Candidate owner hoặc current Assigned Recruiter | Conversation của Application   | Hoàn toàn theo V11; V13 không mở thêm quyền.                           |
| Nhận Interview response Notification        | Current Assigned Recruiter                      | Application/Schedule tương ứng | Chỉ khi Application đang `ASSIGNED` tại thời điểm phản hồi thành công. |
| Nhận Availability first-submit Notification | Current Assigned Recruiter                      | Application tương ứng          | Chỉ khi Application đang `ASSIGNED` tại thời điểm first-submit.        |

Các nguyên tắc bắt buộc:

* Notification ownership không đồng nghĩa với resource ownership.
* Recruiter cũ có thể giữ Notification lịch sử nhưng không nhờ đó có lại quyền Application hoặc Chat.
* Primary không phải Assignee không được cấp Chat authority từ Notification.
* Company Manager không được cấp Chat authority từ Notification.
* Recipient phải được xác định từ current backend state.
* Dữ liệu client cung cấp không được tự tạo authorization.

---

# 13. Multi-tenant boundary

V13 **không bổ sung multi-tenant boundary mới**.

Mọi Company/Job/Application authorization tiếp tục kế thừa canonical boundary của các version nguồn.

Các nguyên tắc V13 phải giữ:

* Notification không cho phép Recruiter truy cập resource của Company khác.
* Việc Recruiter từng nhận Notification không giữ lại quyền nếu current Company/Application authorization đã thay đổi.
* Primary, Assigned Recruiter và Company Manager chỉ được coi là các business role trong tenant hợp lệ do module nguồn xác định.
* Candidate nhận Notification với tư cách owner của Application, không phải Company member.
* Cross-tenant resource access không được phát sinh chỉ vì User biết Notification identifier hoặc resource identifier.
* V13 không được dùng identifier do client cung cấp để tự xác định Company authority.

```text
Authenticated User
        ↓
Current canonical relationship từ module nguồn
        ↓
Authorized resource scope
```

Notification không thay thế bước xác định canonical relationship.

---

# 14. Lifecycle invariants

1. Notification không thay thế Application, Conversation, Message hoặc Interview resource.
2. Realtime không thay thế durable data.
3. Notification cũ vẫn tồn tại dù resource đã thay đổi hoặc mất hiệu lực.
4. Notification không tự cấp current resource permission.
5. User chỉ thay đổi read state của Notification thuộc chính mình.
6. `READ` không tự trở lại `UNREAD`.
7. Offline recipient không làm required Notification bị mất.
8. Actor mặc định không nhận self-notification, trừ ngoại lệ đã ghi rõ.
9. Recipient luôn phải được xác định từ current trusted business state.
10. Assign, Reassign và Unassign là ba semantic event khác nhau.
11. Reassign không được biểu diễn thành Unassign + Assign.
12. Manual và automatic Unassign có cùng external Notification semantics.
13. Candidate-facing Unassign không tiết lộ internal lifecycle cause.
14. Primary không mặc nhiên nhận toàn bộ Notification của Job.
15. Interview Notification không fallback sang Primary chỉ vì Application đang `UNASSIGNED`.
16. Future Assignee không được nhận Notification cho event xảy ra trước khi họ trở thành Assignee.
17. Recruiter cũ không được nhận Interview/Chat event mới chỉ vì từng phụ trách Application.
18. Availability edit không tạo Notification.
19. V13 không bổ sung `InterviewSchedule.COMPLETED` hoặc `INTERVIEW_SCHEDULE_COMPLETED` event.
20. Conversation `PAUSED_UNASSIGNED` và `READ_ONLY` phải được backend giữ đúng kể cả khi client bỏ lỡ realtime state update.
21. Conversation state realtime không phải durable Notification.
22. Một User có nhiều active session vẫn chỉ có một durable Notification cho cùng logical event.
23. Read state dùng chung giữa các session.
24. Required Notification sử dụng eventual consistency với business mutation nguồn.
25. Business mutation đã thành công không bị rollback chỉ vì Notification tạm thời chưa được tạo.
26. Required Notification cuối cùng phải được recover.
27. Một logical business event chỉ được tạo tối đa một Notification cho mỗi recipient.
28. Notification realtime chỉ được phân phối khi durable Notification tương ứng tồn tại.
29. Job Invitation behavior không được kéo vào V13 chỉ vì data model có thể đã chứa entity liên quan.
30. V13 không được thay đổi business invariant của V09–V12 ngoài các Notification/realtime consequences được ghi rõ trong tài liệu này.

---

# 15. Các quyết định chủ động defer

Các nội dung đã được xem xét nhưng chủ động không thuộc V13:

* toàn bộ Job Invitation Notification;
* Message read receipt;
* typing indicator;
* online/offline presence;
* last seen;
* Message reaction;
* Message edit/delete;
* voice/video communication;
* dashboard realtime;
* realtime statistics;
* mark all Notifications as read;
* mark Notification as unread;
* delete Notification;
* archive Notification;
* Notification retention policy;
* badge theo từng module;
* Notification preference;
* disable Notification theo event;
* email Notification;
* mobile/device push Notification;
* SMS Notification;
* replay toàn bộ Socket event đã bỏ lỡ;
* Candidate reschedule request;
* bổ sung trạng thái `COMPLETED` cho `InterviewSchedule`;
* `INTERVIEW_SCHEDULE_COMPLETED` Notification/event.

Các nội dung trên có thể thuộc version sau.

Không được tự implement các nội dung này trong V13.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V13.

Các lựa chọn về persistence model, realtime transport contract và kiến trúc kỹ thuật không phải business requirement của tài liệu này và được xử lý ở các contract tiếp theo.

---

# 17. Definition of Business Completion

V13 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` — Notification Inbox và read state đã được đáp ứng;
* `F02` — Direct Application Notification đã được đáp ứng;
* `F03` — Assignment Notification đã được đáp ứng;
* `F04` — Application Status và Withdraw Notification đã được đáp ứng;
* `F05` — Candidate Availability Notification đã được đáp ứng;
* `F06` — Interview Schedule Notification đã được đáp ứng;
* `F07` — Chat Message Notification và realtime Message đã được đáp ứng;
* `F08` — Conversation realtime state đã được đáp ứng;
* `F09` — Realtime Notification distribution và multi-session đã được đáp ứng;
* `F10` — Offline resynchronization đã được đáp ứng;
* `F11` — Durable Notification recovery và chống duplicate đã được đáp ứng;
* toàn bộ `BR-01` đến `BR-50` đã được đáp ứng;
* Notification read lifecycle luôn đúng;
* các Assignment/Application/Interview source transitions được phản ánh đúng theo V13 consequences;
* authorization và ownership boundary được giữ;
* multi-tenant boundary của các version nguồn không bị phá vỡ;
* lifecycle invariants luôn đúng;
* required Notification cuối cùng không bị mất;
* retry/recovery không tạo duplicate Notification cho cùng recipient;
* realtime event bị bỏ lỡ không làm business correctness phụ thuộc vào UI;
* các chức năng đã defer không bị implementation ngoài ý muốn;
* Job Invitation không bị kéo vào scope V13;
* không xuất hiện behavior ngoài boundary của version.

Việc code chạy hoặc test pass **không tự động đồng nghĩa** với Business Completion nếu implementation chưa đáp ứng đầy đủ contract này.

---

# 18. Implementation Boundary

Tài liệu này là **canonical business specification** của V13.

Tài liệu này định nghĩa:

```text
WHAT MUST HAPPEN
```

không định nghĩa:

```text
HOW IT IS IMPLEMENTED
```

Tài liệu này không quy định:

* REST endpoint;
* HTTP method;
* HTTP status code;
* request/response payload;
* controller;
* service;
* route;
* middleware implementation;
* database schema;
* database relation implementation;
* database query;
* MongoDB/Mongoose implementation;
* index;
* transaction implementation;
* retry/recovery mechanism cụ thể;
* event persistence mechanism cụ thể;
* realtime room topology;
* realtime payload format;
* realtime adapter;
* cách biểu diễn sync marker;
* cách biểu diễn logical event identity;
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
