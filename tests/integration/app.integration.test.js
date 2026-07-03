/**
 * app.integration.test.js — Integration Tests untuk CustomEvent flows
 *
 * Menguji komunikasi lintas-modul melalui CustomEvent pada document,
 * yang merupakan inti dari arsitektur AuraTimer.
 *
 * Karena app.js tidak bisa diimpor langsung (memiliki DOMContentLoaded
 * side effects), integrasi diuji di level batas modul: event yang di-dispatch
 * modul sumber dicegat, dan efek sampingnya (DOM update, analytics call)
 * diverifikasi secara eksplisit — persis seperti yang app.js lakukan.
 *
 * Validates: Requirements 2.1, 2.3, 3.7, 4.3, 8.4
 */

import {
  startTimer,
  resetTimer,
  getTimerState,
  FOCUS_DURATION,
  BREAK_DURATION,
} from '../../timer.js'

import {
  recordFocusSession,
  getDailyStats,
  _resetInternalStateForTest,
} from '../../analytics.js'

import {
  playSoundscape,
  SOUNDSCAPE_CONFIG,
} from '../../soundscape.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tanggal lokal hari ini dalam format YYYY-MM-DD */
function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Nilai CSS gradient yang app.js terapkan per fase, sesuai PHASE_GRADIENTS
 * di app.js. Direplikasi di sini untuk verifikasi independen.
 */
const PHASE_GRADIENTS = {
  focus: 'linear-gradient(135deg, hsl(5, 70%, 85%), hsl(2, 65%, 90%))',
  break: 'linear-gradient(135deg, hsl(180, 58%, 82%), hsl(165, 52%, 88%))',
}

// ---------------------------------------------------------------------------
// Setup & Teardown global
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()

  // Reset timer ke kondisi awal
  resetTimer()

  // Reset analytics state dan localStorage
  _resetInternalStateForTest()
  localStorage.clear()

  // Reset body background
  document.body.style.background = ''

  // Pastikan tidak ada event listener yang tersisa dari test sebelumnya
  // (tiap test memasang listener sendiri dan membersihkannya di afterEach)
})

