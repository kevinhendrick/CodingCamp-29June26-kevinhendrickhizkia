/**
 * analytics.js — Analytics Board Module
 *
 * Bertanggung jawab atas: pencatatan statistik, baca-tulis LocalStorage,
 * dan render CSS Bar Chart.
 * Tidak memiliki referensi langsung ke modul lain.
 *
 * Requirements: 4.1–4.7, 5.1–5.7, 6.1–6.6, 8.3
 */

// ---------------------------------------------------------------------------
// Internal state — in-memory fallback
// ---------------------------------------------------------------------------

/** Flag yang diaktifkan ketika localStorage penuh (QuotaExceededError) */
let useInMemoryFallback = false

/**
 * Penyimpanan in-memory sebagai fallback.
 * Kunci menggunakan format yang sama dengan LocalStorage: `auraTimer_*`
 */
const inMemoryData = new Map()

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Tampilkan peringatan non-blocking ketika LocalStorage penuh.
 * Mencoba menampilkan banner di DOM; jika gagal, fallback ke console.warn.
 */
function showStorageWarning() {
  try {
    // Cari elemen peringatan yang sudah ada, atau buat baru
    let banner = document.getElementById('storage-warning-banner')
    if (!banner) {
      banner = document.createElement('div')
      banner.id = 'storage-warning-banner'
      banner.setAttribute('role', 'alert')
      banner.style.cssText =
        'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);' +
        'background:#f59e0b;color:#1c1917;padding:8px 16px;border-radius:6px;' +
        'font-size:14px;z-index:9999;pointer-events:none;'
      document.body.appendChild(banner)
    }
    banner.textContent =
      'Penyimpanan penuh. Data sesi disimpan sementara di memori.'
    banner.style.display = 'block'
    // Sembunyikan setelah 5 detik
    setTimeout(() => {
      banner.style.display = 'none'
    }, 5000)
  } catch (_) {
    // DOM belum tersedia atau gagal — fallback ke console
    console.warn(
      '[AuraTimer] LocalStorage penuh (QuotaExceededError). ' +
        'Melanjutkan pencatatan secara in-memory.'
    )
  }
}

/**
 * Ambil nilai numerik dari LocalStorage dengan aman.
 * - Jika kunci tidak ada → kembalikan defaultValue
 * - Jika nilai tidak dapat di-parse sebagai angka → reinisialisasi ke defaultValue
 * - Jika LocalStorage tidak tersedia → kembalikan defaultValue
 *
 * @param {string} key
 * @param {number} [defaultValue=0]
 * @returns {number}
 */
function safeLocalStorageGet(key, defaultValue = 0) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    const parsed = Number(raw)
    if (isNaN(parsed)) {
      // Data korup — reinisialisasi ke defaultValue (Requirement 6.4)
      localStorage.setItem(key, String(defaultValue))
      return defaultValue
    }
    return parsed
  } catch (_) {
    // localStorage tidak tersedia (misalnya mode privat yang diblokir)
    return defaultValue
  }
}

/**
 * Simpan nilai ke LocalStorage dengan aman.
 * - Jika QuotaExceededError → aktifkan in-memory fallback + tampilkan peringatan
 * - Tidak pernah melempar error (Requirement 6.6)
 *
 * @param {string} key
 * @param {number|string} value
 */
function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, String(value))
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      useInMemoryFallback = true
      showStorageWarning()
    }
    // Lanjutkan tanpa melempar error — data akan hidup di inMemoryData
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Catat sesi fokus yang baru selesai.
 * Mengakumulasikan menit dan jumlah sesi untuk tanggal yang diberikan,
 * lalu memperbarui DOM widget jika elemen tersedia.
 *
 * Kunci LocalStorage:
 *   auraTimer_focus_YYYY-MM-DD   → total menit fokus
 *   auraTimer_sessions_YYYY-MM-DD → jumlah sesi
 *
 * Requirements: 4.3, 4.4, 6.1, 6.3
 *
 * @param {number} durationMinutes - Durasi sesi dalam menit
 * @param {string} date - Tanggal dalam format YYYY-MM-DD
 */
