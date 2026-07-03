/**
 * analytics.property.test.js — Property-Based Tests untuk analytics.js
 *
 * Validates: Requirements 4.3, 4.4, 4.5, 4.6, 5.6, 6.1, 6.2, 6.4, 6.5
 */

import * as fc from 'fast-check'
import {
  recordFocusSession,
  getDailyStats,
  initAnalytics,
  safeLocalStorageGet,
  safeLocalStorageSet,
  _resetInternalStateForTest,
} from '../../analytics.js'

// ─── Reset LocalStorage antara setiap test ────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  _resetInternalStateForTest()
})

// ─── Property 9: Pencatatan Sesi Mengakumulasi Menit dan Sesi Secara Tepat ────
// Validates: Requirements 4.3, 4.4, 6.1

describe('Property 9: Pencatatan Sesi Mengakumulasi Menit dan Sesi Secara Tepat', () => {
  test(
    'recordFocusSession mengakumulasi menit dan sesi dengan benar di LocalStorage',
    () => {
      const today = new Date().toISOString().slice(0, 10)

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // initial minutes
          fc.integer({ min: 0, max: 1000 }),   // initial sessions
          fc.integer({ min: 1, max: 60 }),      // duration to record
          (m, s, d) => {
            // Set up initial state in localStorage
            const minutesKey = `auraTimer_focus_${today}`
            const sessionsKey = `auraTimer_sessions_${today}`
            localStorage.setItem(minutesKey, String(m))
            localStorage.setItem(sessionsKey, String(s))

            // Record a session
            recordFocusSession(d, today)

            // Verify accumulation via getDailyStats
            const stats = getDailyStats(today)
            expect(stats.minutes).toBe(m + d)
            expect(stats.sessions).toBe(s + 1)

            // Verify LocalStorage keys directly
            const storedMinutes = Number(localStorage.getItem(minutesKey))
            const storedSessions = Number(localStorage.getItem(sessionsKey))
            expect(storedMinutes).toBe(m + d)
            expect(storedSessions).toBe(s + 1)

            // Cleanup for next iteration
            localStorage.clear()
          }
        ),
        { numRuns: 100 }
      )
    }
  )
})

// ─── Property 10: Inisialisasi Membaca Data LocalStorage dengan Benar ─────────
// Validates: Requirements 4.6, 6.2

describe('Property 10: Inisialisasi Membaca Data LocalStorage dengan Benar', () => {
  test(
    /**
     * **Validates: Requirements 4.6, 6.2**
     *
     * For any integer m in [0, 500] stored in LocalStorage under
     * `auraTimer_focus_[today]`, after calling `initAnalytics()`,
     * `getDailyStats(today).minutes` must equal exactly `m`.
     * Pre-existing data must be read and surfaced without modification.
     */
    'initAnalytics() membaca nilai yang sudah tersimpan di LocalStorage dengan tepat',
    () => {
      const today = new Date().toISOString().slice(0, 10)

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 500 }),
          (m) => {
            // Arrange: reset module state and pre-seed localStorage
            localStorage.clear()
            _resetInternalStateForTest()

            const minutesKey = `auraTimer_focus_${today}`
            // Set today as the last date so initAnalytics() does NOT reset stats
            localStorage.setItem('auraTimer_lastDate', today)
            localStorage.setItem(minutesKey, String(m))

            // Act: initAnalytics() must read the stored value
            // (renderDailyStats / renderWeeklyChart are no-ops in happy-dom
            //  because no DOM elements are present — that is fine)
            initAnalytics()

            // Assert: getDailyStats must return the original stored value
            const stats = getDailyStats(today)
            expect(stats.minutes).toBe(m)

            // Cleanup for next iteration
            localStorage.clear()
            _resetInternalStateForTest()
          }
        ),
        { numRuns: 100 }
      )
    }
  )
})

// ─── Property 11: Reset Harian Saat Tanggal Berbeda ───────────────────────────
// Validates: Requirements 4.5

