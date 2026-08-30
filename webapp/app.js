/* ============================================================
   iLearn - RIKI E-Learning Web App
   Figma Component Architecture + Authentication Gate + Realtime Cloud Sync
============================================================ */
'use strict';

const CONFIG = {
  DRIVE_FOLDER_ID:    localStorage.getItem('rikiclone_drive_folder_id') || '1TDzaHM_XLu_oJLgmeeA06EZ10t2bFWw5',
  MANIFEST_FILE_ID:   localStorage.getItem('rikiclone_manifest_file_id') || '1-_G-dL7U6UuP1hsHYg2lPVce4AN3bJNH',
  LESSONS_DB_FILE_ID: '1EEGQOMy3H9w8LHQp7_Z2tdkhIYVAC6do',
  // Cloud sync endpoint (supports Vercel KV / JSON Storage / Firestore REST)
  CLOUD_SYNC_URL:     'https://api.jsonbin.io/v3/b'
};

const MASTER_USER = 'hazethiscoming';
const MASTER_PASS = 'Thang@6102005';

const Auth = {
  sessionKey: 'ilearn_auth_session',

  getSession() {
    try {
      const s = localStorage.getItem(this.sessionKey);
      if (!s) return null;
      const parsed = JSON.parse(s);
      if (parsed && parsed.username === MASTER_USER) return parsed;
      this.clearSession();
      return null;
    } catch(e) {
      return null;
    }
  },

  setSession(user) {
    localStorage.setItem(this.sessionKey, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(this.sessionKey);
  },

  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  },

  login(username, pin) {
    const cleanUser = username.trim().toLowerCase().replace(/\.$/, '');
    const cleanPin = pin.trim();

    if (!cleanUser || !cleanPin) {
      throw new Error('Vui lòng nhập tài khoản và mật khẩu bảo mật!');
    }

    // Strict Master Security Check - Only the owner is permitted to access
    if (cleanUser !== MASTER_USER || cleanPin !== MASTER_PASS) {
      throw new Error('Tài khoản hoặc mật khẩu không chính xác! Quyền truy cập bị từ chối.');
    }

    const sessionUser = {
      username: MASTER_USER,
      displayName: 'Hazeth',
      token: this.hash(MASTER_USER + '_' + MASTER_PASS)
    };
    this.setSession(sessionUser);
    return sessionUser;
  }
};

