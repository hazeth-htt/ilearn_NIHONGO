/* ============================================================
   iLearn - RIKI E-Learning Web App
   Figma Component Architecture + Progress & Cross-Device Sync
============================================================ */
'use strict';

const CONFIG = {
  DRIVE_FOLDER_ID:    localStorage.getItem('rikiclone_drive_folder_id') || '1TDzaHM_XLu_oJLgmeeA06EZ10t2bFWw5',
  MANIFEST_FILE_ID:   localStorage.getItem('rikiclone_manifest_file_id') || '1-_G-dL7U6UuP1hsHYg2lPVce4AN3bJNH',
  LESSONS_DB_FILE_ID: '1EEGQOMy3H9w8LHQp7_Z2tdkhIYVAC6do',
};

// ============================================================
// DATA SOURCE
// ============================================================
const DataSource = {
  manifest: null,
  lessonsDb: null,
  videoIndex: {},
  mode: 'loading',

  driveEmbedUrl(fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  },
  driveViewUrl(fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`;
  },

  async loadManifest() {
    try {
      const res = await fetch('/manifest.json');
      if (res.ok) {
        const text = await res.text();
        if (text.trim().startsWith('{')) {
          this.manifest = JSON.parse(text);
          this.videoIndex = this.manifest.video_index || {};
          this.mode = 'drive';
          console.log(`✅ Local manifest loaded: ${Object.keys(this.videoIndex).length} videos`);
          return true;
        }
      }
    } catch(e) {}

    const fileId = CONFIG.MANIFEST_FILE_ID;
    if (!fileId) return false;
    const urls = [
      `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`,
      `https://drive.google.com/uc?export=download&id=${fileId}&confirm=1`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const text = await res.text();
        if (!text.trim().startsWith('{')) continue;
        this.manifest = JSON.parse(text);
        this.videoIndex = this.manifest.video_index || {};
        this.mode = 'drive';
        return true;
      } catch(e) {}
    }
    return false;
  },

  async loadLessonsDb() {
    try {
      const res = await fetch('/lessons_db.json');
      if (res.ok) {
        this.lessonsDb = await res.json();
        console.log(`✅ Lessons DB loaded: ${Object.keys(this.lessonsDb).length} bài học`);
        return true;
      }
    } catch(e) {}
    return false;
  },

  getCourses() {
    if (!this.manifest) throw new Error('manifest.json chưa được tải');
    return this.manifest.courses.map(c => ({
      id: c.id,
      name: c.name,
      thumbnail: c.thumbnail,
      expired_time: c.expired_time,
    }));
  },

  getCurriculum(courseId) {
    if (!this.manifest) throw new Error('manifest.json chưa được tải');
    const course = this.manifest.courses.find(c => c.id === courseId);
    if (!course) throw new Error(`Không tìm thấy khóa học ID ${courseId}`);
    return course.curriculum || [];
  },

  getLessonDetail(lessonId) {
    if (!this.lessonsDb) throw new Error('lessons_db.json chưa được tải');
    const lid = String(lessonId);
    let lesson = this.lessonsDb[lid];
    if (!lesson) {
      for (const key in this.lessonsDb) {
        if (String(this.lessonsDb[key].id) === lid || String(this.lessonsDb[key].exercise_id) === lid) {
          lesson = this.lessonsDb[key];
          break;
        }
      }
    }
    if (!lesson) throw new Error(`Không tìm thấy bài học ID ${lessonId}`);
    return lesson;
  },

  getVideoSource(lessonId) {
    const entry = this.videoIndex[String(lessonId)];
    if (entry && entry.file_id) {
      return {
        type: 'drive_embed',
        embed_url: entry.embed_url || this.driveEmbedUrl(entry.file_id),
        file_id: entry.file_id,
      };
    }
    return null;
  },

  getPdfSource(lessonData) {
    return lessonData.document_url || null;
  }
};

// ============================================================
// APP STATE
// ============================================================
const State = {
  courses: [],
  currentCourse: null,
  currentLesson: null,
  currentLessonData: null,
  fc: { cards: [], index: 0, flipped: false, known: new Set(), unknown: new Set() },
  quiz: {
    groups: [],
    allQuestions: [],
    userAnswers: {},
    submitted: false,
    score: 0
  },
  progress: {},
  hls: null
};

// ============================================================
// UTILS & MEDIA CONTROLLER
// ============================================================
function stopCurrentMedia() {
  const videoEl = document.getElementById('main-video');
  if (videoEl) {
    if (typeof videoEl.pause === 'function') {
      try { videoEl.pause(); } catch(e) {}
    }
    if (typeof videoEl.removeAttribute === 'function') {
      try { videoEl.removeAttribute('src'); } catch(e) {}
    }
    if (typeof videoEl.load === 'function') {
      try { videoEl.load(); } catch(e) {}
    }
  }

  if (State.hls) {
    try { State.hls.destroy(); } catch(e) {}
    State.hls = null;
  }

  const iframe = document.getElementById('drive-video-iframe');
  if (iframe) {
    iframe.src = 'about:blank';
    iframe.remove();
  }

  document.querySelectorAll('audio').forEach(a => {
    try {
      if (typeof a.pause === 'function') a.pause();
      a.currentTime = 0;
    } catch(e) {}
  });
}

