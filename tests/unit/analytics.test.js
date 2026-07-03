/**
 * analytics.test.js — Unit Tests untuk analytics.js
 *
 * Validates: Requirements 4.3, 4.4, 4.5, 4.6, 6.1, 6.2, 6.4, 6.6
 */

import {
  recordFocusSession,
  getDailyStats,
  safeLocalStorageGet,
  safeLocalStorageSet,
  _resetInternalStateForTest,
} from '../../analytics.js'

// ─── Reset LocalStorage antara setiap test ────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  _resetInternalStateForTest()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Edge Case: LocalStorage tidak tersedia ───────────────────────────────────

describe('Analytics — LocalStorage tidak tersedia → nilai nol tanpa error', () => {
  test('safeLocalStorageGet mengembalikan defaultValue tanpa error saat localStorage.getItem melempar', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('localStorage not available')
    })

    let result
    expect(() => {
      result = safeLocalStorageGet('auraTimer_focus_2025-01-01', 0)
    }).not.toThrow()

    expect(result).toBe(0)
  })

  test('safeLocalStorageGet mengembalikan custom defaultValue saat localStorage tidak tersedia', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })

    const result = safeLocalStorageGet('auraTimer_focus_2025-01-01', 42)
    expect(result).toBe(42)
  })

  test('getDailyStats mengembalikan {minutes:0, sessions:0} saat localStorage.getItem melempar', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('localStorage not available')
    })

    let stats
    expect(() => {
      stats = getDailyStats('2025-01-01')
    }).not.toThrow()

    expect(stats.minutes).toBe(0)
    expect(stats.sessions).toBe(0)
  })
})

// ─── Edge Case: QuotaExceededError → in-memory fallback + peringatan ──────────

describe('Analytics — QuotaExceededError → in-memory fallback + peringatan UI', () => {
  test('safeLocalStorageSet tidak melempar error saat QuotaExceededError', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      const err = new DOMException('QuotaExceededError', 'QuotaExceededError')
      // Make sure e.name is 'QuotaExceededError'
      Object.defineProperty(err, 'name', { value: 'QuotaExceededError' })
      throw err
    })

    expect(() => {
      safeLocalStorageSet('auraTimer_focus_2025-01-01', 100)
    }).not.toThrow()
  })

  test('QuotaExceededError menampilkan peringatan di DOM (storage-warning-banner) atau console.warn', () => {
    // Use isolateModules to get a fresh module instance with useInMemoryFallback = false
    // We test the side effect: DOM banner appears OR console.warn is called
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      const err = new Error('QuotaExceededError')
      err.name = 'QuotaExceededError'
      throw err
    })

    // Should not throw
    expect(() => {
      safeLocalStorageSet('auraTimer_focus_2025-01-01', 100)
    }).not.toThrow()

    // Either a DOM banner was created or console.warn was called
    const banner = document.getElementById('storage-warning-banner')
    const domWarningShown = banner !== null && banner.style.display !== 'none'
    const consoleWarningShown = warnSpy.mock.calls.length > 0

    expect(domWarningShown || consoleWarningShown).toBe(true)
  })
})

// ─── Edge Case: Kunci tidak ada → perlakukan sebagai 0 ───────────────────────

describe('Analytics — Kunci tidak ada → perlakukan sebagai 0', () => {
  test('safeLocalStorageGet mengembalikan 0 saat kunci tidak ada (null)', () => {
    // localStorage is clear, key does not exist
    const result = safeLocalStorageGet('auraTimer_focus_9999-12-31', 0)
    expect(result).toBe(0)
  })

  test('getDailyStats mengembalikan {minutes:0, sessions:0} untuk tanggal tanpa data', () => {
    // No keys set for this date
    const stats = getDailyStats('9999-12-31')
    expect(stats.minutes).toBe(0)
    expect(stats.sessions).toBe(0)
  })

  test('safeLocalStorageGet dengan defaultValue non-nol mengembalikan defaultValue saat kunci tidak ada', () => {
    const result = safeLocalStorageGet('auraTimer_nonexistent_key', 99)
    expect(result).toBe(99)
  })
})

// ─── Edge Case: Tanggal sama → tidak reset statistik ─────────────────────────

describe('Analytics — Tanggal sama → tidak reset statistik', () => {
  test('recordFocusSession dua kali pada hari yang sama mengakumulasi, bukan mereset', () => {
    const today = new Date().toISOString().slice(0, 10)

    // Record first session: 25 minutes
    recordFocusSession(25, today)
    const afterFirst = getDailyStats(today)
    expect(afterFirst.minutes).toBe(25)
    expect(afterFirst.sessions).toBe(1)

    // Record second session: 30 minutes
    recordFocusSession(30, today)
    const afterSecond = getDailyStats(today)
    expect(afterSecond.minutes).toBe(55) // 25 + 30, NOT reset to 30
    expect(afterSecond.sessions).toBe(2) // 1 + 1, NOT reset to 1
  })

  test('tiga sesi pada hari yang sama terakumulasi dengan benar', () => {
    const today = new Date().toISOString().slice(0, 10)

    recordFocusSession(10, today)
    recordFocusSession(20, today)
    recordFocusSession(15, today)

    const stats = getDailyStats(today)
    expect(stats.minutes).toBe(45)  // 10 + 20 + 15
    expect(stats.sessions).toBe(3)
  })

  test('recordFocusSession pada tanggal berbeda tidak mempengaruhi statistik hari lain', () => {
    const today = new Date().toISOString().slice(0, 10)
    const otherDate = '2000-01-01' // safely in the past

    recordFocusSession(25, today)
    recordFocusSession(50, otherDate)

    const todayStats = getDailyStats(today)
    const otherStats = getDailyStats(otherDate)

    expect(todayStats.minutes).toBe(25)
    expect(todayStats.sessions).toBe(1)
    expect(otherStats.minutes).toBe(50)
    expect(otherStats.sessions).toBe(1)
  })
})
