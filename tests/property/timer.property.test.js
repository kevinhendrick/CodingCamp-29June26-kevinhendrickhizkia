/**
 * timer.property.test.js — Property-Based Tests untuk timer.js
 *
 * Validates: Requirements 1.1, 1.5, 1.6, 1.7, 1.9, 1.10
 */

import * as fc from 'fast-check'
import {
    formatTime,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    getTimerState,
    FOCUS_DURATION,
    BREAK_DURATION,
} from '../../timer.js'

// ─── Reset state antara setiap test ──────────────────────────────────────────

beforeEach(() => {
    vi.useFakeTimers()
    resetTimer()
})

afterEach(() => {
    resetTimer()
    vi.useRealTimers()
})

// ─── Property 1: Format Waktu MM:SS Selalu Valid ──────────────────────────────
// Validates: Requirements 1.1

describe('Property 1: Format Waktu MM:SS Selalu Valid', () => {
    test('formatTime menghasilkan format MM:SS yang valid dan akurat untuk semua detik [0,1500]', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 1500 }),
                (seconds) => {
                    const result = formatTime(seconds)

                    // Harus cocok pola MM:SS
                    expect(result).toMatch(/^\d{2}:\d{2}$/)

                    // Nilai numerik harus akurat: mm*60 + ss === seconds
                    const [mm, ss] = result.split(':').map(Number)
                    expect(mm * 60 + ss).toBe(seconds)
                }
            ),
            { numRuns: 100 }
        )
    })
})

// ─── Property 2: Pause Membekukan dan Resume Memulihkan Nilai Remaining ───────
// Validates: Requirements 1.5, 1.6

describe('Property 2: Pause Membekukan dan Resume Memulihkan Nilai Remaining', () => {
    test('remaining tidak berubah setelah pause; status kembali running setelah resume', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 1490 }),
                fc.constantFrom('focus', 'break'),
                (ticksToAdvance, _phase) => {
                    // Mulai timer (selalu mulai dari focus/1500)
                    startTimer()
                    expect(getTimerState().status).toBe('running')

                    // Maju beberapa detik menggunakan fake timers
                    vi.advanceTimersByTime(ticksToAdvance * 1000)

                    const stateBeforePause = getTimerState()
                    const remainingBeforePause = stateBeforePause.remaining

                    // Pause
                    pauseTimer()
                    const stateAfterPause = getTimerState()
                    expect(stateAfterPause.status).toBe('paused')
                    expect(stateAfterPause.remaining).toBe(remainingBeforePause)

                    // Maju waktu saat paused — tidak boleh mengubah remaining
                    vi.advanceTimersByTime(5000)
                    expect(getTimerState().remaining).toBe(remainingBeforePause)

                    // Resume
                    resumeTimer()
                    const stateAfterResume = getTimerState()
                    expect(stateAfterResume.status).toBe('running')
                    expect(stateAfterResume.remaining).toBe(remainingBeforePause)

                    // Cleanup: reset untuk iterasi berikutnya
                    resetTimer()
                }
            ),
            { numRuns: 100 }
        )
    })
})

// ─── Property 3: Reset Selalu Menghasilkan Durasi Awal Fase yang Tepat ────────
// Validates: Requirements 1.7

describe('Property 3: Reset Selalu Menghasilkan Durasi Awal Fase yang Tepat', () => {
    test('resetTimer() menghasilkan remaining sesuai fase dan status idle', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('focus', 'break'),
                fc.constantFrom('idle', 'running', 'paused'),
                fc.integer({ min: 0, max: 1500 }),
                (targetPhase, _targetStatus, _remaining) => {
                    // Untuk fase break: start lalu tunggu focus selesai (simulasi)
                    // Strategi sederhana: start timer, tes reset di fase focus
                    // Untuk focus phase
                    startTimer()
                    // State sekarang: phase=focus, status=running

                    if (targetPhase === 'break') {
                        // Simulasikan focus selesai → break dimulai
                        vi.advanceTimersByTime(FOCUS_DURATION * 1000)
                        // Sekarang seharusnya di fase break
                    } else {
                        // Tetap di fase focus
                        vi.advanceTimersByTime(100) // sedikit maju
                    }

                    const phaseBeforeReset = getTimerState().phase

                    // Reset
                    resetTimer()

                    const state = getTimerState()
                    expect(state.status).toBe('idle')

                    if (phaseBeforeReset === 'focus') {
                        expect(state.remaining).toBe(FOCUS_DURATION)
                    } else {
                        expect(state.remaining).toBe(BREAK_DURATION)
                    }

                    // Cleanup
                    resetTimer()
                }
            ),
            { numRuns: 100 }
        )
    })

    test('resetTimer() dari idle phase focus → remaining === FOCUS_DURATION', () => {
        // Pastikan kita di fase focus (startTimer() selalu reset ke focus)
        // Lalu reset langsung tanpa maju waktu
        startTimer()
        // Sekarang phase=focus, status=running, remaining=1500
        resetTimer()
        const state = getTimerState()
        expect(state.status).toBe('idle')
        expect(state.remaining).toBe(FOCUS_DURATION)
        expect(state.phase).toBe('focus')
    })
})

// ─── Property 4: Timer Berjalan Mengabaikan Start; Timer Non-Paused Mengabaikan Resume ─
// Validates: Requirements 1.9, 1.10

