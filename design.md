Tôi muốn bạn redesign / polish toàn bộ UI của app học tiếng Nhật hiện tại.

QUAN TRỌNG:
Đây là một UI refinement, KHÔNG phải redesign UX.

Hãy giữ nguyên:
- Cấu trúc màn hình hiện tại
- Navigation hiện tại
- User flow hiện tại
- Bố cục tổng thể của từng màn hình
- Các chức năng hiện tại
- Các button hiện tại
- Các interaction hiện tại
- Logic JavaScript hiện tại
- Data structure hiện tại
- Course → Chapter → Skill → Lesson hierarchy
- Lesson → Video / Info / Flashcard / Quiz / PDF
- Progress tracking
- Complete lesson
- Các chức năng video
- Các chức năng flashcard
- Các chức năng quiz

Chỉ được thay đổi:
- Visual design
- Color system
- Typography
- Spacing
- Border radius
- Card design
- Button styling
- Progress indicators
- Icon treatment
- Shadows
- States
- Micro-interactions
- Animation
- Visual hierarchy

Mục tiêu:

Làm UI có cảm giác giống tinh thần của Duolingo:
- Friendly
- Playful
- Encouraging
- Clean
- Approachable
- Gamified
- Có cảm giác "học mà không bị áp lực"

NHƯNG:
Không copy Duolingo.
Không sử dụng logo, mascot, illustration hoặc branding của Duolingo.
Không biến app thành một bản clone Duolingo.

App vẫn phải giữ identity riêng và cảm giác là một app học tiếng Nhật nghiêm túc.

==================================================
1. VISUAL DIRECTION
==================================================

Hiện tại UI đang sử dụng dark navy theme.

Hãy chuyển visual direction sang:

LIGHT LEARNING UI

Tông tổng thể:
- Light
- Clean
- Fresh
- Friendly
- High readability
- Có màu accent để tạo động lực
- Ít cảm giác "dashboard kỹ thuật"
- Nhiều cảm giác "learning product"

Không sử dụng dark background làm màu nền chính nữa.

Background:
- Warm / very light neutral
- Có thể dùng off-white hoặc very light blue-gray
- Không dùng pure white cho toàn bộ UI nếu làm UI quá lạnh

Cards:
- White / very light surface
- Border nhẹ
- Shadow mềm
- Border radius lớn hơn hiện tại
- Không dùng heavy shadow

==================================================
2. COLOR SYSTEM
==================================================

Giữ cyan / blue là màu nhận diện chính hiện tại nhưng tinh chỉnh thành learning palette.

Primary:
- Blue / Cyan

Secondary:
- Green → completed / success
- Orange → streak / motivation / attention
- Purple → special learning / quiz / vocabulary nếu cần

Danger:
- Red chỉ dùng cho error / incorrect answer

Không sử dụng quá nhiều màu cùng lúc.

Nguyên tắc:

Primary color = navigation / CTA / progress

Green = success / completed

Orange = motivation / streak

Purple = special learning content

Red = error

Neutral = text / background

Màu sắc phải giúp người học hiểu trạng thái ngay lập tức.

==================================================
3. TYPOGRAPHY
==================================================

Typography phải thân thiện hơn hiện tại.

Ưu tiên:
- Inter
- hoặc system sans-serif hiện tại

Không dùng typography quá corporate.

Hierarchy:

Page title:
- Bold
- khoảng 24–28px

Section title:
- 18–20px
- Semi-bold

Card title:
- 16–18px
- Bold / Semi-bold

Body:
- 14–16px

Secondary:
- 12–14px

Japanese text:
- phải có line-height thoáng
- font size đủ lớn
- ưu tiên khả năng đọc hơn việc nhồi nhiều nội dung

Không sử dụng ALL CAPS quá nhiều.

Hiện tại section title đang có uppercase + letter spacing.
Hãy giảm việc sử dụng uppercase vì đây là learning app, không phải enterprise dashboard.

==================================================
4. BUTTON SYSTEM
==================================================

GIỮ NGUYÊN TẤT CẢ BUTTON HIỆN TẠI.

Không xóa button.
Không thay đổi chức năng.
Không thay đổi vị trí logic.

Chỉ redesign visual.

Button style cần có cảm giác:

