/**
 * app.js — Application Orchestrator
 *
 * Bertanggung jawab atas: inisialisasi aplikasi, binding event DOM ↔ modul,
 * dan routing CustomEvent antar modul.
 * Ini adalah satu-satunya modul yang boleh mengimpor dari modul lain.
 *
 * Requirements: 1.8, 2.4, 3.7, 4.3, 4.4, 8.4, 8.5
 */

import {
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  getTimerState,
  formatTime,
} from './timer.js'

import {
  playSoundscape,
  stopSoundscape,
  setVolume,
  getCurrentSoundscape,
} from './soundscape.js'

import {
  initAnalytics,
  recordFocusSession,
  renderWeeklyChart,
} from './analytics.js'

// ---------------------------------------------------------------------------
// Gradient constants — Task 10.2
// Requirements: 2.1, 2.2, 2.3
// ---------------------------------------------------------------------------

/**
 * Phase gradients using HSL values per spec requirements:
 * Focus: hue 0–10°, saturation 60–80%, lightness 75–90%
 * Break: hue 160–200°, saturation 50–70%, lightness 75–90%
 */
const PHASE_GRADIENTS = {
  focus: 'linear-gradient(135deg, hsl(5, 70%, 85%), hsl(2, 65%, 90%))',
  break: 'linear-gradient(135deg, hsl(180, 58%, 82%), hsl(165, 52%, 88%))',
}

const FOCUS_DEFAULT_GRADIENT = PHASE_GRADIENTS.focus

/**
 * Terapkan gradient CSS ke document.body sesuai fase aktif.
 * Transisi ease-in-out 1200ms sudah di-handle oleh CSS transition property.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 *
 * @param {'focus'|'break'} phase
 */
function applyPhaseGradient(phase) {
  const gradient = PHASE_GRADIENTS[phase] || PHASE_GRADIENTS.focus
  document.body.style.background = gradient
}

// ---------------------------------------------------------------------------
// Button visibility helper (Req 1.9, 1.10)
// ---------------------------------------------------------------------------

/**
 * Perbarui visibilitas tombol timer berdasarkan status saat ini.
 *
 * - idle:   tampilkan Start + Reset, sembunyikan Pause + Resume
 * - running: tampilkan Pause + Reset, sembunyikan Start + Resume
 * - paused:  tampilkan Resume + Reset, sembunyikan Start + Pause
 *
 * @param {'idle'|'running'|'paused'} status
 */
function updateButtonVisibility(status) {
  const btnStart  = document.getElementById('btn-start')
  const btnPause  = document.getElementById('btn-pause')
  const btnResume = document.getElementById('btn-resume')
  const btnReset  = document.getElementById('btn-reset')

  if (!btnStart || !btnPause || !btnResume || !btnReset) return

  if (status === 'idle') {
    btnStart.hidden  = false
    btnPause.hidden  = true
    btnResume.hidden = true
    btnReset.hidden  = false
  } else if (status === 'running') {
    btnStart.hidden  = true
    btnPause.hidden  = false
    btnResume.hidden = true
    btnReset.hidden  = false
  } else if (status === 'paused') {
    btnStart.hidden  = true
    btnPause.hidden  = true
    btnResume.hidden = false
    btnReset.hidden  = false
  }
}

// ---------------------------------------------------------------------------
// Phase label helper (Req 1.8)
// ---------------------------------------------------------------------------

/**
 * Perbarui teks dan visibilitas #phase-label.
 * Saat running/paused: tampilkan "FOKUS" atau "ISTIRAHAT".
 * Saat idle: sembunyikan label (gunakan atribut `hidden`).
 *
 * @param {'focus'|'break'} phase
 * @param {'idle'|'running'|'paused'} status
 */
function updatePhaseLabel(phase, status) {
  const phaseLabel = document.getElementById('phase-label')
  if (!phaseLabel) return

  if (status === 'idle') {
    phaseLabel.hidden = true
    phaseLabel.textContent = ''
  } else {
    phaseLabel.hidden = false
    phaseLabel.textContent = phase === 'focus' ? 'FOKUS' : 'ISTIRAHAT'
  }
}

// ---------------------------------------------------------------------------
// Soundscape active-state helper
// ---------------------------------------------------------------------------

/**
 * Perbarui aria-pressed pada semua tombol soundscape.
 * Tombol yang sesuai dengan soundscape aktif mendapat aria-pressed="true",
 * semua lainnya mendapat aria-pressed="false".
 *
 * @param {string|null} activeSoundscape - Nama soundscape aktif, atau null
 */
function updateSoundscapeButtons(activeSoundscape) {
  const buttons = document.querySelectorAll('.soundscape-btn[data-sound]')
  buttons.forEach((btn) => {
    const isActive = btn.dataset.sound === activeSoundscape
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false')
  })
}