describe('Property 11: Reset Harian Saat Tanggal Berbeda', () => {
  test(
    'initAnalytics() menghasilkan statistik hari ini = 0 ketika auraTimer_lastDate berbeda dari hari ini',
    () => {
      // Compute today string using local date (same logic as analytics.js)
      const todayObj = new Date()
      const ty = todayObj.getFullYear()
      const tm = String(todayObj.getMonth() + 1).padStart(2, '0')
      const td = String(todayObj.getDate()).padStart(2, '0')
      const today = `${ty}-${tm}-${td}`

      fc.assert(
        fc.property(
          // Generate a date that is NOT today; use fc.date() filtered to exclude today
          fc.date().filter((d) => {
            const y = d.getFullYear()
            const mo = String(d.getMonth() + 1).padStart(2, '0')
            const dd = String(d.getDate()).padStart(2, '0')
            return `${y}-${mo}-${dd}` !== today
          }),
          (d1) => {
            // Format d1 as YYYY-MM-DD local date string (same approach as analytics.js)
            const y = d1.getFullYear()
            const mo = String(d1.getMonth() + 1).padStart(2, '0')
            const dd = String(d1.getDate()).padStart(2, '0')
            const d1Str = `${y}-${mo}-${dd}`

            // Simulate the app was last opened on d1
            localStorage.setItem('auraTimer_lastDate', d1Str)

            // Optionally store some stale data for d1 to confirm it doesn't bleed into today
            localStorage.setItem(`auraTimer_focus_${d1Str}`, '90')
            localStorage.setItem(`auraTimer_sessions_${d1Str}`, '3')

            // Make sure today's keys are NOT pre-set (simulating fresh day)
            localStorage.removeItem(`auraTimer_focus_${today}`)
            localStorage.removeItem(`auraTimer_sessions_${today}`)

            // Call initAnalytics — it detects lastDate ≠ today, updates lastDate to today
            initAnalytics()

            // getDailyStats for today must be 0 (no data recorded yet for today)
            const stats = getDailyStats(today)
            expect(stats.minutes).toBe(0)
            expect(stats.sessions).toBe(0)

            // Cleanup for next iteration
            localStorage.clear()
            _resetInternalStateForTest()
          }
        ),
        { numRuns: 100 }
      )
    }
  )
})

// ─── Property 12: Data Korup di LocalStorage Memicu Reinisialisasi ke Nol ─────
// Validates: Requirements 6.4

describe('Property 12: Data Korup di LocalStorage Memicu Reinisialisasi ke Nol', () => {
  test(
    'getDailyStats mengembalikan 0 dan menulis ulang kunci saat data korup',
    () => {
      const today = new Date().toISOString().slice(0, 10)

      fc.assert(
        fc.property(
          // Generate strings that are NOT valid numbers
          fc.string().filter((s) => {
            const trimmed = s.trim()
            if (trimmed === '') return false // empty string parses as 0 in Number()
            return isNaN(Number(trimmed))
          }),
          (corruptValue) => {
            const minutesKey = `auraTimer_focus_${today}`

            // Store corrupt data
            localStorage.setItem(minutesKey, corruptValue)

            // getDailyStats should not throw and return 0
            let stats
            expect(() => {
              stats = getDailyStats(today)
            }).not.toThrow()

            expect(stats.minutes).toBe(0)

            // The key should be re-set to "0" in localStorage
            expect(localStorage.getItem(minutesKey)).toBe('0')

            // Cleanup for next iteration
            localStorage.clear()
          }
        ),
        { numRuns: 100 }
      )
    }
  )
})

// ─── Property 13: Semua Kunci LocalStorage Menggunakan Format yang Benar ──────
// Validates: Requirements 5.6, 6.5