export function recordFocusSession(durationMinutes, date) {
  const minutesKey = `auraTimer_focus_${date}`
  const sessionsKey = `auraTimer_sessions_${date}`

  if (useInMemoryFallback) {
    // Baca dari in-memory
    const currentMinutes = inMemoryData.has(minutesKey)
      ? Number(inMemoryData.get(minutesKey))
      : 0
    const currentSessions = inMemoryData.has(sessionsKey)
      ? Number(inMemoryData.get(sessionsKey))
      : 0

    inMemoryData.set(minutesKey, String(currentMinutes + durationMinutes))
    inMemoryData.set(sessionsKey, String(currentSessions + 1))
  } else {
    // Baca dari LocalStorage, tambahkan, simpan kembali
    const currentMinutes = safeLocalStorageGet(minutesKey, 0)
    const currentSessions = safeLocalStorageGet(sessionsKey, 0)

    safeLocalStorageSet(minutesKey, currentMinutes + durationMinutes)
    safeLocalStorageSet(sessionsKey, currentSessions + 1)

    // Jika QuotaExceededError baru saja diaktifkan, simpan ke in-memory juga
    if (useInMemoryFallback) {
      inMemoryData.set(
        minutesKey,
        String(currentMinutes + durationMinutes)
      )
      inMemoryData.set(sessionsKey, String(currentSessions + 1))
    }
  }

  // Perbarui DOM widget jika tersedia (Requirement 4.1, 4.2)
  _updateDOMWidgets(date)
}

/**
 * Kembalikan statistik harian untuk tanggal yang diberikan.
 *
 * Requirements: 4.1, 4.2, 6.3
 *
 * @param {string} date - Tanggal dalam format YYYY-MM-DD
 * @returns {{ minutes: number, sessions: number }}
 */
export function getDailyStats(date) {
  const minutesKey = `auraTimer_focus_${date}`
  const sessionsKey = `auraTimer_sessions_${date}`

  if (useInMemoryFallback) {
    const minutes = inMemoryData.has(minutesKey)
      ? Number(inMemoryData.get(minutesKey))
      : 0
    const sessions = inMemoryData.has(sessionsKey)
      ? Number(inMemoryData.get(sessionsKey))
      : 0
    return { minutes, sessions }
  }

  return {
    minutes: safeLocalStorageGet(minutesKey, 0),
    sessions: safeLocalStorageGet(sessionsKey, 0),
  }
}

/**
 * Perbarui elemen DOM widget harian jika tersedia.
 * Fungsi ini bersifat best-effort; tidak melempar error jika elemen tidak ada.
 *
 * @param {string} date - Tanggal dalam format YYYY-MM-DD
 */
function _updateDOMWidgets(date) {
  try {
    const stats = getDailyStats(date)
    // Target .widget-value spans inside each widget div (Req 4.1, 4.2)
    const minutesEl = document.querySelector('#total-minutes-widget .widget-value')
    const sessionsEl = document.querySelector('#sessions-widget .widget-value')
    if (minutesEl) minutesEl.textContent = String(stats.minutes)
    if (sessionsEl) sessionsEl.textContent = String(stats.sessions)
  } catch (_) {
    // DOM tidak tersedia (mis. environment testing) — abaikan
  }
}

// ---------------------------------------------------------------------------
// Task 7.1 — getDayLabel() dan getWeeklyData()
// ---------------------------------------------------------------------------

/**
 * Mapping indeks hari (date.getDay()) ke label hari Indonesia.
 * 0=Minggu, 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
 */
const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

/**
 * Kembalikan label hari Indonesia untuk objek Date yang diberikan.
 *
 * Requirements: 5.4
 *
 * @param {Date} date - Objek Date
 * @returns {'Sen'|'Sel'|'Rab'|'Kam'|'Jum'|'Sab'|'Min'}
 */
