/**
 * soundscape.js — Soundscape Studio Module
 *
 * Bertanggung jawab atas: manajemen HTMLAudioElement, playback loop,
 * kontrol volume, dan error handling.
 * Tidak memiliki referensi langsung ke modul lain.
 * Error dikomunikasikan melalui CustomEvent 'soundscapeError' pada document.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 8.2
 */

// Konfigurasi sumber audio (path relatif)
export const SOUNDSCAPE_CONFIG = {
  lofi:       { src: 'assets/audio/lofi-beats.mp3',   label: 'Lo-Fi Beats' },
  whitenoise: { src: 'assets/audio/white-noise.mp3',  label: 'White Noise' },
  ocean:      { src: 'assets/audio/ocean-waves.mp3',  label: 'Ocean Waves' },
  rain:       { src: 'assets/audio/rain.mp3',         label: 'Rain' },
}

// Internal state — satu audio aktif pada satu waktu
let currentAudio = null
let currentSoundscape = null

/**
 * Mulai memutar soundscape dengan nama yang diberikan.
 * Pause audio aktif sebelumnya, ganti src, set loop, dan play.
 * Menangkap NotAllowedError dari autoplay block.
 *
 * @param {string} name - Salah satu dari: 'lofi', 'whitenoise', 'ocean', 'rain'
 */
export function playSoundscape(name) {
  const config = SOUNDSCAPE_CONFIG[name]
  if (!config) return

  // Pause audio yang sedang aktif jika ada
  if (currentAudio) {
    currentAudio.pause()
  }

  // Buat Audio element baru (atau reuse dengan mengganti src)
  if (!currentAudio) {
    currentAudio = new Audio()
  }

  currentAudio.src = config.src
  currentAudio.loop = true

  // Error handler: dispatch soundscapeError ke document
  currentAudio.onerror = () => {
    document.dispatchEvent(new CustomEvent('soundscapeError', {
      detail: { name: config.label, error: currentAudio ? currentAudio.error : null },
    }))
  }

  // Set soundscape aktif sebelum play agar getCurrentSoundscape() akurat
  currentSoundscape = name

  // Mulai playback — tangkap NotAllowedError (autoplay block)
  currentAudio.play().catch((err) => {
    if (err.name === 'NotAllowedError') {
      // Tampilkan pesan melalui soundscapeError event dengan pesan khusus autoplay
      document.dispatchEvent(new CustomEvent('soundscapeError', {
        detail: { name: config.label, error: new Error('Klik untuk mengaktifkan audio') },
      }))
    }
  })
}

/**
 * Hentikan playback dan reset state audio.
 * Operasi atomik: jika gagal, coba sekali lagi; jika masih gagal, rollback.
 */
export function stopSoundscape() {
  const previousAudio = currentAudio
  const previousSoundscape = currentSoundscape

  try {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.src = ''
    }
    currentAudio = null
    currentSoundscape = null
  } catch (_err) {
    // Retry sekali
    try {
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.src = ''
      }
      currentAudio = null
      currentSoundscape = null
    } catch (_retryErr) {
      // Rollback ke kondisi sebelumnya jika kedua percobaan gagal
      currentAudio = previousAudio
      currentSoundscape = previousSoundscape
    }
  }
}

/**
 * Atur volume audio yang sedang aktif.
 * Jika tidak ada audio aktif, diam saja (tidak error).
 *
 * @param {number} value - Nilai volume antara 0.0 dan 1.0
 */
export function setVolume(value) {
  if (currentAudio) {
    currentAudio.volume = value
  }
}

/**
 * Kembalikan nama soundscape yang sedang aktif, atau null jika tidak ada.
 *
 * @returns {string|null}
 */
export function getCurrentSoundscape() {
  return currentSoundscape
}