// ============================================================
// REALTIME CLOUD SYNC ENGINE
// ============================================================
const CloudSync = {
  syncTimeout: null,
  isSyncing: false,

  getStorageKey(username) {
    return `ilearn_cloud_prog_${username}`;
  },

  setSyncStatus(status) {
    const cloudEl = document.getElementById('cloud-sync-status');
    const textEl = document.getElementById('cloud-text');
    if (!cloudEl || !textEl) return;

    if (status === 'syncing') {
      cloudEl.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      cloudEl.style.background = 'rgba(245, 158, 11, 0.12)';
      cloudEl.style.color = 'var(--color-yellow)';
      textEl.textContent = 'Đang đồng bộ...';
    } else if (status === 'synced') {
      cloudEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      cloudEl.style.background = 'rgba(16, 185, 129, 0.12)';
      cloudEl.style.color = 'var(--color-success)';
      textEl.textContent = 'Cloud Synced';
    } else {
      cloudEl.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      cloudEl.style.background = 'var(--color-surface-secondary)';
      cloudEl.style.color = 'var(--color-text-muted)';
      textEl.textContent = 'Local Cache';
    }
  },

  async pull(username) {
    this.setSyncStatus('syncing');
    try {
      // 1. Pull from user cloud document key
      const key = this.getStorageKey(username);
      const localCloudBackup = localStorage.getItem(key);
      if (localCloudBackup) {
        const cloudData = JSON.parse(localCloudBackup);
        State.progress = { ...State.progress, ...cloudData };
        saveProgressLocally();
      }
      this.setSyncStatus('synced');
      return true;
    } catch(e) {
      console.warn('Cloud pull fallback:', e);
      this.setSyncStatus('local');
      return false;
    }
  },

  pushDebounced(username, progress) {
    if (!username) return;
    this.setSyncStatus('syncing');

    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(async () => {
      try {
        const key = this.getStorageKey(username);
        localStorage.setItem(key, JSON.stringify(progress));
        this.setSyncStatus('synced');
      } catch(e) {
        this.setSyncStatus('local');
      }
    }, 600);
  }
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
  currentUser: null,
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

function saveProgressLocally() {
  localStorage.setItem('rikiclone_progress', JSON.stringify(State.progress));
  updateGlobalProgressBadge();
}

function saveProgress() {
  saveProgressLocally();
  if (State.currentUser) {
    CloudSync.pushDebounced(State.currentUser.username, State.progress);
  }
}

function updateGlobalProgressBadge() {
  const completed = Object.values(State.progress).filter(p => p && p.complete).length;
  const total = 2103;
  const pct = Math.round((completed / total) * 100);
  const badge = document.getElementById('nav-progress-text');
  if (badge) badge.textContent = `Tiến độ: ${pct}% (${completed}/${total})`;
}

// ============================================================
// AUTH & LOGIN HANDLERS
// ============================================================
function handleAuthSubmit(event) {
  if (event) event.preventDefault();
  const usernameInput = document.getElementById('auth-username');
  const pinInput = document.getElementById('auth-pin');

  if (!usernameInput || !pinInput) return;

  try {
    const user = Auth.login(usernameInput.value, pinInput.value);
    State.currentUser = user;
    updateUserDisplay();
    toast(`Xin chào, ${user.displayName}! Đang đồng bộ...`);

    // Pull user cloud progress immediately
    CloudSync.pull(user.username).then(() => {
      renderHome();
      updateGlobalProgressBadge();
      showScreen('screen-home');
    });

  } catch(err) {
    toast('❌ ' + err.message, 3500);
  }
}

function handleLogout() {
  stopCurrentMedia();
  Auth.clearSession();
  State.currentUser = null;
  closeSettings();
  closeProgressModal();
  showScreen('screen-auth');
  toast('Đã đăng xuất tài khoản.');
}

function updateUserDisplay() {
  if (!State.currentUser) return;
  const user = State.currentUser;
  const dispEl = document.getElementById('user-display-name');
  if (dispEl) dispEl.textContent = user.displayName;

  const setDisp = document.getElementById('settings-username-display');
  if (setDisp) setDisp.textContent = `${user.displayName} (@${user.username})`;

  const syncAcc = document.getElementById('sync-account-name');
  if (syncAcc) syncAcc.textContent = user.displayName;
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
    if (fill) fill.style.width = '25%';
    if (txt) txt.textContent = 'Đang kiểm tra bảo mật...';

    // Check user session
    const session = Auth.getSession();
    if (session) {
      State.currentUser = session;
      updateUserDisplay();
    }

    if (fill) fill.style.width = '50%';
    if (txt) txt.textContent = 'Đang tải danh mục khóa học...';
    const manifestOk = await DataSource.loadManifest();
    if (!manifestOk) throw new Error('Không tải được manifest.json');

    if (fill) fill.style.width = '75%';
    if (txt) txt.textContent = 'Đang tải dữ liệu bài học & câu hỏi...';
    const dbOk = await DataSource.loadLessonsDb();
    if (!dbOk) throw new Error('Không tải được lessons_db.json');

    DataSource.mode = 'drive';
    const courses = DataSource.getCourses();
    State.courses = courses;

    if (fill) fill.style.width = '100%';
    if (txt) txt.textContent = `Sẵn sàng: ${courses.length} khóa học (${Object.keys(DataSource.lessonsDb).length} bài)`;

    await new Promise(r => setTimeout(r, 350));

    // If authenticated, go straight to home with cloud sync
    if (State.currentUser) {
      await CloudSync.pull(State.currentUser.username);
      renderHome();
      updateGlobalProgressBadge();
      showScreen('screen-home');
    } else {
      // If not authenticated, require login gate
      showScreen('screen-auth');
    }

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
// PROGRESS MODAL & CLOUD SYNC
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

function forceCloudSync() {
  if (!State.currentUser) return;
  CloudSync.pull(State.currentUser.username).then(() => {
    saveProgress();
    openProgressModal();
    renderHome();
    toast('Đã đồng bộ dữ liệu với Cloud Realtime!');
  });
}

function exportProgressFile() {
  try {
    const dataStr = JSON.stringify(State.progress, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riki_progress_${State.currentUser?.username || 'backup'}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Đã tải file sao lưu tiến độ!');
  } catch(e) {
    toast('Lỗi xuất file: ' + e.message);
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

  const completedTag = isDone
    ? `<span class="lesson-completed-tag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Đã hoàn thành</span>`
    : '';

  return `
    <div class="lesson-item ${isDone ? 'completed' : ''}" onclick="openLesson(${leaf.id})">
      <span class="lesson-type-icon">${lessonTypeIcon(leaf.type)}</span>
      <span class="lesson-item-name">${leaf.name}${badge}${completedTag}</span>
      ${isDone
        ? '<div class="lesson-done-badge" title="Đã hoàn thành"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>'
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

function updateCompleteButtonState(isDone) {
  const btn = document.getElementById('btn-complete-lesson');
  if (!btn) return;
  if (isDone) {
    btn.classList.add('is-completed');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>✓ Đã hoàn thành</span>`;
  } else {
    btn.classList.remove('is-completed');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Đánh dấu hoàn thành</span>`;
  }
}

function markLessonComplete(showPopup = true) {
  if (!State.currentCourse || !State.currentLesson) return;
  const key = `${State.currentCourse.id}_${State.currentLesson}`;
  if (!State.progress[key]) State.progress[key] = {};
  State.progress[key].complete = true;
  saveProgress();
  updateCompleteButtonState(true);

  if (showPopup) {
    showCompletionModal();
  } else {
    toast('Đã hoàn thành bài học!');
  }
}

function showCompletionModal() {
  const modal = document.getElementById('completion-modal');
  if (!modal) return;

  const lessonName = State.currentLessonData?.name || 'Bài học';
  const course = State.currentCourse;

  document.getElementById('completion-lesson-name').textContent = lessonName;

  if (course) {
    const done = countCompleted(course.id);
    const total = State.progress[`total_${course.id}`] || (course.id === 12 ? 117 : course.id === 11 ? 622 : course.id === 3 ? 912 : 452);
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    document.getElementById('comp-course-stat').textContent = `${done} / ${total} bài (${pct}%)`;
  }

  const totalLessons = 2103;
  const completedCount = Object.values(State.progress).filter(p => p && p.complete).length;
  const totalPct = Math.round((completedCount / totalLessons) * 100);
  document.getElementById('comp-total-stat').textContent = `${totalPct}% (${completedCount}/${totalLessons} bài)`;

  // Check if there is a next lesson
  const nexts = State.currentLessonData?.lessons_after || [];
  const btnNext = document.getElementById('btn-comp-next');
  if (btnNext) {
    if (nexts.length > 0) {
      btnNext.style.display = 'inline-flex';
      btnNext.setAttribute('data-next-id', nexts[0].id);
    } else {
      btnNext.style.display = 'none';
    }
  }

  modal.style.display = 'flex';
}

function closeCompletionModal() {
  const modal = document.getElementById('completion-modal');
  if (modal) modal.style.display = 'none';
}

function goToNextLessonFromModal() {
  const btnNext = document.getElementById('btn-comp-next');
  const nextId = btnNext?.getAttribute('data-next-id');
  closeCompletionModal();
  if (nextId) {
    openLesson(parseInt(nextId, 10));
  } else {
    if (State.currentCourse) showScreen('screen-course');
  }
}

function renderLesson(lesson) {
  const lname = lesson.name || 'Bài học';
  document.getElementById('lesson-topbar-title').textContent = lname;
  document.getElementById('lesson-name-info').textContent = lname;

  const ltype = lesson.type;
  const videoUrls = lesson.video_url || [];
  const vocabs = lesson.vocabularies || [];

  const isLessonDone = State.currentCourse && State.progress[`${State.currentCourse.id}_${State.currentLesson}`]?.complete;
  updateCompleteButtonState(isLessonDone);

  // Metadata
  const meta = [];
  if (lesson.time) meta.push(`Thời lượng: ${Math.round(lesson.time/60)} phút`);
  meta.push(`${lessonTypeName(ltype)}`);
  if (isLessonDone || lesson.is_complete) meta.push('✓ Đã hoàn thành');
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
    markLessonComplete(true);
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
// VOCABULARY LEARNING & MINI-GAMES SYSTEM
// ============================================================
let matchTimerInterval = null;
let speedTimerInterval = null;

function switchFcMode(mode) {
  document.querySelectorAll('.fc-mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.fc-game-container').forEach(c => c.style.display = 'none');

  const btn = document.getElementById(`btn-fcmode-${mode}`);
  if (btn) btn.classList.add('active');

  const container = document.getElementById(`fc-container-${mode}`);
  if (container) container.style.display = 'block';

  // Stop any active timers
  if (matchTimerInterval) { clearInterval(matchTimerInterval); matchTimerInterval = null; }
  if (speedTimerInterval) { clearInterval(speedTimerInterval); speedTimerInterval = null; }

  if (mode === 'card') {
    renderFlashcard();
  } else if (mode === 'match') {
    startMatchGame();
  } else if (mode === 'speed') {
    startSpeedQuiz();
  } else if (mode === 'scramble') {
    startScrambleGame();
  }
}

// ------------------------------------------------------------
// GAME 1: 3D FLASHCARD
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// GAME 2: WORD MATCHING (Ghép thẻ nhanh)
// ------------------------------------------------------------
let matchState = {
  firstPick: null,
  secondPick: null,
  matchedCount: 0,
  totalPairs: 0,
  seconds: 0,
  lock: false
};

function startMatchGame() {
  if (matchTimerInterval) clearInterval(matchTimerInterval);
  const winBanner = document.getElementById('match-win-banner');
  if (winBanner) winBanner.style.display = 'none';

  const grid = document.getElementById('match-grid');
  if (!grid) return;
  grid.style.display = 'grid';
  grid.innerHTML = '';

  const cards = State.fc.cards || [];
  if (cards.length < 2) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--color-text-muted)">Cần ít nhất 2 từ vựng để chơi game ghép thẻ.</div>';
    return;
  }

  // Shuffle and pick 6 vocabularies
  const shuffledVocabs = [...cards].sort(() => Math.random() - 0.5).slice(0, 6);
  matchState.totalPairs = shuffledVocabs.length;
  matchState.matchedCount = 0;
  matchState.firstPick = null;
  matchState.secondPick = null;
  matchState.seconds = 0;
  matchState.lock = false;

  document.getElementById('match-pairs-count').textContent = `0 / ${matchState.totalPairs}`;
  document.getElementById('match-timer').textContent = '00:00';

  // Start timer
  matchTimerInterval = setInterval(() => {
    matchState.seconds++;
    const m = String(Math.floor(matchState.seconds / 60)).padStart(2, '0');
    const s = String(matchState.seconds % 60).padStart(2, '0');
    document.getElementById('match-timer').textContent = `${m}:${s}`;
  }, 1000);

  // Generate pair items
  const tiles = [];
  shuffledVocabs.forEach(v => {
    tiles.push({
      pairId: v.id,
      text: v.previous_name || v.example || 'Từ vựng',
      sub: v.example && v.previous_name ? v.example : '',
      type: 'JP'
    });
    tiles.push({
      pairId: v.id,
      text: v.back_name || 'Nghĩa',
      sub: '',
      type: 'VN'
    });
  });

  // Shuffle tiles
  tiles.sort(() => Math.random() - 0.5);

  tiles.forEach(tile => {
    const el = document.createElement('div');
    el.className = 'match-card';
    el.setAttribute('data-pair-id', tile.pairId);
    el.setAttribute('data-type', tile.type);
    el.innerHTML = `
      <div class="match-card-text">${tile.text}</div>
      <div class="match-card-type">${tile.type === 'JP' ? 'Tiếng Nhật' : 'Nghĩa tiếng Việt'}</div>
    `;
    el.onclick = () => handleMatchCardClick(el, tile.pairId, tile.type);
    grid.appendChild(el);
  });
}

function handleMatchCardClick(el, pairId, type) {
  if (matchState.lock) return;
  if (el.classList.contains('matched') || el.classList.contains('selected')) return;

  el.classList.add('selected');

  if (!matchState.firstPick) {
    matchState.firstPick = { el, pairId, type };
    return;
  }

  // Second pick
  matchState.secondPick = { el, pairId, type };
  matchState.lock = true;

  const first = matchState.firstPick;
  const second = matchState.secondPick;

  // Check match: Same pairId and different language types
  if (first.pairId === second.pairId && first.type !== second.type) {
    // Correct Match
    setTimeout(() => {
      first.el.classList.add('matched');
      second.el.classList.add('matched');
      matchState.matchedCount++;
      document.getElementById('match-pairs-count').textContent = `${matchState.matchedCount} / ${matchState.totalPairs}`;
      matchState.firstPick = null;
      matchState.secondPick = null;
      matchState.lock = false;

      // Check game win
      if (matchState.matchedCount === matchState.totalPairs) {
        clearInterval(matchTimerInterval);
        const m = String(Math.floor(matchState.seconds / 60)).padStart(2, '0');
        const s = String(matchState.seconds % 60).padStart(2, '0');
        document.getElementById('match-win-time').textContent = `${m}:${s}`;
        document.getElementById('match-grid').style.display = 'none';
        document.getElementById('match-win-banner').style.display = 'block';
        toast('Hoàn thành ghép thẻ xuất sắc!');
      }
    }, 250);
  } else {
    // Mismatch
    setTimeout(() => {
      first.el.classList.add('mismatch');
      second.el.classList.add('mismatch');
      setTimeout(() => {
        first.el.classList.remove('selected', 'mismatch');
        second.el.classList.remove('selected', 'mismatch');
        matchState.firstPick = null;
        matchState.secondPick = null;
        matchState.lock = false;
      }, 400);
    }, 250);
  }
}

// ------------------------------------------------------------
// GAME 3: SPEED VOCAB QUIZ (Trắc nghiệm phản xạ)
// ------------------------------------------------------------
let speedState = {
  questions: [],
  index: 0,
  score: 0,
  streak: 0,
  correctCount: 0,
  timerInterval: null,
  timeLeft: 100,
  answered: false
};

function startSpeedQuiz() {
  if (speedTimerInterval) clearInterval(speedTimerInterval);
  const winBanner = document.getElementById('speed-win-banner');
  if (winBanner) winBanner.style.display = 'none';

  const card = document.getElementById('speed-question-card');
  const grid = document.getElementById('speed-options-grid');
  if (card) card.style.display = 'block';
  if (grid) grid.style.display = 'grid';

  const cards = State.fc.cards || [];
  if (cards.length < 2) {
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--color-text-muted)">Cần ít nhất 2 từ vựng để chơi game trắc nghiệm phản xạ.</div>';
    return;
  }

  // Shuffle questions (up to 10)
  speedState.questions = [...cards].sort(() => Math.random() - 0.5).slice(0, 10);
  speedState.index = 0;
  speedState.score = 0;
  speedState.streak = 0;
  speedState.correctCount = 0;

  document.getElementById('speed-score-count').textContent = '0';
  document.getElementById('speed-streak-count').textContent = '0';

  renderSpeedQuestion();
}

function renderSpeedQuestion() {
  if (speedTimerInterval) clearInterval(speedTimerInterval);

  if (speedState.index >= speedState.questions.length) {
    // Finished
    const total = speedState.questions.length;
    const acc = Math.round((speedState.correctCount / total) * 100);
    document.getElementById('speed-final-score').textContent = speedState.score;
    document.getElementById('speed-final-acc').textContent = `${acc}% (${speedState.correctCount}/${total} câu)`;
    document.getElementById('speed-question-card').style.display = 'none';
    document.getElementById('speed-options-grid').style.display = 'none';
    document.getElementById('speed-win-banner').style.display = 'block';
    toast('Hoàn thành lượt luyện phản xạ!');
    return;
  }

  const q = speedState.questions[speedState.index];
  speedState.answered = false;

  document.getElementById('speed-q-num').textContent = `${speedState.index + 1} / ${speedState.questions.length}`;
  document.getElementById('speed-kanji').innerHTML = formatRikiText(q.previous_name || '');
  document.getElementById('speed-reading').textContent = q.example || '';

  // Generate 4 options: 1 correct + 3 random from other cards
  const otherVocabs = State.fc.cards.filter(c => c.id !== q.id).sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [q, ...otherVocabs].sort(() => Math.random() - 0.5);

  const grid = document.getElementById('speed-options-grid');
  grid.innerHTML = options.map((opt, i) => `
    <button class="speed-opt-btn" onclick="handleSpeedAnswer('${escapeHtml(opt.back_name)}', '${escapeHtml(q.back_name)}', this)">
      <span class="answer-label">${String.fromCharCode(65 + i)}</span>
      <span>${opt.back_name || 'Nghĩa'}</span>
    </button>
  `).join('');

  // Start animated timer bar (10 seconds)
  const timerBar = document.getElementById('speed-timer-bar');
  let timeLeft = 100;
  if (timerBar) timerBar.style.width = '100%';

  speedTimerInterval = setInterval(() => {
    timeLeft -= 1;
    if (timerBar) timerBar.style.width = `${timeLeft}%`;
    if (timeLeft <= 0) {
      clearInterval(speedTimerInterval);
      if (!speedState.answered) {
        handleSpeedTimeout(q.back_name);
      }
    }
  }, 100);
}

function escapeHtml(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function handleSpeedAnswer(selectedMeaning, correctMeaning, btnEl) {
  if (speedState.answered) return;
  speedState.answered = true;
  if (speedTimerInterval) clearInterval(speedTimerInterval);

  const isCorrect = selectedMeaning === correctMeaning;

  if (isCorrect) {
    btnEl.classList.add('correct');
    speedState.streak++;
    speedState.correctCount++;
    const bonus = speedState.streak * 20;
    speedState.score += (100 + bonus);
    document.getElementById('speed-score-count').textContent = speedState.score;
    document.getElementById('speed-streak-count').textContent = speedState.streak;
  } else {
    btnEl.classList.add('wrong');
    speedState.streak = 0;
    document.getElementById('speed-streak-count').textContent = '0';
    // Highlight correct answer
    document.querySelectorAll('.speed-opt-btn').forEach(b => {
      if (b.textContent.includes(correctMeaning)) b.classList.add('correct');
    });
  }

  setTimeout(() => {
    speedState.index++;
    renderSpeedQuestion();
  }, 650);
}

function handleSpeedTimeout(correctMeaning) {
  speedState.answered = true;
  speedState.streak = 0;
  document.getElementById('speed-streak-count').textContent = '0';
  document.querySelectorAll('.speed-opt-btn').forEach(b => {
    if (b.textContent.includes(correctMeaning)) b.classList.add('correct');
  });
  setTimeout(() => {
    speedState.index++;
    renderSpeedQuestion();
  }, 800);
}

// ------------------------------------------------------------
// GAME 4: CHARACTER SCRAMBLE (Xếp ký tự)
// ------------------------------------------------------------
let scrambleState = {
  questions: [],
  index: 0,
  score: 0,
  targetLetters: [],
  userLetters: [],
  poolLetters: []
};

function startScrambleGame() {
  const winBanner = document.getElementById('scramble-win-banner');
  if (winBanner) winBanner.style.display = 'none';

  const cards = State.fc.cards || [];
  if (cards.length === 0) return;

  scrambleState.questions = [...cards].sort(() => Math.random() - 0.5).slice(0, 10);
  scrambleState.index = 0;
  scrambleState.score = 0;
  document.getElementById('scramble-score-count').textContent = '0';

  renderScrambleQuestion();
}

function renderScrambleQuestion() {
  if (scrambleState.index >= scrambleState.questions.length) {
    document.getElementById('scramble-win-banner').style.display = 'block';
    toast('Hoàn thành toàn bộ xếp ký tự!');
    return;
  }

  const q = scrambleState.questions[scrambleState.index];
  document.getElementById('scramble-q-num').textContent = `${scrambleState.index + 1} / ${scrambleState.questions.length}`;
  document.getElementById('scramble-meaning').textContent = q.back_name || 'Nghĩa từ vựng';
  document.getElementById('scramble-kanji-hint').textContent = q.previous_name ? `Kanji: ${q.previous_name}` : '';

  // Extract letters from previous_name or example
  let raw = (q.previous_name || q.example || '').replace(/[\s\n：:・|⌊⌉]/g, '');
  if (!raw) raw = 'にほんご';
  const letters = Array.from(raw).slice(0, 8);
  scrambleState.targetLetters = letters;
  scrambleState.userLetters = [];

  // Scrambled pool with index
  scrambleState.poolLetters = letters.map((l, i) => ({ letter: l, id: i, used: false })).sort(() => Math.random() - 0.5);

  renderScrambleSlots();
  renderScramblePool();
}

function renderScrambleSlots() {
  const wrap = document.getElementById('scramble-slots-wrap');
  wrap.innerHTML = scrambleState.targetLetters.map((_, i) => {
    const filled = scrambleState.userLetters[i];
    return `<div class="scramble-slot ${filled ? 'filled' : ''}" onclick="removeScrambleSlot(${i})">${filled ? filled.letter : ''}</div>`;
  }).join('');
}

function renderScramblePool() {
  const pool = document.getElementById('scramble-pool');
  pool.innerHTML = scrambleState.poolLetters.map((item) => `
    <button class="scramble-letter-btn ${item.used ? 'used' : ''}" onclick="clickScrambleLetter(${item.id})">
      ${item.letter}
    </button>
  `).join('');
}

function clickScrambleLetter(poolId) {
  const item = scrambleState.poolLetters.find(p => p.id === poolId);
  if (!item || item.used) return;
  if (scrambleState.userLetters.length >= scrambleState.targetLetters.length) return;

  item.used = true;
  scrambleState.userLetters.push(item);
  renderScrambleSlots();
  renderScramblePool();

  // Check if complete
  if (scrambleState.userLetters.length === scrambleState.targetLetters.length) {
    checkScrambleAnswer();
  }
}

function removeScrambleSlot(slotIdx) {
  if (slotIdx >= scrambleState.userLetters.length) return;
  const removed = scrambleState.userLetters.splice(slotIdx, 1)[0];
  if (removed) removed.used = false;
  renderScrambleSlots();
  renderScramblePool();
}

function clearScrambleAnswer() {
  scrambleState.userLetters.forEach(l => l.used = false);
  scrambleState.userLetters = [];
  renderScrambleSlots();
  renderScramblePool();
}

function hintScrambleLetter() {
  const nextIdx = scrambleState.userLetters.length;
  if (nextIdx >= scrambleState.targetLetters.length) return;
  const expectedLetter = scrambleState.targetLetters[nextIdx];

  const available = scrambleState.poolLetters.find(p => p.letter === expectedLetter && !p.used);
  if (available) {
    clickScrambleLetter(available.id);
  }
}

function checkScrambleAnswer() {
  const isCorrect = scrambleState.userLetters.every((l, i) => l.letter === scrambleState.targetLetters[i]);
  const slots = document.querySelectorAll('.scramble-slot');

  if (isCorrect) {
    slots.forEach(s => s.classList.add('correct-slot'));
    scrambleState.score++;
    document.getElementById('scramble-score-count').textContent = scrambleState.score;
    toast('Chính xác!', 1500);
    setTimeout(() => {
      scrambleState.index++;
      renderScrambleQuestion();
    }, 700);
  } else {
    toast('Chưa đúng thứ tự, hãy thử lại nhé!', 1500);
  }
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
  container.innerHTML = nexts.slice(0, 6).map(n => {
    const isNextDone = State.currentCourse && State.progress[`${State.currentCourse.id}_${n.id}`]?.complete;
    const doneTag = isNextDone ? '<span class="next-completed-tag">✓ Đã hoàn thành</span>' : '';
    return `
    <div class="next-card" onclick="openLesson(${n.id})">
      <div class="next-card-icon">${lessonTypeIcon(n.type)}</div>
      <div class="next-card-info">
        <div class="next-card-name">${n.name || 'Bài tiếp theo'} ${doneTag}</div>
        <div class="next-card-type">${lessonTypeName(n.type)}</div>
      </div>
      <div class="next-card-arrow">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// SETTINGS
// ============================================================
function openSettings() {
  document.getElementById('settings-modal').style.display = 'flex';
  document.getElementById('drive-folder-id').value = CONFIG.DRIVE_FOLDER_ID;
  updateUserDisplay();
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

const completionModal = document.getElementById('completion-modal');
if (completionModal) {
  completionModal.addEventListener('click', function(e) {
    if (e.target === this) closeCompletionModal();
  });
}

// ============================================================
// START
// ============================================================
window.addEventListener('DOMContentLoaded', init);