describe('Property 13: Semua Kunci LocalStorage Menggunakan Format yang Benar', () => {
  test(
    'recordFocusSession hanya menulis kunci dengan prefix auraTimer_ dan format tanggal YYYY-MM-DD',
    () => {
      fc.assert(
        fc.property(
          // Constrain to years 1000–9999 so toISOString() produces a 4-digit year
          fc.date({ min: new Date('1000-01-01'), max: new Date('9999-12-31') }),
          (date) => {
            localStorage.clear()
            const dateStr = date.toISOString().slice(0, 10)

            // Spy on localStorage.setItem to capture written keys
            const writtenKeys = []
            const originalSetItem = localStorage.setItem.bind(localStorage)
            const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(
              (key, value) => {
                writtenKeys.push(key)
                originalSetItem(key, value)
              }
            )

            recordFocusSession(25, dateStr)

            // Restore spy
            spy.mockRestore()

            // All written keys must start with 'auraTimer_'
            for (const key of writtenKeys) {
              expect(key).toMatch(/^auraTimer_/)
            }

            // Daily data keys must match the exact patterns
            const datePattern = /^\d{4}-\d{2}-\d{2}$/
            for (const key of writtenKeys) {
              if (key.startsWith('auraTimer_focus_')) {
                const datePart = key.replace('auraTimer_focus_', '')
                expect(datePart).toMatch(datePattern)
                expect(datePart).toBe(dateStr)
              } else if (key.startsWith('auraTimer_sessions_')) {
                const datePart = key.replace('auraTimer_sessions_', '')
                expect(datePart).toMatch(datePattern)
                expect(datePart).toBe(dateStr)
              }
              // auraTimer_lastDate is also allowed but not written by recordFocusSession
            }

            // Cleanup
            localStorage.clear()
          }
        ),
        { numRuns: 100 }
      )
    }
  )
})

// ─── Property 15: Label Hari Indonesia Akurat untuk Semua Hari dalam Seminggu ─
// Validates: Requirements 5.4

/**
 * **Validates: Requirements 5.4**
 *
 * For any valid Date, getDayLabel(date) must return exactly one of
 * {'Sen','Sel','Rab','Kam','Jum','Sab','Min'} that correctly maps to
 * the day-of-week index returned by date.getDay().
 * Additionally, 7 different days (one per day-of-week index) must map
 * to 7 distinct labels — ensuring the mapping is both correct and unique.
 */
import { getDayLabel } from '../../analytics.js'

describe('Property 15: Label Hari Indonesia Akurat untuk Semua Hari dalam Seminggu', () => {
  const VALID_LABELS = new Set(['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'])

  // Expected mapping: getDay() index → Indonesian label
  const EXPECTED_MAPPING = {
    0: 'Min', // Minggu (Sunday)
    1: 'Sen', // Senin (Monday)
    2: 'Sel', // Selasa (Tuesday)
    3: 'Rab', // Rabu (Wednesday)
    4: 'Kam', // Kamis (Thursday)
    5: 'Jum', // Jumat (Friday)
    6: 'Sab', // Sabtu (Saturday)
  }

  test(
    'getDayLabel mengembalikan tepat satu label valid dari himpunan hari Indonesia',
    () => {
      fc.assert(
        fc.property(
          fc.date(),
          (date) => {
            const label = getDayLabel(date)

            // Label harus berada dalam himpunan label yang valid
            expect(VALID_LABELS.has(label)).toBe(true)

            // Label harus sesuai dengan indeks hari yang benar
            const dayIndex = date.getDay()
            expect(label).toBe(EXPECTED_MAPPING[dayIndex])
          }
        ),
        { numRuns: 100 }
      )
    }
  )

  test(
    'Mapping unik: 7 hari berbeda menghasilkan 7 label berbeda (bijeksi lengkap)',
    () => {
      // Build a representative Date for each day-of-week index (0–6)
      // Use a known Sunday (epoch: 1970-01-04 was a Sunday) as anchor
      const sunday = new Date('1970-01-04T12:00:00.000Z')

      const labels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sunday)
        d.setDate(sunday.getDate() + i) // Sunday=0, Monday=1, ..., Saturday=6
        return getDayLabel(d)
      })

      // All 7 labels must be distinct
      const uniqueLabels = new Set(labels)
      expect(uniqueLabels.size).toBe(7)

      // The set of labels must equal exactly the valid label set
      for (const label of VALID_LABELS) {
        expect(uniqueLabels.has(label)).toBe(true)
      }
    }
  )
})

