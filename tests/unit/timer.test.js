/**
 * timer.test.js — Unit Tests untuk timer.js
 *
 * Validates: Requirements 1.1–1.10
 */

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

// ─── Setup & Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
    vi.useFakeTimers()
    resetTimer()
})

afterEach(() => {
    resetTimer()
    vi.useRealTimers()
})

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('Timer — start memulai dari kondisi awal', () => {
    test('start memulai dari 25:00 (remaining=1500) dalam fase fokus', () => {
        startTimer()
        const state = getTimerState()
        expect(state.remaining).toBe(1500)
        expect(state.phase).toBe('focus')
        expect(state.status).toBe('running')
        expect(formatTime(state.remaining)).toBe('25:00')
    })

    test('countdown berjalan — setelah 1 detik remaining menjadi 1499', () => {
        startTimer()
        vi.advanceTimersByTime(1000)
        expect(getTimerState().remaining).toBe(1499)
    })

    test('countdown berjalan — setelah 5 detik remaining menjadi 1495', () => {
        startTimer()
        vi.advanceTimersByTime(5000)
        expect(getTimerState().remaining).toBe(1495)
    })
})

describe('Timer — countdown fase fokus mencapai 00:00', () => {
    test('saat fokus mencapai 0, beralih ke fase break', () => {
        startTimer()
        // Maju sepenuhnya melalui fase fokus
        vi.advanceTimersByTime(FOCUS_DURATION * 1000)
        const state = getTimerState()
        expect(state.phase).toBe('break')
    })

    test('saat fokus mencapai 0, dispatch event focusSessionComplete', () => {
        const handler = vi.fn()
        document.addEventListener('focusSessionComplete', handler)

        startTimer()
        vi.advanceTimersByTime(FOCUS_DURATION * 1000)

        expect(handler).toHaveBeenCalledTimes(1)
        const detail = handler.mock.calls[0][0].detail
        expect(detail.durationMinutes).toBe(25)
        expect(detail.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

        document.removeEventListener('focusSessionComplete', handler)
    })

    test('saat fokus mencapai 0, dispatch event timerPhaseChange ke break', () => {
        const handler = vi.fn()
        document.addEventListener('timerPhaseChange', handler)

        startTimer()
        vi.advanceTimersByTime(FOCUS_DURATION * 1000)

        // Cari event timerPhaseChange dengan phase=break
        const phaseChangeCalls = handler.mock.calls.filter(
            (call) => call[0].detail.phase === 'break'
        )
        expect(phaseChangeCalls.length).toBeGreaterThanOrEqual(1)
        expect(phaseChangeCalls[0][0].detail.remaining).toBe(BREAK_DURATION)

        document.removeEventListener('timerPhaseChange', handler)
    })

    test('setelah transisi ke break, break auto-start dengan remaining=300', () => {
        startTimer()
        vi.advanceTimersByTime(FOCUS_DURATION * 1000)

        const state = getTimerState()
        expect(state.phase).toBe('break')
        expect(state.status).toBe('running')
        expect(state.remaining).toBe(BREAK_DURATION)
    })
})

describe('Timer — countdown fase break mencapai 00:00', () => {
    test('saat break mencapai 0, kembali ke idle fase fokus', () => {
        startTimer()
        // Selesaikan seluruh focus + break cycle
        vi.advanceTimersByTime((FOCUS_DURATION + BREAK_DURATION) * 1000)

        const state = getTimerState()
        expect(state.phase).toBe('focus')
        expect(state.status).toBe('idle')
        expect(state.remaining).toBe(FOCUS_DURATION)
    })

    test('saat break selesai, dispatch timerPhaseChange kembali ke focus', () => {
        const handler = vi.fn()
        document.addEventListener('timerPhaseChange', handler)

        startTimer()
        vi.advanceTimersByTime((FOCUS_DURATION + BREAK_DURATION) * 1000)

        // Cari event timerPhaseChange dengan phase=focus (setelah break selesai)
        const focusChangeCalls = handler.mock.calls.filter(
            (call) => call[0].detail.phase === 'focus'
        )
        expect(focusChangeCalls.length).toBeGreaterThanOrEqual(1)

        document.removeEventListener('timerPhaseChange', handler)
    })
})

describe('Timer — label fase dispatch timerPhaseChange dengan payload yang benar', () => {
    test('timerPhaseChange saat beralih ke break memiliki payload yang benar', () => {
        const events = []
        document.addEventListener('timerPhaseChange', (e) => events.push(e.detail))

        startTimer()
        vi.advanceTimersByTime(FOCUS_DURATION * 1000)

        const breakEvent = events.find((d) => d.phase === 'break')
        expect(breakEvent).toBeDefined()
        expect(breakEvent.phase).toBe('break')
        expect(breakEvent.remaining).toBe(BREAK_DURATION)

        document.removeEventListener('timerPhaseChange', () => {})
    })

    test('timerPhaseChange saat kembali ke focus memiliki payload yang benar', () => {
        const events = []
        const handler = (e) => events.push(e.detail)
        document.addEventListener('timerPhaseChange', handler)

        startTimer()
        vi.advanceTimersByTime((FOCUS_DURATION + BREAK_DURATION) * 1000)

        const focusEvent = events.find((d) => d.phase === 'focus')
        expect(focusEvent).toBeDefined()
        expect(focusEvent.phase).toBe('focus')
        expect(focusEvent.remaining).toBe(FOCUS_DURATION)

        document.removeEventListener('timerPhaseChange', handler)
    })
})

describe('Timer — pause dan resume', () => {
    test('pause menghentikan countdown dan mempertahankan remaining', () => {
        startTimer()
        vi.advanceTimersByTime(3000)
        const remainingBefore = getTimerState().remaining // 1497

        pauseTimer()
        expect(getTimerState().status).toBe('paused')
        expect(getTimerState().remaining).toBe(remainingBefore)

        // Maju waktu saat paused — remaining tidak boleh berubah
        vi.advanceTimersByTime(5000)
        expect(getTimerState().remaining).toBe(remainingBefore)
    })

    test('resume melanjutkan countdown dari posisi terakhir', () => {
        startTimer()
        vi.advanceTimersByTime(3000)
        pauseTimer()

        const remainingBeforeResume = getTimerState().remaining
        resumeTimer()

        expect(getTimerState().status).toBe('running')
        expect(getTimerState().remaining).toBe(remainingBeforeResume)

        // Maju 2 detik setelah resume
        vi.advanceTimersByTime(2000)
        expect(getTimerState().remaining).toBe(remainingBeforeResume - 2)
    })
})

describe('Timer — reset', () => {
    test('resetTimer() dari fase fokus → remaining=1500, status=idle', () => {
        startTimer()
        vi.advanceTimersByTime(10000)
        resetTimer()

        const state = getTimerState()
        expect(state.status).toBe('idle')
        expect(state.remaining).toBe(FOCUS_DURATION)
        expect(state.phase).toBe('focus')
    })

    test('resetTimer() menghentikan countdown', () => {
        startTimer()
        vi.advanceTimersByTime(2000)
        resetTimer()

        const remainingAfterReset = getTimerState().remaining
        // Maju waktu setelah reset — remaining tidak boleh berubah
        vi.advanceTimersByTime(3000)
        expect(getTimerState().remaining).toBe(remainingAfterReset)
    })
})

describe('Timer — guard conditions', () => {
    test('startTimer() saat sudah running tidak mereset timer', () => {
        startTimer()
        vi.advanceTimersByTime(5000)

        const stateBefore = getTimerState()
        startTimer() // dipanggil lagi saat sudah running

        const stateAfter = getTimerState()
        expect(stateAfter.remaining).toBe(stateBefore.remaining)
        expect(stateAfter.phase).toBe(stateBefore.phase)
        expect(stateAfter.status).toBe('running')
    })

    test('resumeTimer() saat status idle tidak mengubah state', () => {
        resetTimer()
        const stateBefore = getTimerState()

        resumeTimer()

        const stateAfter = getTimerState()
        expect(stateAfter.remaining).toBe(stateBefore.remaining)
        expect(stateAfter.status).toBe('idle')
    })

    test('pauseTimer() saat status idle tidak melakukan apa-apa', () => {
        resetTimer()
        const stateBefore = getTimerState()

        pauseTimer()

        const stateAfter = getTimerState()
        expect(stateAfter.status).toBe(stateBefore.status)
        expect(stateAfter.remaining).toBe(stateBefore.remaining)
    })
})

describe('formatTime — edge cases', () => {
    test('formatTime(0) === "00:00"', () => {
        expect(formatTime(0)).toBe('00:00')
    })

    test('formatTime(1500) === "25:00"', () => {
        expect(formatTime(1500)).toBe('25:00')
    })

    test('formatTime(90) === "01:30"', () => {
        expect(formatTime(90)).toBe('01:30')
    })

    test('formatTime(300) === "05:00"', () => {
        expect(formatTime(300)).toBe('05:00')
    })

    test('formatTime(61) === "01:01"', () => {
        expect(formatTime(61)).toBe('01:01')
    })

    test('formatTime(59) === "00:59"', () => {
        expect(formatTime(59)).toBe('00:59')
    })
})