function showScreen(id) {
  const activeScreen = document.querySelector('.screen.active');
  if (activeScreen && activeScreen.id === 'screen-lesson' && id !== 'screen-lesson') {
    stopCurrentMedia();
  }

  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
    requestAnimationFrame(() => el.classList.add('active'));
  }
}

function toast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// Clean Figma Vuesax Linear Icons
function lessonTypeIcon(type) {
  switch(type) {
    case 1: // Video
      return `<svg class="icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
    case 2: // Flashcard
      return `<svg class="icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`;
    case 3: // Quiz
      return `<svg class="icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 14l2 2 4-4"></path></svg>`;
    case 4: // Folder / Chapter
      return `<svg class="icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    case 5: // Exam
      return `<svg class="icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
    default:
      return `<svg class="icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
  }
}

function lessonTypeName(type) {
  return { 1: 'Bài giảng video', 2: 'Flashcard từ vựng', 3: 'Bài tập trắc nghiệm', 4: 'Danh mục', 5: 'Đề thi' }[type] || 'Bài học';
}

function formatRikiText(text) {
  if (!text) return '';
  text = text.replace(/\|([^⌊]+)⌊([^⌉]+)⌉/g, '<ruby>$1<rt>$2</rt></ruby>');
  text = text.replace(/([一-龥々]+)\(([^)]+)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
  text = text.replace(/⇒([^⇐]+)⇐/g, '<u class="quiz-target">$1</u>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

function loadProgress() {
  try {
    const s = localStorage.getItem('rikiclone_settings');
    if (s) {
      const settings = JSON.parse(s);
      if (settings.driveFolderId) CONFIG.DRIVE_FOLDER_ID = settings.driveFolderId;
    }
    const p = localStorage.getItem('rikiclone_progress');
    if (p) State.progress = JSON.parse(p);
  } catch(e) {}
}

function saveProgress() {
  localStorage.setItem('rikiclone_progress', JSON.stringify(State.progress));
  updateGlobalProgressBadge();
}

function updateGlobalProgressBadge() {
  const completed = Object.values(State.progress).filter(p => p && p.complete).length;
  const total = 2103;
  const pct = Math.round((completed / total) * 100);
  const badge = document.getElementById('nav-progress-text');
  if (badge) badge.textContent = `Tiến độ: ${pct}% (${completed}/${total})`;
}

// ============================================================
// INIT
// ============================================================
async function init() {
  loadProgress();
  showScreen('screen-splash');
  const fill = document.getElementById('loading-fill');
  const txt  = document.getElementById('loading-text');

  try {
    if (fill) fill.style.width = '20%';
    if (txt) txt.textContent = 'Đang tải danh mục khóa học...';
    const manifestOk = await DataSource.loadManifest();
    if (!manifestOk) throw new Error('Không tải được manifest.json');

    if (fill) fill.style.width = '60%';
    if (txt) txt.textContent = 'Đang tải dữ liệu bài học & câu hỏi...';
    const dbOk = await DataSource.loadLessonsDb();
    if (!dbOk) throw new Error('Không tải được lessons_db.json');

    DataSource.mode = 'drive';
    const courses = DataSource.getCourses();
    State.courses = courses;

    if (fill) fill.style.width = '100%';
    if (txt) txt.textContent = `Sẵn sàng: ${courses.length} khóa học (${Object.keys(DataSource.lessonsDb).length} bài)`;

    await new Promise(r => setTimeout(r, 350));
    renderHome();
    updateGlobalProgressBadge();
    showScreen('screen-home');

  } catch(err) {
    console.error(err);
    if (fill) {
      fill.style.background = '#E64B56';
      fill.style.width = '100%';
    }
    if (txt) {
      txt.innerHTML = `Lỗi tải dữ liệu: ${err.message}<br><small style="opacity:0.8">Hãy đảm bảo manifest.json và lessons_db.json nằm trong thư mục webapp/</small>`;
    }
  }
}

// ============================================================
// HOME SCREEN (Figma Node 4133:2948)
// ============================================================
const COURSE_LEVELS = { 12:'N4', 11:'N3j', 3:'N3t', 16:'N3l' };
const COURSE_BADGES = {
  12: { kanji: '初', name: 'JLPT N4', sub: 'Minna no Nihongo N4 • 117 bài' },
  11: { kanji: '準', name: 'JLPT N3', sub: 'N3 Junbi Cơ Bản • 622 bài' },
  3:  { kanji: '策', name: 'N3 Taisaku', sub: 'Chiến Thuật Giải Đề • 912 bài' },
  16: { kanji: '練', name: 'N3 Luyện Đề', sub: 'Thực Chiến Phòng Thi • 452 bài' }
};

function renderHome() {
  const grid = document.getElementById('course-grid');
  if (!grid) return;
  grid.innerHTML = '';

  renderResumeBanner();

  if (!State.courses.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px 20px">
        <div style="font-size:16px;font-weight:700;color:var(--color-text);margin-bottom:8px">Chưa có dữ liệu khóa học</div>
        <div style="font-size:13px;color:var(--color-text-muted)">
          Hãy kiểm tra file manifest.json và lessons_db.json trong thư mục webapp.
        </div>
      </div>`;
    return;
  }

  State.courses.forEach(course => {
    const completed = countCompleted(course.id);
    const total = State.progress[`total_${course.id}`] || (course.id === 12 ? 117 : course.id === 11 ? 622 : course.id === 3 ? 912 : 452);
    const pct = total > 0 ? Math.round(completed / total * 100) : 0;
    const level = COURSE_LEVELS[course.id] || 'N';
    const badgeInfo = COURSE_BADGES[course.id] || { kanji: '日', name: 'JLPT', sub: 'Khóa học tiếng Nhật' };

    const card = document.createElement('div');
    card.className = 'course-card';
    card.setAttribute('data-level', level);
    card.innerHTML = `
      <div class="course-card-top">
        <div class="course-top-kanji">${badgeInfo.kanji}</div>
      </div>
      <div class="course-card-body">
        <div class="course-card-name">${course.name}</div>
        <div class="course-card-meta">${badgeInfo.sub}</div>
        <div class="course-card-expired">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <span>${completed} / ${total} bài đã hoàn thành</span>
        </div>
        <div class="course-card-progress">
          <div class="mini-progress-track"><div class="mini-progress-fill" style="width:${pct}%"></div></div>
          <span class="mini-progress-pct">${pct}%</span>
        </div>
      </div>`;
    card.addEventListener('click', () => openCourse(course));
    grid.appendChild(card);
  });

  const btnSettings = document.getElementById('btn-settings');
  if (btnSettings) btnSettings.onclick = openSettings;

  const btnProgress = document.getElementById('btn-open-progress');
  if (btnProgress) btnProgress.onclick = openProgressModal;
}

