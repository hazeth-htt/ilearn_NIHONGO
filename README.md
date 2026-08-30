# 🎌 iLearn NIHONGO - Nền tảng Học Tiếng Nhật Trực Tuyến JLPT N4 - N3

Ứng dụng học tiếng Nhật toàn diện lưu trữ dữ liệu vĩnh viễn trên Google Drive. Thiết kế theo tiêu chuẩn Figma **iLearn E-Learning UI Design System** (Deep Slate `#10111A`, Brand Purple `#5537EA`, Accent Pink `#EF77D3`).

---

## 📁 Cấu Trúc Thư Mục Dự Án (Project Structure)

```text
RIKICLONE/
├── webapp/                    # 🌐 Ứng dụng Web chính (Deploy lên Vercel)
│   ├── index.html             # Giao diện chính Single Page Application
│   ├── style.css              # Hệ thống style dark theme & responsive
│   ├── app.js                 # Xử lý logic học tập, media, mini-games & sync
│   ├── hls.min.js             # Thư viện phát video HLS stream
│   ├── lessons_db.json        # Cơ sở dữ liệu 2,353 bài học, câu hỏi, flashcard
│   ├── manifest.json          # Danh mục 4 khóa học & 1,591 video Google Drive
│   ├── vercel.json            # Cấu hình rewrite static cho webapp
│   └── icons/                 # Bộ icon chuẩn Figma
│
├── docs/                      # 📚 Tài liệu & Thiết kế
│   └── design.md              # Bản đặc tả thiết kế iLearn UI & tiêu chuẩn UX
│
├── tools/                     # 🛠️ Bộ công cụ & Scripts dữ liệu
│   ├── riki_downloader.py     # Script tải video khóa học & xử lý HLS
│   ├── Riki_DataDumper.ipynb  # Jupyter Notebook cào & trích xuất dữ liệu
│   └── course_12_curriculum.json # Dữ liệu raw curriculum gốc
│
├── server.py                  # 🚀 Local CORS Server chạy trên máy Mac / LAN
├── vercel.json                # ⚙️ Cấu hình deploy tự động cho Vercel
├── netlify.toml               # ⚙️ Cấu hình deploy Netlify dự phòng
├── .gitignore                 # Danh sách loại trừ file video/tạm khỏi git
└── README.md                  # Hướng dẫn dự án
```

---

## 🌟 Tính Năng Nổi Bật

- **Trọn bộ 4 khóa học & 2,103 bài học JLPT:**
  - 📘 **Minna no Nihongo N4** (117 bài)
  - 📗 **N3 Junbi Nền Tảng** (622 bài)
  - 📙 **N3 Taisaku Chiến Thuật Giải Đề** (912 bài)
  - 📕 **N3 Luyện Đề Thực Chiến** (452 bài)
- **1,591 Video HD 1080p:** Phát mượt mà qua Google Drive Player & HLS Stream.
- **Tài liệu PDF Đính Kèm (783 bài):** Xem trực tiếp trong bài hoặc tải về máy.
- **4 Chế độ Game Học Từ Vựng:**
  1. Thẻ 3D Lật Mặt (3D Flashcards)
  2. Ghép Thẻ Nhanh 2 Cột (Word Match Challenge)
  3. Trắc Nghiệm Phản Xạ Nhanh (Speed Vocab Quiz)
  4. Xếp Ký Tự / Đố Chữ (Character Scramble)
- **Hệ Thống Theo Dõi Tiến Độ Toàn Diện:**
  - Thanh tiến độ hiển thị chi tiết `%` hoàn thành của từng Chương lớn & Nhóm bài.
  - Huy hiệu `✓ Đã hoàn thành` trực quan tại danh mục bài học.
  - Popup chúc mừng hoàn thành kèm chuyển bài nhanh.
- **Bảo Mật & Đồng Bộ Đám Mây Realtime:**
  - Cổng đăng nhập master chuyên biệt bảo vệ tài nguyên.
  - Tự động đồng bộ tiến độ học tập giữa Máy tính, iPhone, iPad.

---

## 🚀 Hướng Dẫn Deploy Lên Vercel

1. Kết nối repository này với tài khoản [Vercel](https://vercel.com).
2. Thiết lập:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./`
   - File cấu hình `vercel.json` đã được cài đặt sẵn để phục vụ trực tiếp thư mục `webapp/`.
3. Nhấn **Deploy** là xong!

---

## 💻 Chạy Cục Bộ (Local Server)

```bash
python3 server.py
```
- **Máy tính:** Mở trình duyệt tại `http://localhost:8080`
- **Điện thoại / iPad:** Truy cập theo địa chỉ IP mạng LAN hiển thị trên terminal (ví dụ: `http://192.168.1.x:8080`).