// ─── Property 14: Tinggi Batang Chart Proporsional terhadap Nilai Maksimum ────
// Validates: Requirements 5.1, 5.5, 5.7

import { renderWeeklyChart } from '../../analytics.js'

/**
 * Build an ISO-style YYYY-MM-DD string for a date that is `offsetDays`
 * relative to today (negative = past).
 *
 * Uses the same local-date arithmetic as analytics.js so that the keys
 * produced here match those used by getWeeklyData() / getDailyStats().
 */
function localDateStr(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

describe('Property 14: Tinggi Batang Chart Proporsional terhadap Nilai Maksimum', () => {
  /**
   * **Validates: Requirements 5.1, 5.5, 5.7**
   *
   * For any array of 7 non-negative integer minute values [v0..v6]:
   * (a) The bar whose value equals max(values) must have height === CHART_HEIGHT (80px).
   * (b) Every other bar must have height === Math.max(Math.round((vi / max) * 80), 4).
   * (c) A bar with value 0 must have height === 4px (minimum).
   * (d) If ALL values are 0, every bar still has height === 4px.
   * (e) The #weekly-chart element must contain exactly 7 column <div>s.
   */
  test(
    'batang proporsional terhadap nilai maks, batang 0 = 4px minimum, selalu 7 batang',
    () => {
      const CHART_HEIGHT = 80

      // Ensure the #weekly-chart mount point exists in DOM
      let chartEl = document.getElementById('weekly-chart')
      if (!chartEl) {
        chartEl = document.createElement('div')
        chartEl.id = 'weekly-chart'
        document.body.appendChild(chartEl)
      }

      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 7, maxLength: 7 }),
          (values) => {
            // ── Arrange: seed localStorage for D-6..D+0 with the generated values ──
            localStorage.clear()
            _resetInternalStateForTest()

            for (let i = 0; i < 7; i++) {
              // getWeeklyData() iterates i=0 (D-6) .. i=6 (D+0)
              const dateStr = localDateStr(i - 6)
              localStorage.setItem(`auraTimer_focus_${dateStr}`, String(values[i]))
            }

            // ── Act ──────────────────────────────────────────────────────────────
            renderWeeklyChart()

            // ── Assert: exactly 7 column divs ────────────────────────────────────
            const columns = chartEl.children
            expect(columns.length).toBe(7)

            // ── Assert: bar heights ───────────────────────────────────────────────
            const maxMinutes = Math.max(...values, 1) // mirrors analytics.js logic

            for (let i = 0; i < 7; i++) {
              const col = columns[i]
              // The bar is the first child <div> inside each column
              const bar = col.children[0]
              expect(bar).toBeTruthy()

              const heightPx = parseInt(bar.style.height, 10)

              if (values[i] === 0) {
                // Req 5.7: zero-value bar must use 4px minimum
                expect(heightPx).toBe(4)
              } else {
                // Req 5.5: proportional height
                const expected = Math.max(
                  Math.round((values[i] / maxMinutes) * CHART_HEIGHT),
                  4
                )
                expect(heightPx).toBe(expected)
              }
            }

            // ── Assert: the tallest bar reaches CHART_HEIGHT ──────────────────────
            const realMax = Math.max(...values)
            if (realMax > 0) {
              // At least one bar must equal CHART_HEIGHT (80px)
              const barHeights = Array.from(columns).map((col) =>
                parseInt(col.children[0].style.height, 10)
              )
              expect(Math.max(...barHeights)).toBe(CHART_HEIGHT)
            }

            // Cleanup for next iteration
            localStorage.clear()
            _resetInternalStateForTest()
          }
        ),
        { numRuns: 200 }
      )
    }
  )
})
