#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
RIKI Nihongo Course Downloader
Tự động lấy toàn bộ bài học, tài liệu PDF, flashcard, và video từ tài khoản Riki.
"""

import os
import sys
import json
import re
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_API = "https://api-online.riki.edu.vn/api/v1/client"

HEADERS = {
    "Host": "api-online.riki.edu.vn",
    "Cookie": "riki_nihongo_session=bcHSRHz9IfbW0BIaYaFulwwXYabcn81O0jIcl3Ki",
    "accept": "application/json",
    "hidden-data-access": "0",
    "platform": "iOS-iOS-iPhone-26.3.1-3.5.4",
    "user-agent": "RikiNihongo/3.5.4 (com.riki.RikiNihongo; build:1; iOS 26.3.1) Alamofire/5.10.2",
    "authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2FwaS1vbmxpbmUucmlraS5lZHUudm4vYXBpL3YxL2NsaWVudC9hdXRoL2xvZ2luIiwiaWF0IjoxNzcxODE1NzM2LCJleHAiOjIzMzcxODE1NzM2LCJuYmYiOjE3NzE4MTU3MzYsImp0aSI6IkhaSVJRenZNNENmSWs0T0siLCJzdWIiOiIxOTQwODUiLCJwcnYiOiIyM2JkNWM4OTQ5ZjYwMGFkYjM5ZTcwMWM0MDA4NzJkYjdhNTk3NmY3In0.EYNS9pOz45e1mXjVSnNPud4sZc_fyxP33s4ZTTKJni0"
}

def sanitize_filename(name):
    """Làm sạch tên file để không bị lỗi hệ điều hành"""
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = name.strip()
    return name or "unnamed"

def api_get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"[-] Lỗi gọi API {url}: {e}")
        return None

def get_my_courses():
    """Lấy danh sách các khóa học đã đăng ký"""
    url = f"{BASE_API}/my-course"
    res = api_get(url)
    if res and res.get('status', {}).get('code') == 200:
        return res['data'].get('courses', [])
    return []

def get_course_curriculum(course_id):
    """Lấy cây thư mục bài học của khóa học"""
    url = f"{BASE_API}/my-course/detail-lesson-in-course/{course_id}"
    res = api_get(url)
    if res and res.get('status', {}).get('code') == 200:
        return res['data'].get('lessons', [])
    return []

def get_lesson_detail(lesson_id):
    """Lấy chi tiết 1 bài học (video url, pdf url, bài tập, flashcard)"""
    url = f"{BASE_API}/my-course/lesson/{lesson_id}"
    res = api_get(url)
    if res and res.get('status', {}).get('code') == 200:
        return res['data'].get('lesson', {})
    return None

def get_summary_documents(course_id):
    """Lấy tài liệu tổng hợp của khóa học"""
    url = f"{BASE_API}/my-course/summary-documents/{course_id}"
    res = api_get(url)
    if res and res.get('status', {}).get('code') == 200:
        return res['data'].get('documents', [])
    return []

def download_file(url, output_path):
    """Tải 1 file bất kỳ (PDF, Image, Audio)"""
    if not url:
        return False
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        return True # Đã tải rồi
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            content = resp.read()
            with open(output_path, 'wb') as f:
                f.write(content)
        print(f"  [✓] Đã tải: {os.path.basename(output_path)}")
        return True
    except Exception as e:
        print(f"  [✗] Lỗi tải file {url}: {e}")
        return False

def download_hls_video(m3u8_url, output_mp4_path, quality="1080p"):
    """Tải và ghép video HLS (m3u8) thành file mp4 trực tiếp bằng Python"""
    if os.path.exists(output_mp4_path) and os.path.getsize(output_mp4_path) > 1024 * 100:
        print(f"  [✓] Video đã tồn tại: {os.path.basename(output_mp4_path)}")
        return True

    os.makedirs(os.path.dirname(output_mp4_path), exist_ok=True)
    
    # Lấy master playlist
    base_url = m3u8_url.rsplit('/', 1)[0]
    try:
        req = urllib.request.Request(m3u8_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            playlist_content = resp.read().decode('utf-8')
    except Exception as e:
        print(f"  [✗] Lỗi đọc playlist {m3u8_url}: {e}")
        return False

    # Tìm stream m3u8 theo chất lượng
    target_m3u8 = None
    if f"{quality}/index.m3u8" in playlist_content:
        target_m3u8 = f"{base_url}/{quality}/index.m3u8"
    elif "720p/index.m3u8" in playlist_content:
        target_m3u8 = f"{base_url}/720p/index.m3u8"
    elif "480p/index.m3u8" in playlist_content:
        target_m3u8 = f"{base_url}/480p/index.m3u8"
    else:
        # Nếu playlist đã là stream m3u8 trực tiếp
        target_m3u8 = m3u8_url

    # Đọc danh sách chunks .ts
    chunk_base = target_m3u8.rsplit('/', 1)[0]
    try:
        req = urllib.request.Request(target_m3u8, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            stream_content = resp.read().decode('utf-8')
    except Exception as e:
        print(f"  [✗] Lỗi đọc stream m3u8 {target_m3u8}: {e}")
        return False

    ts_files = []
    for line in stream_content.splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            ts_url = f"{chunk_base}/{line}" if not line.startswith('http') else line
            ts_files.append(ts_url)

    if not ts_files:
        print(f"  [✗] Không tìm thấy đoạn video phân đoạn nào!")
        return False

    print(f"  [*] Đang tải video ({len(ts_files)} phân đoạn): {os.path.basename(output_mp4_path)}...")

    # Tải các đoạn TS đa luồng
    def fetch_ts(index_url_pair):
        idx, u = index_url_pair
        for _ in range(3):
            try:
                r = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(r, timeout=30) as p:
                    return idx, p.read()
            except:
                pass
        return idx, b""

    chunks_data = [None] * len(ts_files)
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_ts, (i, url)) for i, url in enumerate(ts_files)]
        for f in as_completed(futures):
            idx, data = f.result()
            chunks_data[idx] = data

    # Nối tất cả các chunk thành 1 file mp4
    temp_path = output_mp4_path + ".tmp"
    with open(temp_path, 'wb') as out_f:
        for chunk in chunks_data:
            if chunk:
                out_f.write(chunk)

    if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
        os.rename(temp_path, output_mp4_path)
        print(f"  [✓] Hoàn tất video: {os.path.basename(output_mp4_path)} ({round(os.path.getsize(output_mp4_path)/(1024*1024), 2)} MB)")
        return True
    return False

def flatten_lessons(nodes, prefix=""):
    """Duyệt đệ quy cây bài học để lấy danh sách bài học lá (leaf lessons)"""
    results = []
    for i, node in enumerate(nodes, 1):
        name = sanitize_filename(node.get("name", f"Lesson_{node.get('id')}"))
        current_path = os.path.join(prefix, f"{i:02d}_{name}") if prefix else f"{i:02d}_{name}"
        
        children = node.get("children", [])
        if children:
            results.extend(flatten_lessons(children, current_path))
        else:
            node["folder_path"] = prefix
            node["order_name"] = f"{i:02d}_{name}"
            results.append(node)
    return results

def process_course(course_id, download_videos=False):
    """Xử lý tải toàn bộ dữ liệu 1 khóa học"""
    courses = get_my_courses()
    course_info = next((c for c in courses if c["id"] == course_id), None)
    course_name = sanitize_filename(course_info["name"]) if course_info else f"Course_{course_id}"
    
    base_dir = os.path.join(os.getcwd(), course_name)
    os.makedirs(base_dir, exist_ok=True)
    print(f"\n==========================================")
    print(f" ĐANG XỬ LÝ: {course_name} (ID: {course_id})")
    print(f" Thư mục lưu trữ: {base_dir}")
    print(f"==========================================")

    # 1. Tải tài liệu tổng hợp nếu có
    print("\n[*] Đang kiểm tra tài liệu tổng hợp...")
    docs = get_summary_documents(course_id)
    if docs:
        doc_dir = os.path.join(base_dir, "00_Tai_Lieu_Tong_Hop")
        for d in docs:
            doc_url = d.get("link_document_file") or d.get("document_url")
            d_name = sanitize_filename(d.get("title", "Tai_lieu")) + ".pdf"
            if doc_url:
                download_file(doc_url, os.path.join(doc_dir, d_name))

    # 2. Lấy toàn bộ cây mục lục bài học
    print("\n[*] Đang tải cấu trúc bài học...")
    curriculum = get_course_curriculum(course_id)
    if not curriculum:
        print("[-] Không lấy được danh mục bài học!")
        return

    # Lưu lại file JSON cấu trúc gốc
    with open(os.path.join(base_dir, "curriculum.json"), "w", encoding="utf-8") as f:
        json.dump(curriculum, f, ensure_ascii=False, indent=2)

    leaf_lessons = flatten_lessons(curriculum)
    print(f"[+] Tìm thấy tổng cộng: {len(leaf_lessons)} bài học/phần luyện tập.")

    # 3. Lặp qua từng bài học để lấy chi tiết, PDF và Video
    index_md_lines = [f"# Mục lục bài học: {course_name}\n\n"]

    for idx, item in enumerate(leaf_lessons, 1):
        lid = item["id"]
        lname = item.get("name", "")
        folder = os.path.join(base_dir, item.get("folder_path", ""))
        os.makedirs(folder, exist_ok=True)

        print(f"\n[{idx}/{len(leaf_lessons)}] Đang xử lý: {lname} (ID: {lid})")
        detail = get_lesson_detail(lid)
        if not detail:
            continue

        # Lưu thông tin chi tiết bài học ra JSON
        lesson_json_path = os.path.join(folder, f"{sanitize_filename(lname)}_info.json")
        with open(lesson_json_path, "w", encoding="utf-8") as f:
            json.dump(detail, f, ensure_ascii=False, indent=2)

        # 3.1. Tải tài liệu PDF của bài học
        doc_url = detail.get("document_url")
        if doc_url:
            pdf_path = os.path.join(folder, f"{sanitize_filename(lname)}.pdf")
            download_file(doc_url, pdf_path)
            index_md_lines.append(f"- **{lname}**: [Tài liệu PDF]({pdf_path})")

        # 3.2. Xử lý Video
        video_urls = detail.get("video_url")
        if video_urls and isinstance(video_urls, list):
            m3u8_link = video_urls[0].get("url")
            if m3u8_link:
                index_md_lines.append(f"  - Video stream: `{m3u8_link}`")
                if download_videos:
                    video_output = os.path.join(folder, f"{sanitize_filename(lname)}.mp4")
                    download_hls_video(m3u8_link, video_output)

    # Ghi file mục lục Markdown
    with open(os.path.join(base_dir, "INDEX.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(index_md_lines))

    print(f"\n[✓] HOÀN TẤT KHÓA HỌC: {course_name}")
    print(f"[✓] Xem mục lục và file tại: {base_dir}")

def main():
    print("====================================================")
    print("   RIKI NIHONGO AUTOMATIC COURSE DOWNLOADER         ")
    print("====================================================")

    courses = get_my_courses()
    if not courses:
        print("[-] Không lấy được danh sách khóa học hoặc Token hết hạn!")
        return

    print("\nDanh sách các khóa học của bạn:")
    for idx, c in enumerate(courses, 1):
        print(f" [{idx}] {c['name']} (ID: {c['id']}, Hạn: {c['expired_time']})")

    print("\nBạn muốn làm gì?")
    print(" 1. Tải toàn bộ Tài liệu PDF + Mục lục + Link Video (Rất nhanh, ~1-2 phút)")
    print(" 2. Tải ĐẦY ĐỦ (Bao gồm tải toàn bộ Video MP4 1080p + PDF + Mục lục)")
    print(" 3. Tải riêng 1 khóa học chỉ định")

    choice = input("\nNhập lựa chọn của bạn (1/2/3) [Mặc định: 1]: ").strip() or "1"

    if choice == "1":
        for c in courses:
            process_course(c["id"], download_videos=False)
    elif choice == "2":
        for c in courses:
            process_course(c["id"], download_videos=True)
    elif choice == "3":
        c_idx = int(input(f"Chọn số thứ tự khóa học (1-{len(courses)}): ").strip()) - 1
        dl_vid = input("Bạn có muốn tải cả Video MP4 không? (y/n) [Mặc định: n]: ").strip().lower() == "y"
        process_course(courses[c_idx]["id"], download_videos=dl_vid)

if __name__ == "__main__":
    main()
