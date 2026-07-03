/**
 * soundscape.test.js — Unit Tests untuk soundscape.js
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import {
  playSoundscape,
  stopSoundscape,
  setVolume,
  getCurrentSoundscape,
  SOUNDSCAPE_CONFIG,
} from '../../soundscape.js'

// ─── Mock Audio Setup ─────────────────────────────────────────────────────────

let mockAudioInstances = []

const createMockAudio = () => {
  const instance = {
    src: '',
    loop: false,
    volume: 0.5,
    onerror: null,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
  }
  mockAudioInstances.push(instance)
  return instance
}

beforeEach(() => {
  mockAudioInstances = []
  vi.stubGlobal('Audio', vi.fn(createMockAudio))
  stopSoundscape()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('Soundscape — stopSoundscape()', () => {
  test('stopSoundscape() → getCurrentSoundscape() === null', () => {
    playSoundscape('lofi')
    expect(getCurrentSoundscape()).toBe('lofi')

    stopSoundscape()
    expect(getCurrentSoundscape()).toBeNull()
  })

  test('stopSoundscape() memanggil pause() pada audio yang aktif', () => {
    playSoundscape('ocean')
    const audio = mockAudioInstances[mockAudioInstances.length - 1]

    stopSoundscape()
    expect(audio.pause).toHaveBeenCalled()
  })

  test('stopSoundscape() tanpa audio aktif tidak melempar error', () => {
    // Tidak ada audio aktif
    expect(() => stopSoundscape()).not.toThrow()
    expect(getCurrentSoundscape()).toBeNull()
  })
})

describe('Soundscape — switch soundscape menghentikan audio sebelumnya', () => {
  test('switch soundscape → audio sebelumnya di-pause', async () => {
    playSoundscape('lofi')
    const firstAudio = mockAudioInstances[0]

    // Ganti ke soundscape lain
    playSoundscape('rain')

    // Audio pertama harus sudah di-pause
    expect(firstAudio.pause).toHaveBeenCalled()
    // Soundscape baru seharusnya aktif
    expect(getCurrentSoundscape()).toBe('rain')
  })

  test('switch soundscape menetapkan src baru dengan benar', () => {
    playSoundscape('lofi')
    playSoundscape('ocean')

    // soundscape.js reuses currentAudio, so the last audio instance gets the new src
    const audio = mockAudioInstances[mockAudioInstances.length - 1]
    expect(audio.src).toBe(SOUNDSCAPE_CONFIG['ocean'].src)
  })
})

describe('Soundscape — autoplay diblokir → event soundscapeError dispatched', () => {
  test('autoplay diblokir (NotAllowedError) → dispatch event soundscapeError', async () => {
    // Override play mock untuk mengembalikan NotAllowedError
    const notAllowedError = new DOMException('play() failed', 'NotAllowedError')
    const mockAudioWithBlock = {
      src: '',
      loop: false,
      volume: 0.5,
      onerror: null,
      play: vi.fn(() => Promise.reject(notAllowedError)),
      pause: vi.fn(),
    }

    // Reset instances dan stub ulang dengan audio yang memblokir
    mockAudioInstances = [mockAudioWithBlock]
    vi.stubGlobal('Audio', vi.fn(() => {
      mockAudioInstances.push(mockAudioWithBlock)
      return mockAudioWithBlock
    }))
    stopSoundscape()

    const receivedEvents = []
    const handler = (e) => receivedEvents.push(e.detail)
    document.addEventListener('soundscapeError', handler)

    playSoundscape('lofi')

    // Tunggu promise rejection diselesaikan
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(receivedEvents.length).toBeGreaterThanOrEqual(1)
    const errorEvent = receivedEvents[receivedEvents.length - 1]
    expect(errorEvent.name).toBe(SOUNDSCAPE_CONFIG['lofi'].label)
    expect(errorEvent.error.message).toContain('Klik untuk mengaktifkan audio')

    document.removeEventListener('soundscapeError', handler)
  })
})

describe('Soundscape — playSoundscape saat timer running', () => {
  test('playSoundscape dapat dipanggil kapan saja, independen dari timer', () => {
    // playSoundscape tidak bergantung pada status timer
    // Simulasikan kondisi "timer sedang berjalan" dengan hanya memanggil playSoundscape
    // karena soundscape.js tidak memiliki referensi ke timer.js
    expect(() => playSoundscape('whitenoise')).not.toThrow()
    expect(getCurrentSoundscape()).toBe('whitenoise')

    const audio = mockAudioInstances[mockAudioInstances.length - 1]
    expect(audio.play).toHaveBeenCalled()
  })

  test('playSoundscape berhasil dipanggil ulang dengan soundscape berbeda', () => {
    playSoundscape('lofi')
    expect(getCurrentSoundscape()).toBe('lofi')

    playSoundscape('rain')
    expect(getCurrentSoundscape()).toBe('rain')

    playSoundscape('ocean')
    expect(getCurrentSoundscape()).toBe('ocean')
  })
})

describe('Soundscape — setVolume()', () => {
  test('setVolume mengubah volume pada audio aktif', () => {
    playSoundscape('lofi')
    const audio = mockAudioInstances[mockAudioInstances.length - 1]

    setVolume(0.3)
    expect(audio.volume).toBe(0.3)

    setVolume(0.0)
    expect(audio.volume).toBe(0.0)

    setVolume(1.0)
    expect(audio.volume).toBe(1.0)
  })

  test('setVolume tanpa audio aktif tidak melempar error', () => {
    stopSoundscape()
    expect(() => setVolume(0.5)).not.toThrow()
  })
})

describe('Soundscape — error event audio', () => {
  test('audio error → dispatch soundscapeError dengan nama soundscape yang benar', () => {
    const receivedEvents = []
    const handler = (e) => receivedEvents.push(e.detail)
    document.addEventListener('soundscapeError', handler)

    playSoundscape('whitenoise')
    const audio = mockAudioInstances[mockAudioInstances.length - 1]

    // Simulasi error audio
    audio.onerror()

    expect(receivedEvents.length).toBe(1)
    expect(receivedEvents[0].name).toBe(SOUNDSCAPE_CONFIG['whitenoise'].label)

    document.removeEventListener('soundscapeError', handler)
  })
})