// ---------------------------------------------------------------------------
// DOMContentLoaded — main initialization
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Inisialisasi Analytics ──────────────────────────────────────────────
  initAnalytics()

  // ── 2. Gradient default Fase_Fokus saat halaman pertama dimuat ────────────
  // Req 2.4: terapkan gradient fokus secara default
  document.body.style.background = FOCUS_DEFAULT_GRADIENT

  // ── 3. Bind tombol timer ──────────────────────────────────────────────────

  const btnStart  = document.getElementById('btn-start')
  const btnPause  = document.getElementById('btn-pause')
  const btnResume = document.getElementById('btn-resume')
  const btnReset  = document.getElementById('btn-reset')

  if (btnStart) {
    btnStart.addEventListener('click', () => {
      startTimer()
      updateButtonVisibility('running')
      // Phase label akan diupdate via timerPhaseChange atau langsung di sini
      const { phase, status } = getTimerState()
      updatePhaseLabel(phase, status)
    })
  }

  if (btnPause) {
    btnPause.addEventListener('click', () => {
      pauseTimer()
      updateButtonVisibility('paused')
      const { phase } = getTimerState()
      updatePhaseLabel(phase, 'paused')
    })
  }

  if (btnResume) {
    btnResume.addEventListener('click', () => {
      resumeTimer()
      updateButtonVisibility('running')
      const { phase } = getTimerState()
      updatePhaseLabel(phase, 'running')
    })
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      resetTimer()
      updateButtonVisibility('idle')
      const { phase, remaining } = getTimerState()
      updatePhaseLabel(phase, 'idle')
      // Perbarui display ke durasi reset (Req 1.7)
      const timerDisplay = document.getElementById('timer-display')
      if (timerDisplay) timerDisplay.textContent = formatTime(remaining)
    })
  }

  // ── 4. Bind soundscape buttons ────────────────────────────────────────────

  const soundscapeButtons = document.querySelectorAll('.soundscape-btn[data-sound]')
  soundscapeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const soundName = btn.dataset.sound
      playSoundscape(soundName)
      updateSoundscapeButtons(soundName)
    })
  })

  // ── 5. Bind #volume-control → setVolume() ─────────────────────────────────

  const volumeControl = document.getElementById('volume-control')
  if (volumeControl) {
    volumeControl.addEventListener('input', (e) => {
      setVolume(Number(e.target.value))
    })
  }

  // ── 6. Bind #btn-stop-sound ───────────────────────────────────────────────

  const btnStopSound = document.getElementById('btn-stop-sound')
  if (btnStopSound) {
    btnStopSound.addEventListener('click', () => {
      stopSoundscape()
      updateSoundscapeButtons(null)
    })
  }

  // ── 7. CustomEvent: timerTick → update #timer-display ────────────────────
  // Req 8.4: update display setiap detik

  document.addEventListener('timerTick', (e) => {
    const { remaining } = e.detail
    const timerDisplay = document.getElementById('timer-display')
    if (timerDisplay) {
      timerDisplay.textContent = formatTime(remaining)
    }
  })

  // ── 8. CustomEvent: timerPhaseChange → update #phase-label + gradient ─────
  // Req 1.8: tampilkan/sembunyikan label fase
  // Req 2.4: terapkan gradient sesuai fase
  // Req 1.4: tampilkan notifikasi saat timer kembali ke idle fokus

  document.addEventListener('timerPhaseChange', (e) => {
    const { phase, remaining } = e.detail
    const { status } = getTimerState()

    // Update phase label
    updatePhaseLabel(phase, status)

    // Update timer display dengan remaining dari event
    const timerDisplay = document.getElementById('timer-display')
    if (timerDisplay) {
      timerDisplay.textContent = formatTime(remaining)
    }

    // Terapkan gradient fase (Req 2.1, 2.2, 2.3)
    applyPhaseGradient(phase)

    // Update button visibility berdasarkan status terkini
    updateButtonVisibility(status)

    // Notifikasi saat break selesai dan timer kembali ke idle fokus (Req 1.4)
    if (phase === 'focus' && status === 'idle') {
      const notifEl = document.getElementById('timer-notification')
      if (notifEl) {
        notifEl.textContent = 'Istirahat selesai! Siap untuk sesi berikutnya?'
        setTimeout(() => { if (notifEl) notifEl.textContent = '' }, 4000)
      }
    }
  })

  // ── 10. CustomEvent: soundscapeError → tampilkan di #soundscape-error ─────
  // Req 3.7: tampilkan pesan error audio

  document.addEventListener('soundscapeError', (e) => {
    const { name, error } = e.detail
    const errorEl = document.getElementById('soundscape-error')
    if (errorEl) {
      const message = error && error.message
        ? `Gagal memuat "${name}": ${error.message}`
        : `Gagal memuat suara "${name}". Coba lagi.`
      errorEl.textContent = message
      // Kosongkan pesan setelah 5 detik
      setTimeout(() => {
        if (errorEl) errorEl.textContent = ''
      }, 5000)
    }

    // Update aria-pressed karena soundscape mungkin gagal
    updateSoundscapeButtons(getCurrentSoundscape())
  })

  // ── 11. Set initial UI state ──────────────────────────────────────────────

  // Button visibility sesuai state idle awal
  updateButtonVisibility('idle')

  // Phase label tersembunyi saat idle (Req 1.8)
  const { phase: initialPhase, status: initialStatus } = getTimerState()
  updatePhaseLabel(initialPhase, initialStatus)

  // Pastikan semua soundscape buttons dalam state tidak aktif
  updateSoundscapeButtons(null)
})