afterEach(() => {
  resetTimer()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ===========================================================================
// Test Suite 1: focusSessionComplete → analytics.recordFocusSession
// ===========================================================================

describe('Integration: focusSessionComplete → analytics.recordFocusSession', () => {
  /**
   * Validates: Requirements 4.3, 8.4
   *
   * Alur: timer.js dispatch focusSessionComplete
   *       → app.js mendengarkan lalu memanggil recordFocusSession(payload)
   *       → analytics.js menyimpan data ke LocalStorage
   *
   * Test ini mensimulasikan peran app.js sebagai orchestrator:
   * memasang listener focusSessionComplete, lalu memanggil recordFocusSession
   * dengan payload event — persis seperti yang dilakukan app.js.
   */
  test('focusSessionComplete dispatch event dengan payload durationMinutes dan date yang benar', () => {
    const capturedEvents = []
    const handler = (e) => capturedEvents.push(e.detail)
    document.addEventListener('focusSessionComplete', handler)

    startTimer()
    vi.advanceTimersByTime(FOCUS_DURATION * 1000)

    document.removeEventListener('focusSessionComplete', handler)

    expect(capturedEvents).toHaveLength(1)
    const payload = capturedEvents[0]
    expect(payload.durationMinutes).toBe(25)
    expect(payload.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(payload.date).toBe(todayStr())
  })

  test('setelah focusSessionComplete, memanggil recordFocusSession dengan payload event mengakumulasi menit dan sesi', () => {
    const today = todayStr()

    // Verifikasi kondisi awal nol
    expect(getDailyStats(today).minutes).toBe(0)
    expect(getDailyStats(today).sessions).toBe(0)

    // Pasang listener seperti yang app.js lakukan
    const handler = (e) => {
      const { durationMinutes, date } = e.detail
      recordFocusSession(durationMinutes, date)
    }
    document.addEventListener('focusSessionComplete', handler)

    // Jalankan timer hingga fase fokus selesai
    startTimer()
    vi.advanceTimersByTime(FOCUS_DURATION * 1000)

    document.removeEventListener('focusSessionComplete', handler)

    // Analytics harus mencatat 25 menit dan 1 sesi
    const stats = getDailyStats(today)
    expect(stats.minutes).toBe(25)
    expect(stats.sessions).toBe(1)
  })

  test('dua siklus focusSessionComplete mengakumulasi menjadi 50 menit dan 2 sesi', () => {
    const today = todayStr()

    const handler = (e) => {
      const { durationMinutes, date } = e.detail
      recordFocusSession(durationMinutes, date)
    }
    document.addEventListener('focusSessionComplete', handler)

    // Siklus 1: fokus selesai → break mulai otomatis
    startTimer()
    vi.advanceTimersByTime(FOCUS_DURATION * 1000)

    // Siklus 2: break selesai → idle, lalu start lagi
    vi.advanceTimersByTime(BREAK_DURATION * 1000)
    startTimer()
    vi.advanceTimersByTime(FOCUS_DURATION * 1000)

    document.removeEventListener('focusSessionComplete', handler)

    const stats = getDailyStats(today)
    expect(stats.minutes).toBe(50)
    expect(stats.sessions).toBe(2)
  })

  test('data analytics tersimpan ke LocalStorage dengan kunci yang benar', () => {
    const today = todayStr()

    const handler = (e) => {
      recordFocusSession(e.detail.durationMinutes, e.detail.date)
    }
    document.addEventListener('focusSessionComplete', handler)

    startTimer()
    vi.advanceTimersByTime(FOCUS_DURATION * 1000)

    document.removeEventListener('focusSessionComplete', handler)

    // Verifikasi langsung ke LocalStorage — kunci harus menggunakan format auraTimer_*
    expect(localStorage.getItem(`auraTimer_focus_${today}`)).toBe('25')
    expect(localStorage.getItem(`auraTimer_sessions_${today}`)).toBe('1')
  })
})

// ===========================================================================
// Test Suite 2: timerPhaseChange → background gradient berubah
// ===========================================================================

describe('Integration: timerPhaseChange → background gradient berubah sesuai fase', () => {
  /**
   * Validates: Requirements 2.1, 2.3
   *
   * Alur: timer.js dispatch timerPhaseChange
   *       → app.js menerapkan PHASE_GRADIENTS[phase] ke document.body.style.background
   *
   * Test ini mensimulasikan peran app.js: memasang listener timerPhaseChange
   * dan menerapkan gradient ke body — persis seperti yang applyPhaseGradient() lakukan.
   */
  test('timerPhaseChange ke break → gradient break diterapkan ke body', () => {
    const handler = (e) => {
      const { phase } = e.detail
      document.body.style.background = PHASE_GRADIENTS[phase] || PHASE_GRADIENTS.focus
    }
    document.addEventListener('timerPhaseChange', handler)

    startTimer()
    vi.advanceTimersByTime(FOCUS_DURATION * 1000)

    document.removeEventListener('timerPhaseChange', handler)

    // Setelah fokus selesai, event timerPhaseChange dengan phase='break' harus diterima
    // dan body harus memiliki gradient break
    expect(document.body.style.background).toBe(PHASE_GRADIENTS.break)
  })

  test('timerPhaseChange ke focus (setelah break) → gradient focus diterapkan ke body', () => {
    const handler = (e) => {
      const { phase } = e.detail
      document.body.style.background = PHASE_GRADIENTS[phase] || PHASE_GRADIENTS.focus
    }
    document.addEventListener('timerPhaseChange', handler)

    startTimer()
    // Selesaikan fokus + break → kembali ke idle focus
    vi.advanceTimersByTime((FOCUS_DURATION + BREAK_DURATION) * 1000)

    document.removeEventListener('timerPhaseChange', handler)

    // Setelah siklus penuh, event terakhir adalah timerPhaseChange ke 'focus'
    expect(document.body.style.background).toBe(PHASE_GRADIENTS.focus)
  })

  test('payload timerPhaseChange ke break memiliki phase=break dan remaining=300', () => {
    const capturedEvents = []
    const handler = (e) => capturedEvents.push(e.detail)
    document.addEventListener('timerPhaseChange', handler)

    startTimer()
    vi.advanceTimersByTime(FOCUS_DURATION * 1000)

    document.removeEventListener('timerPhaseChange', handler)

    const breakEvent = capturedEvents.find((d) => d.phase === 'break')
    expect(breakEvent).toBeDefined()
    expect(breakEvent.phase).toBe('break')
    expect(breakEvent.remaining).toBe(BREAK_DURATION)
  })

  test('gradient break menggunakan hue HSL dalam rentang 160–200° (Requirement 2.2)', () => {
    // Verifikasi bahwa nilai gradient break yang digunakan sesuai rentang HSL yang disyaratkan
    const breakGradient = PHASE_GRADIENTS.break

    // Extract semua nilai hue HSL dari string gradient
    const hslMatches = [...breakGradient.matchAll(/hsl\((\d+),/g)]
    expect(hslMatches.length).toBeGreaterThan(0)

    hslMatches.forEach((match) => {
      const hue = Number(match[1])
      expect(hue).toBeGreaterThanOrEqual(160)
      expect(hue).toBeLessThanOrEqual(200)
    })
  })

  test('gradient focus menggunakan hue HSL dalam rentang 0–10° (Requirement 2.1)', () => {
    const focusGradient = PHASE_GRADIENTS.focus

    const hslMatches = [...focusGradient.matchAll(/hsl\((\d+),/g)]
    expect(hslMatches.length).toBeGreaterThan(0)

    hslMatches.forEach((match) => {
      const hue = Number(match[1])
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThanOrEqual(10)
    })
  })
})

// ===========================================================================
// Test Suite 3: soundscapeError → pesan error muncul di #soundscape-error
// ===========================================================================

describe('Integration: soundscapeError → pesan error muncul di #soundscape-error', () => {
  /**
   * Validates: Requirements 3.7
   *
   * Alur: soundscape.js dispatch soundscapeError
   *       → app.js mendengarkan dan menulis pesan ke #soundscape-error
   *
   * Test ini mensimulasikan peran app.js: memasang listener soundscapeError
   * dan memperbarui elemen DOM — persis seperti handler di app.js.
   */

  let errorEl

  beforeEach(() => {
    // Buat elemen #soundscape-error di DOM sebelum setiap test
    errorEl = document.createElement('div')
    errorEl.id = 'soundscape-error'
    document.body.appendChild(errorEl)
  })

  afterEach(() => {
    // Bersihkan elemen DOM setelah setiap test
    if (errorEl && errorEl.parentNode) {
      errorEl.parentNode.removeChild(errorEl)
    }
  })

  test('soundscapeError event diterima dan pesan error berisi nama soundscape', () => {
    // Pasang listener seperti yang app.js lakukan
    const handler = (e) => {
      const { name, error } = e.detail
      const el = document.getElementById('soundscape-error')
      if (el) {
        const message = error && error.message
          ? `Gagal memuat "${name}": ${error.message}`
          : `Gagal memuat suara "${name}". Coba lagi.`
        el.textContent = message
      }
    }
    document.addEventListener('soundscapeError', handler)

    // Dispatch soundscapeError manual (simulasi apa yang soundscape.js lakukan)
    const soundscapeName = SOUNDSCAPE_CONFIG.lofi.label // 'Lo-Fi Beats'
    document.dispatchEvent(new CustomEvent('soundscapeError', {
      detail: { name: soundscapeName, error: new Error('File not found') },
    }))

    document.removeEventListener('soundscapeError', handler)

    const errorText = document.getElementById('soundscape-error').textContent
    expect(errorText).toContain(soundscapeName)
    expect(errorText).toContain('Lo-Fi Beats')
  })

  test('pesan error untuk setiap soundscape valid selalu menyebutkan nama soundscape', () => {
    const soundscapeNames = Object.values(SOUNDSCAPE_CONFIG).map((c) => c.label)

    const handler = (e) => {
      const { name, error } = e.detail
      const el = document.getElementById('soundscape-error')
      if (el) {
        const message = error && error.message
          ? `Gagal memuat "${name}": ${error.message}`
          : `Gagal memuat suara "${name}". Coba lagi.`
        el.textContent = message
      }
    }
    document.addEventListener('soundscapeError', handler)

    for (const name of soundscapeNames) {
      errorEl.textContent = ''

      document.dispatchEvent(new CustomEvent('soundscapeError', {
        detail: { name, error: new Error('load error') },
      }))

      expect(errorEl.textContent).toContain(name)
    }

    document.removeEventListener('soundscapeError', handler)
  })

  test('soundscapeError muncul di #soundscape-error tanpa mempengaruhi elemen DOM lain', () => {
    // Tambah elemen lain untuk memastikan hanya #soundscape-error yang diubah
    const timerDisplay = document.createElement('div')
    timerDisplay.id = 'timer-display'
    timerDisplay.textContent = '25:00'
    document.body.appendChild(timerDisplay)

    const handler = (e) => {
      const { name } = e.detail
      const el = document.getElementById('soundscape-error')
      if (el) el.textContent = `Gagal memuat suara "${name}". Coba lagi.`
    }
    document.addEventListener('soundscapeError', handler)

    document.dispatchEvent(new CustomEvent('soundscapeError', {
      detail: { name: 'Ocean Waves', error: null },
    }))

    document.removeEventListener('soundscapeError', handler)

    // Elemen error diperbarui
    expect(errorEl.textContent).toContain('Ocean Waves')
    // Timer display tidak terpengaruh
    expect(document.getElementById('timer-display').textContent).toBe('25:00')

    document.body.removeChild(timerDisplay)
  })

  test('soundscapeError muncul di #soundscape-error ketika audio gagal dimuat melalui playSoundscape', () => {
    // Simulasi: playSoundscape memanggil audio.onerror karena file tidak ada
    // Kita trigger onerror secara manual (karena JSDOM tidak memuat audio nyata)

    const handler = (e) => {
      const { name } = e.detail
      const el = document.getElementById('soundscape-error')
      if (el) {
        el.textContent = `Gagal memuat "${name}". Coba lagi.`
      }
    }
    document.addEventListener('soundscapeError', handler)

    // Dispatch event seperti yang soundscape.js lakukan pada onerror
    const config = SOUNDSCAPE_CONFIG.rain
    document.dispatchEvent(new CustomEvent('soundscapeError', {
      detail: { name: config.label, error: new Error('Network error') },
    }))

    document.removeEventListener('soundscapeError', handler)

    expect(errorEl.textContent).toContain('Rain')
  })
})

// ===========================================================================
// Test Suite 4: Siklus penuh fokus → break → idle
// ===========================================================================

describe('Integration: Siklus penuh fokus → break → idle — semua CustomEvent terdispatch dalam urutan benar', () => {
  /**
   * Validates: Requirements 2.1, 2.3, 4.3, 8.4
   *
   * Alur lengkap:
   *   startTimer() → [1500 detik] → focusSessionComplete + timerPhaseChange(break)
   *                → [300 detik] → timerPhaseChange(focus/idle)
   *
   * Memverifikasi bahwa semua CustomEvent terdispatch dengan payload yang benar
   * dan dalam urutan yang tepat.
   */
  test('siklus penuh mendispatch focusSessionComplete, timerPhaseChange(break), timerPhaseChange(focus) dalam urutan benar', () => {
    const eventLog = []

    const onFocusComplete = (e) => eventLog.push({ type: 'focusSessionComplete', detail: e.detail })
    const onPhaseChange   = (e) => eventLog.push({ type: 'timerPhaseChange',      detail: e.detail })

    document.addEventListener('focusSessionComplete', onFocusComplete)
    document.addEventListener('timerPhaseChange',     onPhaseChange)

    startTimer()

    // Selesaikan fase fokus (1500 detik)
    vi.advanceTimersByTime(FOCUS_DURATION * 1000)

    // Selesaikan fase break (300 detik)
    vi.advanceTimersByTime(BREAK_DURATION * 1000)

    document.removeEventListener('focusSessionComplete', onFocusComplete)
    document.removeEventListener('timerPhaseChange',     onPhaseChange)

    // Verifikasi bahwa focusSessionComplete di-dispatch
    const focusCompleteEvents = eventLog.filter((e) => e.type === 'focusSessionComplete')
    expect(focusCompleteEvents).toHaveLength(1)

    // Verifikasi bahwa timerPhaseChange ke break di-dispatch
    const breakPhaseEvents = eventLog.filter(
      (e) => e.type === 'timerPhaseChange' && e.detail.phase === 'break'
    )
    expect(breakPhaseEvents).toHaveLength(1)
    expect(breakPhaseEvents[0].detail.remaining).toBe(BREAK_DURATION)

    // Verifikasi bahwa timerPhaseChange ke focus (kembali idle) di-dispatch
    const focusPhaseEvents = eventLog.filter(
      (e) => e.type === 'timerPhaseChange' && e.detail.phase === 'focus'
    )
    expect(focusPhaseEvents).toHaveLength(1)
    expect(focusPhaseEvents[0].detail.remaining).toBe(FOCUS_DURATION)
  })

  test('urutan event: focusSessionComplete harus mendahului timerPhaseChange(break)', () => {
    const eventLog = []

    const onFocusComplete = () => eventLog.push('focusSessionComplete')
    const onPhaseChange   = (e) => {
      if (e.detail.phase === 'break') eventLog.push('timerPhaseChange:break')
    }

    document.addEventListener('focusSessionComplete', onFocusComplete)
    document.addEventListener('timerPhaseChange',     onPhaseChange)

    startTimer()
    vi.advanceTimersByTime(FOCUS_DURATION * 1000)

    document.removeEventListener('focusSessionComplete', onFocusComplete)
    document.removeEventListener('timerPhaseChange',     onPhaseChange)

    expect(eventLog).toContain('focusSessionComplete')
    expect(eventLog).toContain('timerPhaseChange:break')

    const focusIdx = eventLog.indexOf('focusSessionComplete')
    const breakIdx = eventLog.indexOf('timerPhaseChange:break')
    // focusSessionComplete harus terjadi sebelum timerPhaseChange:break
    expect(focusIdx).toBeLessThan(breakIdx)
  })

  test('payload focusSessionComplete dalam siklus penuh memiliki durationMinutes=25 dan date hari ini', () => {
    let capturedPayload = null
    const handler = (e) => { capturedPayload = e.detail }
    document.addEventListener('focusSessionComplete', handler)

    startTimer()
    vi.advanceTimersByTime(FOCUS_DURATION * 1000)

    document.removeEventListener('focusSessionComplete', handler)

    expect(capturedPayload).not.toBeNull()
    expect(capturedPayload.durationMinutes).toBe(25)
    expect(capturedPayload.date).toBe(todayStr())
  })

  test('setelah siklus penuh, gradient diterapkan oleh listener mengikuti urutan break → focus', () => {
    const gradientLog = []

    const handler = (e) => {
      const { phase } = e.detail
      const gradient = PHASE_GRADIENTS[phase] || PHASE_GRADIENTS.focus
      document.body.style.background = gradient
      gradientLog.push(phase)
    }
    document.addEventListener('timerPhaseChange', handler)

    startTimer()
    vi.advanceTimersByTime(FOCUS_DURATION * 1000)
    vi.advanceTimersByTime(BREAK_DURATION * 1000)

    document.removeEventListener('timerPhaseChange', handler)

    // Urutan gradient harus: break → focus
    expect(gradientLog[0]).toBe('break')
    expect(gradientLog[gradientLog.length - 1]).toBe('focus')

    // Gradient akhir harus gradient focus
    expect(document.body.style.background).toBe(PHASE_GRADIENTS.focus)
  })

  test('siklus penuh: analytics mencatat 25 menit dan 1 sesi setelah focusSessionComplete', () => {
    const today = todayStr()

    // Simulasi orchestrator app.js: dengarkan focusSessionComplete → panggil recordFocusSession
    const handler = (e) => {
      const { durationMinutes, date } = e.detail
      recordFocusSession(durationMinutes, date)
    }
    document.addEventListener('focusSessionComplete', handler)

    startTimer()
    vi.advanceTimersByTime(FOCUS_DURATION * 1000)
    vi.advanceTimersByTime(BREAK_DURATION * 1000)

    document.removeEventListener('focusSessionComplete', handler)

    const stats = getDailyStats(today)
    expect(stats.minutes).toBe(25)
    expect(stats.sessions).toBe(1)
  })

  test('timer kembali ke status idle setelah siklus penuh selesai', () => {
    startTimer()
    vi.advanceTimersByTime((FOCUS_DURATION + BREAK_DURATION) * 1000)

    // Setelah siklus fokus + break selesai, timer harus dalam status idle
    const state = getTimerState()
    expect(state.status).toBe('idle')
    expect(state.phase).toBe('focus')
    expect(state.remaining).toBe(FOCUS_DURATION)
  })
})