export function getDayLabel(date) {
  return DAY_LABELS[date.getDay()]
}

/**
 * Bangun array 7 hari (D-6 hingga D+0) dengan data fokus harian.
 * Setiap entri berisi tanggal lokal, total menit fokus, label hari Indonesia,
 * dan flag apakah hari tersebut adalah hari ini.
 *
 * Requirements: 5.1, 5.4, 5.6
 *
 * @returns {Array<{ date: string, minutes: number, label: string, isToday: boolean }>}
 */
export function getWeeklyData() {
  const today = new Date()
  // Tanggal lokal hari ini sebagai string YYYY-MM-DD
  const ty = today.getFullYear()
  const tm = String(today.getMonth() + 1).padStart(2, '0')
  const td = String(today.getDate()).padStart(2, '0')
  const todayStr = `${ty}-${tm}-${td}`

  const result = []

  for (let i = 0; i < 7; i++) {
    // D-6 (i=0) sampai D+0 (i=6)
    const d = new Date(today)
    d.setDate(today.getDate() + (i - 6))

    // Format tanggal lokal YYYY-MM-DD (bukan UTC)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const dateStr = `${y}-${mo}-${dd}`

    result.push({
      date: dateStr,
      minutes: getDailyStats(dateStr).minutes,
      label: getDayLabel(d),
      isToday: dateStr === todayStr,
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// Task 7.2 — renderDailyStats(), renderWeeklyChart(), initAnalytics()
// ---------------------------------------------------------------------------

/**
 * Tinggi container chart dalam piksel (area grafik tetap).
 * Batang tertinggi akan mengisi seluruh CHART_HEIGHT.
 */
const CHART_HEIGHT = 80

/**
 * Perbarui widget DOM harian dengan data hari ini.
 * Update elemen #total-minutes-widget dan #sessions-widget.
 *
 * Requirements: 4.1, 4.2
 */
export function renderDailyStats() {
  try {
    const today = new Date()
    const ty = today.getFullYear()
    const tm = String(today.getMonth() + 1).padStart(2, '0')
    const td = String(today.getDate()).padStart(2, '0')
    const todayStr = `${ty}-${tm}-${td}`

    const stats = getDailyStats(todayStr)

    // Target .widget-value spans inside each widget div
    const minutesEl = document.querySelector('#total-minutes-widget .widget-value')
    const sessionsEl = document.querySelector('#sessions-widget .widget-value')

    if (minutesEl) minutesEl.textContent = String(stats.minutes)
    if (sessionsEl) sessionsEl.textContent = String(stats.sessions)
  } catch (_) {
    // DOM tidak tersedia (mis. environment testing) — abaikan
  }
}

/**
 * Render CSS Bar Chart mingguan ke dalam elemen #weekly-chart.
 *
 * - Mengambil data 7 hari via getWeeklyData()
 * - maxMinutes = Math.max(...values, 1) — mencegah divisi nol
 * - Setiap batang proporsional terhadap maxMinutes, mengisi CHART_HEIGHT (px)
 * - Batang dengan nilai nol mendapat tinggi minimum 4px
 * - Hari ini diberi kelas CSS "today" pada label
 * - Dirender menggunakan <div> HTML dan properti CSS murni (Req 5.2)
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5, 5.7
 */
export function renderWeeklyChart() {
  try {
    const chartEl = document.getElementById('weekly-chart')
    if (!chartEl) return

    const weekData = getWeeklyData()
    const values = weekData.map((d) => d.minutes)
    const maxMinutes = Math.max(...values, 1)

    // Kosongkan container sebelum render ulang
    chartEl.innerHTML = ''

    for (const day of weekData) {
      // Hitung tinggi batang dalam piksel
      let barHeight
      if (day.minutes === 0) {
        // Req 5.7: nilai nol → tinggi minimum 4px
        barHeight = 4
      } else {
        // Req 5.5: proporsional terhadap nilai maksimum
        const proportional = Math.round((day.minutes / maxMinutes) * CHART_HEIGHT)
        barHeight = Math.max(proportional, 4)
      }

      // Buat wrapper kolom batang + label
      const col = document.createElement('div')
      col.style.cssText =
        'display:inline-flex;flex-direction:column;align-items:center;' +
        `width:${Math.floor(100 / 7)}%;`

      // Batang (Req 5.2: gunakan <div> dan properti CSS murni)
      const bar = document.createElement('div')
      bar.style.cssText =
        `height:${barHeight}px;` +
        'width:70%;' +
        'background-color:#ef4444;' +
        'border-radius:3px 3px 0 0;' +
        'align-self:flex-end;'

      // Label hari Indonesia (Req 5.4)
      const label = document.createElement('div')
      label.textContent = day.label
      label.style.cssText =
        'font-size:11px;margin-top:4px;text-align:center;'

      if (day.isToday) {
        // Req 5.4: label hari ini ditandai berbeda
        label.classList.add('today')
        label.style.fontWeight = 'bold'
        bar.style.backgroundColor = '#dc2626'
      }

      col.appendChild(bar)
      col.appendChild(label)
      chartEl.appendChild(col)
    }

    // Pastikan container memiliki tinggi minimum agar batang terlihat
    chartEl.style.cssText =
      `height:${CHART_HEIGHT + 24}px;` +
      'display:flex;align-items:flex-end;' +
      'padding-bottom:20px;box-sizing:border-box;'
  } catch (_) {
    // DOM tidak tersedia (mis. environment testing) — abaikan
  }
}

/**
 * Inisialisasi modul Analytics saat aplikasi dimuat.
 *
 * 1. Baca auraTimer_lastDate dari LocalStorage
 * 2. Bandingkan dengan tanggal hari ini (YYYY-MM-DD)
 * 3. Jika berbeda: update auraTimer_lastDate ke hari ini
 *    (statistik sudah otomatis "reset" karena kunci per-tanggal tidak ada)
 * 4. Panggil renderDailyStats() dan renderWeeklyChart()
 *
 * Requirements: 4.5, 4.6, 6.2
 */
export function initAnalytics() {
  try {
    const today = new Date()
    const ty = today.getFullYear()
    const tm = String(today.getMonth() + 1).padStart(2, '0')
    const td = String(today.getDate()).padStart(2, '0')
    const todayStr = `${ty}-${tm}-${td}`

    // Req 4.5: cek lastDate vs hari ini
    let lastDate = null
    try {
      lastDate = localStorage.getItem('auraTimer_lastDate')
    } catch (_) {
      // localStorage tidak tersedia — lanjut dengan null
    }

    if (lastDate !== todayStr) {
      // Tanggal berbeda atau pertama kali buka → update lastDate
      // Statistik otomatis "nol" karena kunci focus/sessions untuk hari ini belum ada
      try {
        localStorage.setItem('auraTimer_lastDate', todayStr)
      } catch (_) {
        // localStorage tidak tersedia — lanjut tanpa menyimpan
      }
    }
  } catch (_) {
    // Tangkap semua error agar initAnalytics tidak pernah crash
  }

  // Render UI
  renderDailyStats()
  renderWeeklyChart()
}

// ---------------------------------------------------------------------------
// Exports untuk testing (fungsi internal yang perlu diuji)
// ---------------------------------------------------------------------------

/**
 * Reset internal module state (hanya untuk keperluan testing).
 * Mengembalikan `useInMemoryFallback` ke false dan mengosongkan `inMemoryData`.
 */
export function _resetInternalStateForTest() {
  useInMemoryFallback = false
  inMemoryData.clear()
}

export { safeLocalStorageGet, safeLocalStorageSet, useInMemoryFallback, inMemoryData }