function renderResumeBanner() {
  const banner = document.getElementById('resume-banner');
  if (!banner) return;

  const lastLessonId = State.progress._lastLessonId;
  const lastCourseId = State.progress._lastCourseId;

  if (lastLessonId && State.courses.length) {
    try {
      const lesson = DataSource.getLessonDetail(lastLessonId);
      const course = State.courses.find(c => c.id === lastCourseId) || State.courses[0];
      document.getElementById('resume-lesson-title').textContent = lesson.name || 'Bài học gần nhất';
      document.getElementById('resume-course-name').textContent = `${course.name} • ${lessonTypeName(lesson.type)}`;
      banner.style.display = 'flex';

      const btnAction = document.getElementById('btn-resume-action');
      if (btnAction) {
        btnAction.onclick = () => {
          State.currentCourse = course;
          openLesson(lastLessonId);
        };
      }
      return;
    } catch(e) {}
  }
  banner.style.display = 'none';
}

function countCompleted(courseId) {
  return Object.entries(State.progress)
    .filter(([k, v]) => k.startsWith(`${courseId}_`) && v?.complete).length;
}

// ============================================================
// PROGRESS MODAL & CROSS-DEVICE SYNC
// ============================================================
function openProgressModal() {
  const modal = document.getElementById('progress-modal');
  if (!modal) return;

  const totalLessons = 2103;
  const completedCount = Object.values(State.progress).filter(p => p && p.complete).length;
  const totalPct = Math.round((completedCount / totalLessons) * 100);

  document.getElementById('pstat-total-pct').textContent = `${totalPct}%`;
  document.getElementById('pstat-bar-total').style.width = `${totalPct}%`;
  document.getElementById('pstat-total-count').textContent = `${completedCount} / ${totalLessons} bài`;

  const list = document.getElementById('progress-courses-list');
  if (list && State.courses.length) {
    list.innerHTML = State.courses.map(c => {
      const done = countCompleted(c.id);
      const total = State.progress[`total_${c.id}`] || (c.id === 12 ? 117 : c.id === 11 ? 622 : c.id === 3 ? 912 : 452);
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return `
        <div class="pcourse-row">
          <div class="pcourse-header">
            <span class="pcourse-title">${c.name}</span>
            <span class="pcourse-stat">${done} / ${total} bài (${pct}%)</span>
          </div>
          <div class="mini-progress-track"><div class="mini-progress-fill" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');
  }

  modal.style.display = 'flex';
}

function closeProgressModal() {
  const modal = document.getElementById('progress-modal');
  if (modal) modal.style.display = 'none';
}

function copySyncCode() {
  try {
    const dataStr = JSON.stringify(State.progress);
    const base64 = btoa(unescape(encodeURIComponent(dataStr)));
    navigator.clipboard.writeText(base64).then(() => {
      toast('Đã sao chép mã đồng bộ vào Clipboard!');
    }).catch(() => {
      prompt('Mã đồng bộ của bạn (Hãy sao chép):', base64);
    });
  } catch(e) {
    toast('Lỗi tạo mã: ' + e.message);
  }
}

function exportProgressFile() {
  try {
    const dataStr = JSON.stringify(State.progress, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riki_progress_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Đã tải file sao lưu tiến độ!');
  } catch(e) {
    toast('Lỗi xuất file: ' + e.message);
  }
}

function importSyncCode() {
  const input = document.getElementById('sync-import-code');
  if (!input || !input.value.trim()) {
    toast('Vui lòng dán mã đồng bộ vào ô!');
    return;
  }
  try {
    const raw = input.value.trim();
    let parsed = null;
    try {
      const decoded = decodeURIComponent(escape(atob(raw)));
      parsed = JSON.parse(decoded);
    } catch(e) {
      parsed = JSON.parse(raw);
    }
    if (parsed && typeof parsed === 'object') {
      State.progress = { ...State.progress, ...parsed };
      saveProgress();
      openProgressModal();
      renderHome();
      toast('Đồng bộ tiến độ thành công!');
      input.value = '';
    } else {
      throw new Error('Định dạng mã không hợp lệ');
    }
  } catch(e) {
    toast('Lỗi nhập mã: ' + e.message);
  }
}

// ============================================================
// COURSE DETAIL SCREEN (Figma Node 7411:13738)
// ============================================================
function openCourse(course) {
  State.currentCourse = course;
  document.getElementById('course-title').textContent = course.name;
  const currNameEl = document.getElementById('curriculum-course-name');
  if (currNameEl) currNameEl.textContent = course.name;

  showScreen('screen-course');
  try {
    const curriculum = DataSource.getCurriculum(course.id);
    const leaves = flattenLeaves(curriculum);
    State.progress[`total_${course.id}`] = leaves.length;
    const done = leaves.filter(l => State.progress[`${course.id}_${l.id}`]?.complete).length;
    updateCourseProgress(done, leaves.length);
    renderCourseTree(curriculum, course.id);
  } catch(e) {
    document.getElementById('lesson-tree').innerHTML =
      `<div style="text-align:center;padding:40px;color:var(--color-error)">Lỗi: ${e.message}</div>`;
  }
}

function flattenLeaves(nodes) {
  let r = [];
  for (const n of nodes) {
    const kids = n.children || [];
    if (kids.length) r = r.concat(flattenLeaves(kids));
    else r.push(n);
  }
  return r;
}

function updateCourseProgress(done, total) {
  document.getElementById('progress-text').textContent = `${done} / ${total} bài đã hoàn thành`;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  document.getElementById('progress-pct').textContent = `${pct}%`;
  document.getElementById('progress-fill').style.width = `${pct}%`;
}

function renderCourseTree(curriculum, courseId) {
  const tree = document.getElementById('lesson-tree');
  tree.innerHTML = '';
  curriculum.forEach((chapter, ci) => {
    const el = document.createElement('div');
    el.className = 'lesson-chapter';
    const children = chapter.children || [];
    el.innerHTML = `
      <div class="chapter-header" onclick="toggleChapter(this)">
        <span class="chapter-icon">${lessonTypeIcon(chapter.type)}</span>
        <span class="chapter-name">${chapter.name}</span>
        <span class="chapter-count">${children.length} phần</span>
        <span class="chapter-arrow">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </span>
      </div>
      <div class="chapter-lessons">${renderChildren(children, courseId)}</div>`;
    tree.appendChild(el);
    if (ci === 0) {
      el.querySelector('.chapter-lessons').classList.add('open');
      el.querySelector('.chapter-arrow').classList.add('open');
    }
  });
}

function renderChildren(nodes, courseId) {
  if (!nodes?.length) return '';
  return nodes.map(node => {
    const kids = node.children || [];
    if (kids.length) {
      return `<div class="skill-group">
        <div class="skill-header" onclick="toggleSkill(this)">
          <span class="skill-icon">${lessonTypeIcon(node.type)}</span>
          <span class="skill-name">${node.name}</span>
          <span class="chapter-count">${kids.length} bài</span>
          <span class="skill-arrow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </span>
        </div>
        <div class="skill-lessons">${kids.map(l => renderLeaf(l, courseId)).join('')}</div>
      </div>`;
    }
    return renderLeaf(node, courseId);
  }).join('');
}

function renderLeaf(leaf, courseId) {
  const isDone = State.progress[`${courseId}_${leaf.id}`]?.complete;
  const hasVideo = DataSource.videoIndex[String(leaf.id)]?.file_id;
  const badge = hasVideo
    ? '<span style="font-size:10px;background:rgba(85,55,234,0.15);color:var(--color-secondary-pink);padding:2px 8px;border-radius:10px;margin-left:8px;font-weight:700;border:1px solid rgba(85,55,234,0.3)">Drive HD</span>'
    : '';
  return `
    <div class="lesson-item" onclick="openLesson(${leaf.id})">
      <span class="lesson-type-icon">${lessonTypeIcon(leaf.type)}</span>
      <span class="lesson-item-name">${leaf.name}${badge}</span>
      ${isDone
        ? '<div class="lesson-done-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>'
        : '<span class="lesson-lock"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></span>'
      }
    </div>`;
}

function toggleChapter(h) {
  h.nextElementSibling.classList.toggle('open');
  h.querySelector('.chapter-arrow').classList.toggle('open');
}

function toggleSkill(h) {
  h.nextElementSibling.classList.toggle('open');
  h.querySelector('.skill-arrow').classList.toggle('open');
}

function goHome() {
  stopCurrentMedia();
  showScreen('screen-home');
  renderHome();
}

// ============================================================
// LESSON SCREEN
// ============================================================
function openLesson(lessonId) {
  stopCurrentMedia();
  State.currentLesson = lessonId;

  // Track last visited lesson
  State.progress._lastLessonId = lessonId;
  if (State.currentCourse) State.progress._lastCourseId = State.currentCourse.id;
  saveProgress();

  showScreen('screen-lesson');
  try {
    const detail = DataSource.getLessonDetail(lessonId);
    State.currentLessonData = detail;
    renderLesson(detail);
  } catch(e) {
    toast('Lỗi: ' + e.message);
  }
}

function renderLesson(lesson) {
  const lname = lesson.name || 'Bài học';
  document.getElementById('lesson-topbar-title').textContent = lname;
  document.getElementById('lesson-name-info').textContent = lname;

  const ltype = lesson.type;
  const videoUrls = lesson.video_url || [];
  const vocabs = lesson.vocabularies || [];

  // Metadata
  const meta = [];
  if (lesson.time) meta.push(`Thời lượng: ${Math.round(lesson.time/60)} phút`);
  meta.push(`${lessonTypeName(ltype)}`);
  if (lesson.is_complete) meta.push('Đã hoàn thành');
  document.getElementById('lesson-meta').textContent = meta.join('  ·  ');
  document.getElementById('lesson-desc').innerHTML = formatRikiText(lesson.description || '');

  // ============================================================
  // VIDEO PLAYER
  // ============================================================
  const videoContainer = document.getElementById('video-container');
  const videoEl = document.getElementById('main-video');
  const srcInfo = document.getElementById('video-source-info');
  const overlay = document.getElementById('video-overlay');

  if (ltype === 1 || videoUrls.length > 0) {
    videoContainer.style.display = 'block';
    const driveSrc = DataSource.getVideoSource(State.currentLesson);

    if (driveSrc) {
      videoEl.style.display = 'none';
      if (overlay) overlay.classList.add('hidden');
      document.querySelector('.video-controls-custom').style.display = 'none';

      const iframe = document.createElement('iframe');
      iframe.id = 'drive-video-iframe';
      iframe.src = driveSrc.embed_url;
      iframe.style.cssText = 'width:100%;height:100%;border:none;position:absolute;top:0;left:0;z-index:2;';
      iframe.allow = 'autoplay; fullscreen';
      iframe.allowFullscreen = true;
      videoContainer.appendChild(iframe);

      srcInfo.innerHTML = `Nguồn phát: <b>Google Drive Player (1080p)</b> • <a href="https://drive.google.com/file/d/${driveSrc.file_id}/view" target="_blank" style="color:var(--color-secondary-pink);font-weight:700">Mở trên Google Drive ↗</a>`;

    } else if (videoUrls.length > 0) {
      videoEl.style.display = 'block';
      document.querySelector('.video-controls-custom').style.display = 'block';
      if (overlay) overlay.classList.remove('hidden');

      const m3u8 = videoUrls[0].url;

      if (window.Hls && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hls.loadSource(m3u8);
        hls.attachMedia(videoEl);
        State.hls = hls;
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        videoEl.src = m3u8;
      }

      const playBig = document.getElementById('play-btn-big');
      if (playBig) {
        playBig.onclick = () => {
          videoEl.play().catch(() => {});
        };
      }

      const vcPlay = document.getElementById('vc-play');
      if (vcPlay) {
        vcPlay.onclick = () => {
          if (videoEl.paused) videoEl.play();
          else videoEl.pause();
        };
      }

      document.getElementById('vc-back10').onclick = () => { videoEl.currentTime = Math.max(0, videoEl.currentTime - 10); };
      document.getElementById('vc-fwd10').onclick  = () => { videoEl.currentTime += 10; };
      document.getElementById('vc-speed').onchange = e => { videoEl.playbackRate = parseFloat(e.target.value); };

      videoEl.onplay = () => {
        if (overlay) overlay.classList.add('hidden');
        if (vcPlay) vcPlay.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> <span>Tạm dừng</span>`;
      };
      videoEl.onpause = () => {
        if (vcPlay) vcPlay.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> <span>Phát</span>`;
      };

      const savedPos = State.progress[`${State.currentCourse?.id}_${State.currentLesson}`]?.lastPosition;
      if (savedPos) videoEl.currentTime = savedPos;

      videoEl.ontimeupdate = () => {
        const key = `${State.currentCourse?.id}_${State.currentLesson}`;
        if (!State.progress[key]) State.progress[key] = {};
        State.progress[key].lastPosition = videoEl.currentTime;
        if (videoEl.duration > 0 && videoEl.currentTime / videoEl.duration > 0.85) {
          State.progress[key].complete = true;
        }
        saveProgress();
      };

      srcInfo.innerHTML = `Nguồn phát: <b>HLS Streaming 1080p</b>`;
    }
  } else {
    videoContainer.style.display = 'none';
  }

  // ============================================================
  // PDF VIEWER & ATTACHMENT
  // ============================================================
  const pdfUrl = DataSource.getPdfSource(lesson);
  const attachBox = document.getElementById('lesson-attachment-box');
  const btnInfoPdfDl = document.getElementById('btn-info-pdf-dl');
  const attachFileName = document.getElementById('attachment-filename');

  if (pdfUrl) {
    if (attachBox) {
      attachBox.style.display = 'flex';
      const fname = pdfUrl.split('/').pop().split('?')[0] || 'Tai_lieu_bai_hoc.pdf';
      if (attachFileName) attachFileName.textContent = decodeURIComponent(fname);
      if (btnInfoPdfDl) btnInfoPdfDl.href = pdfUrl;
    }

    document.getElementById('pdf-placeholder').style.display = 'none';
    document.getElementById('pdf-viewer-wrap').style.display = 'block';
    document.getElementById('pdf-iframe').src = pdfUrl;
    document.getElementById('pdf-dl-link').href = pdfUrl;
    document.getElementById('pdf-open-btn').onclick = () => window.open(pdfUrl, '_blank');
  } else {
    if (attachBox) attachBox.style.display = 'none';
    document.getElementById('pdf-placeholder').style.display = 'block';
    document.getElementById('pdf-viewer-wrap').style.display = 'none';
  }

  // ============================================================
  // FLASHCARD
  // ============================================================
  if (vocabs.length) {
    document.getElementById('flashcard-empty').style.display = 'none';
    document.getElementById('flashcard-wrap').style.display = 'block';
    State.fc = { cards: vocabs, index: 0, flipped: false, known: new Set(), unknown: new Set() };
    renderFlashcard();
  } else {
    document.getElementById('flashcard-empty').style.display = 'block';
    document.getElementById('flashcard-wrap').style.display = 'none';
  }

  // ============================================================
  // QUIZ & EXAMS
  // ============================================================
  setupQuiz(lesson);

  // Next lessons
  renderNextLessons(lesson.lessons_after || []);

  // Complete button
  document.getElementById('btn-complete-lesson').onclick = () => {
    if (!State.currentCourse) return;
    const key = `${State.currentCourse.id}_${State.currentLesson}`;
    if (!State.progress[key]) State.progress[key] = {};
    State.progress[key].complete = true;
    saveProgress();
    toast('Đã hoàn thành bài học!');
  };

  document.getElementById('btn-back-lesson').onclick = () => {
    stopCurrentMedia();
    if (State.currentCourse) showScreen('screen-course');
    else showScreen('screen-home');
  };

  // Pre-select active tab
  if (ltype === 2) {
    switchTab('tab-flashcard');
  } else if (ltype === 3 || ltype === 5) {
    switchTab('tab-quiz');
  } else if (ltype === 1 || videoUrls.length > 0) {
    switchTab('tab-info');
  } else if (pdfUrl) {
    switchTab('tab-pdf');
  } else {
    switchTab('tab-info');
  }
}

// ============================================================
// TABS
// ============================================================
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`)?.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ============================================================
// FLASHCARD
// ============================================================
function renderFlashcard() {
  const fc = State.fc;
  if (!fc.cards.length) return;
  const card = fc.cards[fc.index];
  document.getElementById('fc-current').textContent = fc.index + 1;
  document.getElementById('fc-total').textContent = fc.cards.length;
  document.getElementById('fc-kanji').innerHTML = formatRikiText(card.previous_name || '');
  document.getElementById('fc-reading').textContent = card.example || '';
  document.getElementById('fc-meaning').textContent = card.back_name || '';
  document.getElementById('fc-example').textContent = card.latin || '';
  document.getElementById('fc-card').classList.remove('flipped');
  fc.flipped = false;
  document.getElementById('btn-fc-audio').style.display = card.audio ? 'inline-flex' : 'none';
}

function flipCard() {
  const el = document.getElementById('fc-card');
  if (!el) return;
  State.fc.flipped = !State.fc.flipped;
  el.classList.toggle('flipped', State.fc.flipped);
}

function playFlashcardAudio() {
  const card = State.fc.cards[State.fc.index];
  if (!card?.audio) return;
  new Audio(card.audio).play().catch(() => toast('Không phát được âm thanh'));
}

function nextCard() {
  State.fc.index = (State.fc.index + 1) % State.fc.cards.length;
  renderFlashcard();
}

function prevCard() {
  State.fc.index = (State.fc.index - 1 + State.fc.cards.length) % State.fc.cards.length;
  renderFlashcard();
}

function markKnown() {
  State.fc.known.add(State.fc.index);
  toast(`Đã thuộc: ${State.fc.known.size}/${State.fc.cards.length} từ`);
  nextCard();
}

function markUnknown() {
  State.fc.unknown.add(State.fc.index);
  toast('Sẽ ôn lại từ này');
  nextCard();
}

// ============================================================
// ALL-IN-ONE QUIZ & EXAMS
// ============================================================
function setupQuiz(lesson) {
  const questionGroups = lesson.question_groups || [];
  const examinations = lesson.examinations || [];

  let groups = [];
  let allQuestions = [];

  if (questionGroups.length > 0) {
    questionGroups.forEach((g, gIdx) => {
      const qList = (g.questions || []).map(q => ({
        ...q,
        _groupId: g.id,
        _audio: q.audio || g.audio,
        _images: q.images?.length ? q.images : (g.images || [])
      }));
      if (qList.length > 0) {
        groups.push({
          title: g.name || (questionGroups.length > 1 ? `Phần ${gIdx + 1}` : ''),
          audio: g.audio,
          images: g.images || [],
          questions: qList
        });
        allQuestions.push(...qList);
      }
    });
  }

  if (examinations.length > 0) {
    examinations.forEach(exam => {
      (exam.mondais || []).forEach((m, mIdx) => {
        let mondaiQuestions = [];
        (m.question_groups || []).forEach(g => {
          const qList = (g.questions || []).map(q => ({
            ...q,
            _groupId: g.id,
            _audio: q.audio || g.audio || m.audio,
            _images: q.images?.length ? q.images : (g.images?.length ? g.images : (m.images || []))
          }));
          mondaiQuestions.push(...qList);
        });

        if (mondaiQuestions.length > 0) {
          groups.push({
            title: m.name || `Mondai ${mIdx + 1}`,
            audio: m.audio,
            images: m.images || [],
            questions: mondaiQuestions
          });
          allQuestions.push(...mondaiQuestions);
        }
      });
    });
  }

  if (allQuestions.length === 0) {
    document.getElementById('quiz-empty').style.display = 'block';
    document.getElementById('quiz-wrap').style.display = 'none';
    return;
  }

  document.getElementById('quiz-empty').style.display = 'none';
  document.getElementById('quiz-wrap').style.display = 'block';

  State.quiz = {
    groups,
    allQuestions,
    userAnswers: {},
    submitted: false,
    score: 0
  };

  renderAllQuizQuestions();
}

function renderAllQuizQuestions() {
  const container = document.getElementById('quiz-questions-container');
  if (!container) return;
  container.innerHTML = '';

  const banner = document.getElementById('quiz-result-banner');
  if (banner) banner.style.display = 'none';

  const btnSubmit = document.getElementById('btn-submit-all-quiz');
  if (btnSubmit) btnSubmit.style.display = 'block';

  const btnQuickSubmit = document.getElementById('btn-quick-submit');
  if (btnQuickSubmit) btnQuickSubmit.style.display = 'block';

  const btnRestart = document.getElementById('btn-restart-quiz');
  if (btnRestart) btnRestart.style.display = 'none';

  updateQuizProgressBadge();

  let globalQIndex = 1;

  State.quiz.groups.forEach((group) => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'quiz-group-block';

    let groupHeaderHtml = '';
    if (group.title || group.audio || group.images?.length) {
      let audioHtml = group.audio ? `<audio controls src="${group.audio}"></audio>` : '';
      let imgHtml = (group.images || []).map(img => `<img src="${img.url || img}" style="max-width:100%;border-radius:8px;margin-bottom:8px">`).join('');
      groupHeaderHtml = `
        <div class="quiz-group-header">
          ${group.title ? `<div class="quiz-group-title">${formatRikiText(group.title)}</div>` : ''}
          ${(audioHtml || imgHtml) ? `<div class="quiz-group-media">${audioHtml}${imgHtml}</div>` : ''}
        </div>`;
    }

    let questionsHtml = group.questions.map((q) => {
      const qNum = globalQIndex++;
      let qAudio = q._audio && q._audio !== group.audio ? `<audio controls src="${q._audio}"></audio>` : '';
      let qImg = (q._images || []).map(img => `<img src="${img.url || img}" style="max-width:100%;border-radius:8px;margin:8px 0">`).join('');

      const answersHtml = (q.answers || []).map((ans, aIdx) => `
        <div class="quiz-answer" data-qid="${q.id}" data-aid="${ans.id}" onclick="selectQuizOption(${q.id}, ${ans.id})">
          <div class="answer-label">${String.fromCharCode(65 + aIdx)}</div>
          <span>${formatRikiText(ans.name || '')}</span>
        </div>
      `).join('');

      return `
        <div class="quiz-question-card" id="qcard-${q.id}">
          <div class="quiz-question-header">
            <span class="quiz-question-num">Câu ${qNum}</span>
            <div class="quiz-question-text">${formatRikiText(q.name || '')}</div>
          </div>
          ${qAudio || qImg ? `<div style="margin-bottom:10px">${qAudio}${qImg}</div>` : ''}
          <div class="quiz-answer-list">
            ${answersHtml}
          </div>
          ${q.script ? `<div class="quiz-explanation" id="qexpl-${q.id}"><b>Giải thích:</b> ${formatRikiText(q.script)}</div>` : ''}
        </div>
      `;
    }).join('');

    groupDiv.innerHTML = groupHeaderHtml + questionsHtml;
    container.appendChild(groupDiv);
  });
}

function selectQuizOption(questionId, answerId) {
  if (State.quiz.submitted) return;

  State.quiz.userAnswers[questionId] = answerId;

  const qCard = document.getElementById(`qcard-${questionId}`);
  if (qCard) {
    qCard.querySelectorAll('.quiz-answer').forEach(el => {
      const aid = parseInt(el.getAttribute('data-aid') || el.dataset?.aid || '0');
      const isSelected = aid === answerId;
      el.classList.toggle('selected', isSelected);
    });
  }

  updateQuizProgressBadge();
}

function updateQuizProgressBadge() {
  const answered = Object.keys(State.quiz.userAnswers).length;
  const total = State.quiz.allQuestions.length;
  const badge = document.getElementById('quiz-answered-count');
  if (badge) {
    badge.textContent = `Đã làm: ${answered} / ${total} câu`;
  }
}

function submitQuiz() {
  if (State.quiz.submitted) return;

  const total = State.quiz.allQuestions.length;
  const answered = Object.keys(State.quiz.userAnswers).length;

  if (answered < total) {
    const confirmSubmit = confirm(`Bạn mới làm ${answered}/${total} câu. Bạn có chắc chắn muốn nộp bài không?`);
    if (!confirmSubmit) return;
  }

  State.quiz.submitted = true;
  let correctCount = 0;

  State.quiz.allQuestions.forEach(q => {
    const qCard = document.getElementById(`qcard-${q.id}`);
    if (!qCard) return;

    const userSelectedAid = State.quiz.userAnswers[q.id];
    const answers = q.answers || [];
    const correctAnswer = answers.find(a => a.is_correct === 1 || a.is_correct === true);
    const correctId = correctAnswer?.id ?? null;

    if (correctId !== null) {
      const isCorrect = userSelectedAid === correctId;
      if (isCorrect) correctCount++;

      qCard.classList.add(isCorrect ? 'graded-correct' : 'graded-wrong');

      qCard.querySelectorAll('.quiz-answer').forEach(el => {
        const aid = parseInt(el.getAttribute('data-aid') || el.dataset?.aid || '0');
        el.classList.remove('selected');
        el.classList.add('disabled');
        if (aid === correctId) {
          el.classList.add('correct');
        } else if (aid === userSelectedAid) {
          el.classList.add('wrong');
        }
      });
    } else {
      if (userSelectedAid) {
        correctCount++;
        qCard.classList.add('graded-correct');
        qCard.querySelectorAll('.quiz-answer').forEach(el => {
          const aid = parseInt(el.getAttribute('data-aid') || el.dataset?.aid || '0');
          el.classList.remove('selected');
          el.classList.add('disabled');
          if (aid === userSelectedAid) {
            el.classList.add('correct');
          }
        });
      }
    }

    const expl = document.getElementById(`qexpl-${q.id}`);
    if (expl) expl.classList.add('show');
  });

  State.quiz.score = correctCount;
  const pct = Math.round((correctCount / total) * 100);

  const banner = document.getElementById('quiz-result-banner');
  if (banner) {
    banner.style.display = 'block';
    document.getElementById('quiz-result-score').textContent = `${correctCount} / ${total} câu (${pct}%)`;
    document.getElementById('quiz-result-msg').textContent =
      pct >= 80 ? 'Xuất sắc! Bạn đã nắm vững nội dung bài học.' :
      pct >= 60 ? 'Tốt lắm! Hãy xem lại các câu chưa chính xác.' :
      'Hãy ôn lại lý thuyết và làm lại bài tập để đạt kết quả cao hơn.';
  }

  const btnSubmit = document.getElementById('btn-submit-all-quiz');
  if (btnSubmit) btnSubmit.style.display = 'none';

  const btnQuickSubmit = document.getElementById('btn-quick-submit');
  if (btnQuickSubmit) btnQuickSubmit.style.display = 'none';

  const btnRestart = document.getElementById('btn-restart-quiz');
  if (btnRestart) btnRestart.style.display = 'block';

  if (State.currentCourse) {
    const key = `${State.currentCourse.id}_${State.currentLesson}`;
    if (!State.progress[key]) State.progress[key] = {};
    State.progress[key].complete = true;
    saveProgress();
  }

  toast(`Đã nộp bài: Đạt ${correctCount}/${total} câu (${pct}%)`);

  const quizTab = document.getElementById('tab-quiz');
  if (quizTab) quizTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function restartQuiz() {
  State.quiz.userAnswers = {};
  State.quiz.submitted = false;
  State.quiz.score = 0;
  renderAllQuizQuestions();
  toast('Đã làm mới bài tập');
}

// ============================================================
// NEXT LESSONS
// ============================================================
function renderNextLessons(nexts) {
  const container = document.getElementById('next-cards');
  if (!container) return;
  if (!nexts?.length) {
    document.getElementById('next-lesson-wrap').innerHTML =
      '<div class="empty-state"><p>Đây là bài học cuối cùng trong phần này.</p></div>';
    return;
  }
  container.innerHTML = nexts.slice(0, 6).map(n => `
    <div class="next-card" onclick="openLesson(${n.id})">
      <div class="next-card-icon">${lessonTypeIcon(n.type)}</div>
      <div class="next-card-info">
        <div class="next-card-name">${n.name || 'Bài tiếp theo'}</div>
        <div class="next-card-type">${lessonTypeName(n.type)}</div>
      </div>
      <div class="next-card-arrow">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    </div>`).join('');
}

// ============================================================
// SETTINGS
// ============================================================
function openSettings() {
  document.getElementById('settings-modal').style.display = 'flex';
  document.getElementById('drive-folder-id').value = CONFIG.DRIVE_FOLDER_ID;
}

function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

function saveSettings() {
  const folderId = document.getElementById('drive-folder-id').value.trim();
  CONFIG.DRIVE_FOLDER_ID = folderId;
  localStorage.setItem('rikiclone_drive_folder_id', folderId);
  closeSettings();
  toast('Đã lưu cài đặt');
}

function changeDataSource() {}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', e => {
  const activeScreen = document.querySelector('.screen.active')?.id;
  if (activeScreen === 'screen-lesson') {
    const video = document.getElementById('main-video');
    if (video && video.style.display !== 'none') {
      if (e.code === 'Space') {
        e.preventDefault();
        if (video.paused) video.play();
        else video.pause();
      }
      if (e.code === 'ArrowRight') video.currentTime += 10;
      if (e.code === 'ArrowLeft')  video.currentTime = Math.max(0, video.currentTime - 10);
      if (e.code === 'ArrowUp')    video.volume = Math.min(1, video.volume + 0.1);
      if (e.code === 'ArrowDown')  video.volume = Math.max(0, video.volume - 0.1);
    }
  }
});

const settingsModal = document.getElementById('settings-modal');
if (settingsModal) {
  settingsModal.addEventListener('click', function(e) {
    if (e.target === this) closeSettings();
  });
}

const progressModal = document.getElementById('progress-modal');
if (progressModal) {
  progressModal.addEventListener('click', function(e) {
    if (e.target === this) closeProgressModal();
  });
}

// ============================================================
// START
// ============================================================
window.addEventListener('DOMContentLoaded', init);