- tactile
- friendly
- clear
- rewarding

Primary button:
- Filled
- Strong primary color
- Rounded
- Medium / large height
- Font weight 600–700
- Có subtle bottom shadow hoặc depth rất nhẹ
- Hover → slightly lift
- Active → slightly press down

Secondary:
- Light background
- Border
- Same radius system

Icon button:
- clean
- circular / rounded square
- clear hover state

Không làm button quá bóng hoặc quá gradient.

Không sử dụng glassmorphism.

==================================================
5. BORDER RADIUS
==================================================

Tạo một radius system nhất quán.

Small:
8px

Medium:
12px

Large:
16px

Learning card:
16–20px

Large CTA:
16px

Không sử dụng quá nhiều radius khác nhau.

==================================================
6. HOME SCREEN
==================================================

GIỮ NGUYÊN BỐ CỤC HOME HIỆN TẠI.

Hiện tại Home có:
- Header
- Banner
- Course cards
- Course progress

Giữ nguyên.

Nhưng redesign thành learning dashboard.

Banner:

Thay cảm giác dark technical banner bằng một learning welcome card.

Visual:
- sáng
- friendly
- có accent color
- có illustration / icon nếu đã có asset
- không quá nhiều gradient

Ví dụ visual hierarchy:

"Tiếp tục học"

"Minna no Nihongo N4"

"Bạn đã hoàn thành 42%"

[ Tiếp tục học ]

Progress bar:
- lớn hơn
- dễ nhìn hơn
- rounded
- màu primary
- animation nhẹ

Course cards:

Không biến thành generic SaaS cards.

Mỗi course nên giống một "learning journey card".

Card cần có:
- Course identity
- Level
- Progress
- Status
- CTA / click affordance

Progress nên dễ nhìn ngay khi scan.

Ví dụ:

N4
Minna no Nihongo

42%
━━━━━━━━━━

"Tiếp tục học"

Có thể thêm subtle visual indicator cho completed state.

==================================================
7. COURSE DETAIL SCREEN
==================================================

GIỮ NGUYÊN:

Course
→ Chapter
→ Skill
→ Lesson

Không chuyển sang roadmap mới.
Không chuyển sang layout Duolingo.

Chỉ cải thiện visual hierarchy.

Chapter:

Thiết kế thành card/section rõ ràng.

Chapter header:
- Strong title
- Number / icon
- Lesson count
- Progress
- Chevron

Skill:

Phải phân biệt rõ với Chapter nhưng không quá nhỏ.

Lesson:

Lesson item cần dễ scan.

Mỗi lesson có:
- Type icon
- Lesson name
- status
- progress / completed indicator
- arrow

Completed:
→ Green check

Available:
→ Primary CTA indicator

Locked:
→ muted lock

Không làm locked lesson quá tối hoặc quá "disabled".

==================================================
8. PROGRESS SYSTEM
==================================================

Progress là một trong những yếu tố quan trọng nhất.

Hãy làm progress visual giống learning app hiện đại.

Progress bar:
- Rounded
- 6–8px
- Smooth animation
- Clear percentage

Completed:
- Green

Active:
- Primary

Not started:
- Neutral

Progress không nên quá nhỏ như UI hiện tại.

Ở course detail:
hiển thị course progress rõ ràng ngay phía trên.

==================================================
9. LESSON SCREEN
==================================================

GIỮ NGUYÊN CẤU TRÚC:

Top bar
→ Video
→ Video controls
→ Tabs
→ Lesson content

Không thay đổi flow.

Nhưng cần cải thiện hierarchy.

Top bar:

- Cleaner
- White/light surface
- Back button dễ bấm
- Lesson title rõ
- Progress hoặc lesson context nếu phù hợp

Video:

Giữ aspect ratio hiện tại.

Video container:
- rounded bottom corners nếu không phá layout
- subtle shadow
- cleaner controls

Không làm video card quá decorative.

==================================================
10. LESSON TABS
==================================================

Hiện tại có các tab cho:
- Info
- Flashcard
- Quiz
- PDF

GIỮ NGUYÊN.

Nhưng redesign tab system:

Không dùng dark navy tab bar.

Dùng:
- light background
- active tab có primary color
- active indicator rõ ràng
- inactive tab neutral

