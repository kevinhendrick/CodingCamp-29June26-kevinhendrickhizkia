/**
 * soundscape.property.test.js — Property-Based Tests untuk soundscape.js
 *
 * Validates: Requirements 3.2, 3.4, 3.7
 */

import * as fc from 'fast-check'
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

// ─── Property 6: Volume Kontrol Selalu Diterapkan Akurat ─────────────────────
// Validates: Requirements 3.4

describe('Property 6: Volume Kontrol Selalu Diterapkan Akurat', () => {
  test('setVolume(v) menetapkan volume tepat v pada audio yang aktif untuk semua float [0.0, 1.0]', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.0, max: 1.0, noNaN: true }),
        (v) => {
          // Pastikan ada audio aktif terlebih dahulu
          playSoundscape('lofi')

          const audio = mockAudioInstances[mockAudioInstances.length - 1]
          expect(audio).toBeDefined()

          setVolume(v)

          // Volume harus tepat sama dengan yang diset
          expect(audio.volume).toBe(v)

          // Cleanup untuk iterasi berikutnya
          stopSoundscape()
          mockAudioInstances = []
          vi.stubGlobal('Audio', vi.fn(createMockAudio))
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─── Property 7: Soundscape Loop Aktif untuk Semua Pilihan Valid ──────────────
// Validates: Requirements 3.2

describe('Property 7: Soundscape Loop Aktif untuk Semua Pilihan Valid', () => {
  test('playSoundscape(s) selalu menetapkan loop=true dan src yang benar untuk semua pilihan valid', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('lofi', 'whitenoise', 'ocean', 'rain'),
        (soundscapeName) => {
          playSoundscape(soundscapeName)

          const audio = mockAudioInstances[mockAudioInstances.length - 1]
          expect(audio).toBeDefined()

          // loop harus true
          expect(audio.loop).toBe(true)

          // src harus diakhiri dengan path yang sesuai dari SOUNDSCAPE_CONFIG
          const expectedSrc = SOUNDSCAPE_CONFIG[soundscapeName].src
          expect(audio.src).toBe(expectedSrc)

          // Cleanup
          stopSoundscape()
          mockAudioInstances = []
          vi.stubGlobal('Audio', vi.fn(createMockAudio))
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── Property 8: Pesan Error Audio Selalu Menyebutkan Nama Soundscape ─────────
// Validates: Requirements 3.7

describe('Property 8: Pesan Error Audio Selalu Menyebutkan Nama Soundscape', () => {
  test('soundscapeError event memiliki detail.name sesuai label soundscape untuk semua pilihan valid', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('lofi', 'whitenoise', 'ocean', 'rain'),
        (soundscapeName) => {
          const receivedEvents = []
          const handler = (e) => receivedEvents.push(e.detail)
          document.addEventListener('soundscapeError', handler)

          playSoundscape(soundscapeName)

          const audio = mockAudioInstances[mockAudioInstances.length - 1]
          expect(audio).toBeDefined()
          expect(typeof audio.onerror).toBe('function')

          // Simulasi audio error
          audio.onerror()

          expect(receivedEvents.length).toBe(1)
          // detail.name harus sama dengan label dari SOUNDSCAPE_CONFIG
          expect(receivedEvents[0].name).toBe(SOUNDSCAPE_CONFIG[soundscapeName].label)

          document.removeEventListener('soundscapeError', handler)

          // Cleanup
          stopSoundscape()
          mockAudioInstances = []
          vi.stubGlobal('Audio', vi.fn(createMockAudio))
        }
      ),
      { numRuns: 100 }
    )
  })
})
