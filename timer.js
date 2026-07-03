/**
 * timer.js — Timer Core Module
 *
 * Bertanggung jawab atas: logika countdown, manajemen state fase, dispatch events.
 * Tidak memiliki referensi langsung ke modul lain.
 * Komunikasi keluar dilakukan melalui CustomEvent pada document.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 8.1, 8.4
 */

// ─── Konstanta Durasi ────────────────────────────────────────────────────────

export const FOCUS_DURATION = 1500  // 25 menit dalam detik
export const BREAK_DURATION = 300   // 5 menit dalam detik

// ─── Internal State (tidak diekspor) ─────────────────────────────────────────

let phase = 'focus'          // 'focus' | 'break'
let status = 'idle'          // 'idle' | 'running' | 'paused'
let remaining = FOCUS_DURATION  // sisa waktu dalam detik
let intervalId = null        // ID setInterval aktif, atau null

// ─── Helper: Format Waktu ─────────────────────────────────────────────────────

/**
 * Mengubah jumlah detik menjadi string format MM:SS.
 * @param {number} seconds - Jumlah detik (0–1500)
 * @returns {string} String berformat "MM:SS", misalnya "25:00", "01:30", "00:00"
 */
export function formatTime(seconds) {
    const mm = Math.floor(seconds / 60)
    const ss = seconds % 60
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

// ─── Helper: Hapus Interval Aktif ────────────────────────────────────────────

function clearActiveInterval() {
    if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
    }
}

// ─── Helper: Mulai Interval Countdown ────────────────────────────────────────

function startInterval() {
    intervalId = setInterval(() => {
        remaining--

        // Dispatch timerTick setiap detik
        document.dispatchEvent(new CustomEvent('timerTick', {
            detail: { remaining, phase }
        }))

        // Cek apakah countdown sudah habis
        if (remaining === 0) {
            if (phase === 'focus') {
                _handleFocusComplete()
            } else {
                _handleBreakComplete()
            }
        }
    }, 1000)
}

// ─── Handler: Fase Fokus Selesai ──────────────────────────────────────────────

function _handleFocusComplete() {
    clearActiveInterval()

    // Dispatch focusSessionComplete
    document.dispatchEvent(new CustomEvent('focusSessionComplete', {
        detail: {
            durationMinutes: 25,
            date: new Date().toISOString().slice(0, 10)
        }
    }))

    // Beralih ke fase break
    phase = 'break'
    remaining = BREAK_DURATION

    // Auto-start break
    startInterval()

    // Dispatch timerPhaseChange ke break
    document.dispatchEvent(new CustomEvent('timerPhaseChange', {
        detail: { phase: 'break', remaining: BREAK_DURATION }
    }))
}

// ─── Handler: Fase Break Selesai ──────────────────────────────────────────────

function _handleBreakComplete() {
    clearActiveInterval()

    // Reset kembali ke fase fokus, status idle
    phase = 'focus'
    remaining = FOCUS_DURATION
    status = 'idle'

    // Dispatch timerPhaseChange ke fokus (idle)
    document.dispatchEvent(new CustomEvent('timerPhaseChange', {
        detail: { phase: 'focus', remaining: FOCUS_DURATION }
    }))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Mulai countdown dari Fase_Fokus.
 * Guard: jika status sudah 'running', tidak melakukan apa-apa (Req 1.9).
 */
export function startTimer() {
    if (status === 'running') return  // Guard: sudah berjalan

    // Reset ke kondisi awal fokus
    clearActiveInterval()
    phase = 'focus'
    remaining = FOCUS_DURATION
    status = 'running'

    startInterval()
}

/**
 * Jeda countdown — menyimpan nilai remaining saat ini (Req 1.5).
 */
export function pauseTimer() {
    if (status !== 'running') return

    clearActiveInterval()
    status = 'paused'
    // remaining dipertahankan
}

/**
 * Lanjutkan countdown dari posisi terakhir (Req 1.6).
 * Guard: jika status bukan 'paused', tidak melakukan apa-apa (Req 1.10).
 */
export function resumeTimer() {
    if (status !== 'paused') return  // Guard: hanya dari status paused

    status = 'running'
    startInterval()
}

/**
 * Reset timer ke durasi awal fase aktif (Req 1.7).
 * Menghentikan interval dan mengatur status ke 'idle'.
 */
export function resetTimer() {
    clearActiveInterval()
    remaining = phase === 'focus' ? FOCUS_DURATION : BREAK_DURATION
    status = 'idle'
}

/**
 * Kembalikan snapshot state timer saat ini.
 * @returns {{ phase: string, remaining: number, status: string }}
 */
export function getTimerState() {
    return { phase, remaining, status }
}