Tab phải giống navigation của learning app.

Active:
Primary text
Subtle background
hoặc underline / pill

Không dùng quá nhiều border.

==================================================
11. FLASHCARD
==================================================

Flashcard cần là một trong những UI đẹp nhất.

Giữ nguyên functionality.

Nhưng visual:

- Large card
- Centered Japanese text
- Large typography
- Clear reading
- Meaning
- Example
- Audio button

Card:
- White surface
- Large radius
- Soft shadow
- Lots of whitespace

Interaction:
- subtle lift
- flip animation nếu hiện tại đã có interaction
- audio button tactile

Không nhồi quá nhiều information.

Japanese text phải là visual focus.

==================================================
12. QUIZ
==================================================

Quiz cần có cảm giác giống practice session.

Giữ nguyên:
- Question
- Answer options
- Submit
- Score
- Next question

Redesign:

Question:
- large
- clear
- centered hoặc strong hierarchy

Answer buttons:
- large touch target
- rounded
- white surface
- border

Selected:
- primary highlight

Correct:
- green

Incorrect:
- red

Feedback animation:
- subtle
- không quá distracting

Không dùng animation quá mạnh.

==================================================
13. COMPLETION STATE
==================================================

Khi user hoàn thành lesson:

Không chỉ hiện toast nhỏ.

Hãy tạo visual feedback tốt hơn nếu UX hiện tại cho phép mà không phá flow.

Ví dụ:
- check animation
- progress update
- subtle celebration
- button state chuyển sang completed

Cảm giác:

"Bạn vừa hoàn thành một bước học."

Không biến thành game quá mức.

==================================================
14. MICRO INTERACTION
==================================================

Thêm micro interaction vừa phải.

Buttons:
hover → translateY(-1px)

active → translateY(1px)

Cards:
hover → subtle lift

Progress:
smooth fill animation

Completed:
check animation

Tabs:
smooth active transition

Accordion:
smooth expand/collapse

Page transition:
subtle fade/slide

Không sử dụng animation quá nhiều.

Mục tiêu:
UI cảm giác responsive và polished.

==================================================
15. DUOLINGO-LIKE PRINCIPLES
==================================================

Hãy lấy cảm hứng từ các NGUYÊN TẮC của Duolingo, không copy giao diện.

Các nguyên tắc cần áp dụng:

1. Clear visual hierarchy
2. Strong feedback
3. Visible progress
4. Friendly colors
5. Rounded UI
6. Large touch targets
7. Encouraging states
8. Low cognitive load
9. Immediate feedback
10. Learning-first interface

Nhưng KHÔNG:
- clone Duolingo layout
- clone mascot
- clone illustrations
- clone exact colors
- clone exact components
- clone exact navigation

==================================================
16. ACCESSIBILITY
==================================================

Đảm bảo:

- Text contrast tốt
- Button dễ nhìn
- Touch target tối thiểu khoảng 44px
- Japanese text dễ đọc
- Không dùng màu sắc làm indicator duy nhất
- Focus state rõ
- Hover không phải interaction duy nhất

==================================================
17. RESPONSIVE
==================================================

UI phải hoạt động tốt trên:

- Mobile
- Tablet
- Desktop

Ưu tiên mobile learning experience.

Không làm desktop UI quá stretched.

Giữ max-width hợp lý cho lesson content.

Video vẫn giữ aspect ratio.

==================================================
18. CODE CONSTRAINTS
==================================================

Đây là UI refinement.

KHÔNG rewrite toàn bộ application.

Không thay đổi:
- Data model
- API
- Data loading
- State management
- Existing JS logic
- Existing event handlers
- Lesson data
- Course data
- Quiz logic
- Flashcard logic
- Video logic

Chỉ refactor CSS / HTML structure khi thực sự cần để đạt visual quality.

Nếu cần chỉnh HTML:
- giữ nguyên ID
- giữ nguyên class hooks mà JavaScript đang sử dụng
- không break existing selectors
- không break event listeners

Đặc biệt không được làm hỏng các element hiện tại như:
- btn-complete-lesson
- btn-back-lesson
- btn-back-lesson
- tab buttons
- video controls
- flashcard controls
- quiz controls

==================================================
19. DESIGN SYSTEM
==================================================