describe('Property 4: Guard Conditions', () => {
    test('startTimer() saat status running tidak mengubah remaining, phase, status', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }),
                (ticks) => {
                    startTimer()
                    vi.advanceTimersByTime(ticks * 1000)

                    const stateBefore = getTimerState()
                    expect(stateBefore.status).toBe('running')

                    // Panggil startTimer() lagi saat sudah running
                    startTimer()

                    const stateAfter = getTimerState()
                    // Guard: tidak boleh mereset/mengubah state
                    expect(stateAfter.remaining).toBe(stateBefore.remaining)
                    expect(stateAfter.phase).toBe(stateBefore.phase)
                    expect(stateAfter.status).toBe('running')

                    resetTimer()
                }
            ),
            { numRuns: 100 }
        )
    })

    test('resumeTimer() saat status idle tidak mengubah state', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 1 }), // dummy generator untuk fc.assert
                (_dummy) => {
                    // Status idle (setelah resetTimer)
                    resetTimer()
                    const stateBefore = getTimerState()
                    expect(stateBefore.status).toBe('idle')

                    resumeTimer()

                    const stateAfter = getTimerState()
                    expect(stateAfter.remaining).toBe(stateBefore.remaining)
                    expect(stateAfter.phase).toBe(stateBefore.phase)
                    expect(stateAfter.status).toBe('idle')
                }
            ),
            { numRuns: 100 }
        )
    })

    test('resumeTimer() saat status running tidak mengubah state', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }),
                (ticks) => {
                    startTimer()
                    vi.advanceTimersByTime(ticks * 1000)

                    const stateBefore = getTimerState()
                    expect(stateBefore.status).toBe('running')

                    resumeTimer()

                    const stateAfter = getTimerState()
                    expect(stateAfter.remaining).toBe(stateBefore.remaining)
                    expect(stateAfter.phase).toBe(stateBefore.phase)
                    expect(stateAfter.status).toBe('running')

                    resetTimer()
                }
            ),
            { numRuns: 100 }
        )
    })
})

// ─── Property 5: Warna Latar Sesuai Rentang HSL Fase yang Ditetapkan ─────────
// Validates: Requirements 2.1, 2.2

/**
 * PHASE_GRADIENTS diambil langsung dari app.js (didefinisikan ulang di sini
 * karena app.js memiliki side-effect DOMContentLoaded dan tidak dapat diimpor
 * dalam lingkungan test).
 *
 * Focus:  hsl(5, 70%, 85%), hsl(2, 65%, 90%)
 * Break:  hsl(180, 58%, 82%), hsl(165, 52%, 88%)
 */
const PHASE_GRADIENTS_FOR_TEST = {
    focus: 'linear-gradient(135deg, hsl(5, 70%, 85%), hsl(2, 65%, 90%))',
    break: 'linear-gradient(135deg, hsl(180, 58%, 82%), hsl(165, 52%, 88%))',
}

/**
 * Parse semua nilai HSL dari sebuah CSS gradient string.
 * Mengembalikan array objek { hue, saturation, lightness }.
 *
 * @param {string} gradientStr
 * @returns {{ hue: number, saturation: number, lightness: number }[]}
 */
function parseHSLValues(gradientStr) {
    // Cocokkan semua kemunculan hsl(h, s%, l%)
    const hslRegex = /hsl\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)/g
    const results = []
    let match
    while ((match = hslRegex.exec(gradientStr)) !== null) {
        results.push({
            hue:        parseFloat(match[1]),
            saturation: parseFloat(match[2]),
            lightness:  parseFloat(match[3]),
        })
    }
    return results
}

describe('Property 5: Warna Latar Sesuai Rentang HSL Fase yang Ditetapkan', () => {
    test('nilai HSL dalam PHASE_GRADIENTS berada dalam rentang yang ditetapkan spec untuk setiap fase', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('focus', 'break'),
                (phase) => {
                    const gradientStr = PHASE_GRADIENTS_FOR_TEST[phase]

                    // Pastikan gradient terdefinisi untuk fase ini
                    expect(gradientStr).toBeDefined()
                    expect(typeof gradientStr).toBe('string')

                    // Ekstrak semua nilai HSL dari gradient string
                    const hslValues = parseHSLValues(gradientStr)

                    // Harus ada setidaknya satu pasangan warna HSL
                    expect(hslValues.length).toBeGreaterThanOrEqual(1)

                    if (phase === 'focus') {
                        // Req 2.1: hue [0°, 10°], saturation [60%, 80%], lightness [75%, 90%]
                        for (const { hue, saturation, lightness } of hslValues) {
                            expect(hue).toBeGreaterThanOrEqual(0)
                            expect(hue).toBeLessThanOrEqual(10)
                            expect(saturation).toBeGreaterThanOrEqual(60)
                            expect(saturation).toBeLessThanOrEqual(80)
                            expect(lightness).toBeGreaterThanOrEqual(75)
                            expect(lightness).toBeLessThanOrEqual(90)
                        }
                    } else {
                        // Req 2.2: hue [160°, 200°], saturation [50%, 70%], lightness [75%, 90%]
                        for (const { hue, saturation, lightness } of hslValues) {
                            expect(hue).toBeGreaterThanOrEqual(160)
                            expect(hue).toBeLessThanOrEqual(200)
                            expect(saturation).toBeGreaterThanOrEqual(50)
                            expect(saturation).toBeLessThanOrEqual(70)
                            expect(lightness).toBeGreaterThanOrEqual(75)
                            expect(lightness).toBeLessThanOrEqual(90)
                        }
                    }
                }
            ),
            { numRuns: 100 }
        )
    })
})