Hãy tạo lại CSS design tokens rõ ràng:

--color-primary
--color-primary-dark
--color-primary-light

--color-success
--color-warning
--color-error

--color-background
--color-surface
--color-surface-secondary

--color-text
--color-text-secondary
--color-text-muted

--radius-sm
--radius-md
--radius-lg
--radius-xl

--shadow-sm
--shadow-md
--shadow-lg

--space-xs
--space-sm
--space-md
--space-lg
--space-xl

Mọi component nên sử dụng design tokens thay vì hard-code quá nhiều giá trị.

==================================================
20. OVERALL FEEL
==================================================

Sau khi redesign, khi nhìn vào app phải có cảm giác:

"Đây là một app học tiếng Nhật hiện đại,
thân thiện,
dễ tiếp cận,
có động lực học,
nhưng vẫn nghiêm túc và có hệ thống."

Không được có cảm giác:

- Enterprise dashboard
- Admin panel
- Technical tool
- Dark developer UI
- Copy Duolingo

==================================================
21. IMPORTANT FINAL REQUIREMENT
==================================================

Trước khi code:

1. Inspect toàn bộ HTML/CSS/JS hiện tại.
2. Xác định tất cả screen.
3. Xác định tất cả interactive elements.
4. Xác định các class/id đang được JS sử dụng.
5. Không phá vỡ functionality.

Sau đó:

1. Tạo visual design system mới.
2. Refactor CSS.
3. Chỉnh component styling.
4. Thêm micro-interactions.
5. Kiểm tra responsive.
6. Kiểm tra tất cả button.
7. Kiểm tra course navigation.
8. Kiểm tra lesson.
9. Kiểm tra flashcard.
10. Kiểm tra quiz.
11. Kiểm tra video.
12. Kiểm tra progress.
13. Kiểm tra completion state.

Cuối cùng hãy đảm bảo app vẫn hoạt động giống hệt trước đây về mặt chức năng, chỉ khác về visual design.

==================================================
22. ABSOLUTELY NO AI / CHAT VISUAL LANGUAGE
==================================================

TUYỆT ĐỐI KHÔNG sử dụng visual language mang tính AI hoặc chatbot.

Không sử dụng:
- Icon tin nhắn / chat bubble
- Icon chatbot
- Robot
- Sparkle / ✨ AI-style icons
- Wand / magic icons
- Neural network graphics
- Brain + technology graphics
- AI assistant visual patterns
- Chat interface patterns
- Prompt/input box giống AI
- Gradient tím/xanh kiểu AI SaaS
- Glow effect kiểu AI
- Các icon hoặc illustration khiến người dùng liên tưởng đến ChatGPT, Gemini, Claude hoặc AI product

Đặc biệt:
KHÔNG dùng icon hình bong bóng tin nhắn để biểu thị:
- Bài học
- Flashcard
- Quiz
- Ghi chú
- Tiến độ
- Feedback
- Nội dung học tập

Thay vào đó, ưu tiên visual language của một LEARNING APP:

- Book
- Notebook
- Pencil
- Graduation cap
- Vocabulary card
- Check
- Trophy
- Target
- Calendar
- Clock
- Play
- Volume
- Headphones
- Bookmark
- Star
- Fire / streak
- Flag
- Progress indicators
- Lesson-specific icons

Icon phải có cảm giác:
- Education
- Practice
- Progress
- Achievement
- Human learning

Không có cảm giác:
- Artificial Intelligence
- Chatbot
- SaaS
- Developer tool

Nếu cần biểu thị "trợ giúp" hoặc "giải thích":
→ sử dụng Help / Info / Lightbulb icon đơn giản,
không sử dụng chat bubble hoặc AI sparkle.

Nếu cần biểu thị feedback:
→ sử dụng Check / X / Info / Warning,
không sử dụng chat icon.

Nếu cần biểu thị nội dung:
→ sử dụng Book / File / Note / Card,
không sử dụng chat bubble.

Mọi icon cần đồng nhất về:
- Stroke width
- Corner style
- Visual weight
- Size
- Color

Ưu tiên icon đơn giản, friendly, educational và dễ nhận diện.

IMPORTANT:
The product should immediately look like a LANGUAGE LEARNING APP,
not an AI APP.