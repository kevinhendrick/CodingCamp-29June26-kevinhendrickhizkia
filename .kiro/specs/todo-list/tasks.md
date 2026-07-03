# Implementation Plan: To-Do List Panel

## Overview

Implementasi fitur To-Do List sebagai modul JavaScript mandiri (`todo.js`) yang terintegrasi ke dalam aplikasi AuraTimer. Modul ini menangani penambahan, pencentangan, dan penghapusan tugas dengan persistensi penuh melalui LocalStorage. Arsitektur mengikuti pola yang sudah ada: modul mandiri tanpa saling impor, komunikasi lintas modul via `CustomEvent`.

## Tasks

- [ ] 1. Implement `todo.js` — Store Layer and Core Data Functions
  - [ ] 1.1 Implementasi struktur data, ID generation, dan LocalStorage helpers
    - Definisikan interface `TodoItem` dengan field: `id` (string), `text` (string, 1–200 karakter), `completed` (boolean), `createdAt` (number, Unix ms)
    - Implementasikan variabel modul privat `let todos = []` sebagai canonical in-memory state
    - Implementasikan `generateId()`: kembalikan `Date.now().toString(36) + Math.random().toString(36).slice(2)`
    - Implementasikan `loadTodos()`: baca kunci `auraTimer_todos` dari LocalStorage, parse JSON, validasi array; kembalikan `[]` jika tidak ada atau korup, timpa kunci dengan `"[]"` jika data korup
    - Implementasikan `saveTodos(todos)`: `JSON.stringify` array dan simpan ke kunci `auraTimer_todos`; tangkap error penyimpanan — banner peringatan non-blocking dan flag `useInMemoryFallback` HANYA diaktifkan untuk `QuotaExceededError`; error lain (misalnya `SecurityError`, `InvalidStateError`) diabaikan secara senyap tanpa notifikasi ke pengguna (pola sama dengan `analytics.js`)
    - Implementasikan `getTodos()`: kembalikan snapshot `todos` saat ini (bukan referensi langsung)
    - Implementasikan `_resetStateForTest()`: reset `todos = []` dan `useInMemoryFallback = false` (hanya untuk keperluan testing)
    - Ekspor semua fungsi publik: `loadTodos`, `saveTodos`, `getTodos`, `generateId`, `_resetStateForTest`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.3_

  - [ ] 1.2 Implementasi fungsi CRUD — `addTodo`, `toggleTodo`, `deleteTodo`
    - Implementasikan `addTodo(text)`: validasi `text.trim() !== ''`, potong ke 200 karakter, buat `TodoItem` baru dengan `generateId()` dan `Date.now()`, push ke `todos`, panggil `saveTodos(todos)`, kembalikan item baru; kembalikan `null` jika teks kosong atau hanya berisi whitespace — input yang hanya mengandung karakter spesial/tanda baca tanpa huruf atau angka TETAP diterima sebagai valid
    - Implementasikan `toggleTodo(id)`: temukan item berdasarkan `id`, balik nilai `completed` (false→true ATAU true→false), panggil `saveTodos(todos)`; urutan item tidak berubah; panel merespons SEMUA klik checkbox tanpa pengecualian — klik pada item yang sudah selesai wajib mengubah `completed` kembali ke `false`
    - Implementasikan `deleteTodo(id)`: filter `todos` untuk menghapus item dengan `id` yang sesuai, panggil `saveTodos(todos)`
    - Ekspor semua fungsi: `addTodo`, `toggleTodo`, `deleteTodo`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 6.2_

- [ ] 2. Write property tests for `todo.js` Store Layer
  - [ ] 2.1 Write property test — Penambahan todo yang valid menambah panjang daftar (Property 1)
    - **Property 1: Penambahan todo yang valid menambah panjang daftar**
    - Gunakan `fc.string({ minLength: 1 }).filter(s => s.trim() !== '').map(s => s.slice(0, 200))` sebagai generator
    - Verifikasi `getTodos().length === N + 1` dan item baru berada di posisi terakhir
    - **Validates: Requirements 1.2, 1.6**

  - [ ] 2.2 Write property test — Input whitespace-only ditolak (Property 2)
    - **Property 2: Input whitespace-only ditolak**
    - Gunakan `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))` sebagai generator — generator ini hanya menghasilkan string yang terdiri SELURUHNYA dari karakter whitespace; string yang mengandung karakter non-whitespace apa pun (termasuk karakter spesial atau tanda baca saja) TIDAK termasuk dalam scope property ini dan tidak boleh masuk generator
    - Verifikasi `addTodo(text)` mengembalikan `null` dan `getTodos().length` tidak berubah
    - **Validates: Requirements 1.3**

  - [ ] 2.3 Write property test — Panjang teks todo selalu ≤ 200 karakter (Property 3)
    - **Property 3: Panjang teks todo selalu ≤ 200 karakter**
    - Gunakan `fc.string({ maxLength: 500 })` sebagai generator
    - Verifikasi `getTodos().every(t => t.text.length <= 200)` setelah `addTodo(text)`
    - **Validates: Requirements 1.4**

  - [ ] 2.4 Write property test — Persistensi round-trip (Property 4)
    - **Property 4: Persistensi round-trip — semua mutasi langsung tercermin di LocalStorage**
    - Gunakan `fc.array(fc.record({ text: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim() !== '') }), { minLength: 0, maxLength: 10 })` sebagai generator
    - Verifikasi `JSON.parse(localStorage.getItem('auraTimer_todos'))` deep-equals `getTodos()` setelah setiap operasi add/toggle/delete
    - **Validates: Requirements 1.5, 2.4, 3.3**

  - [ ] 2.5 Write property test — Deserialisasi round-trip mempertahankan semua field (Property 5)
    - **Property 5: Deserialisasi round-trip mempertahankan semua field**
    - Definisikan arbitrari `todoItemArb` dengan `fc.record({ id: fc.string({ minLength: 1 }), text: fc.string({ minLength: 1, maxLength: 200 }), completed: fc.boolean(), createdAt: fc.integer({ min: 0 }) })`
    - Gunakan `fc.array(todoItemArb, { minLength: 0, maxLength: 20 })` sebagai generator
    - Verifikasi `loadTodos()` setelah `saveTodos(items)` menghasilkan array yang identik dengan `items`
    - **Validates: Requirements 4.1, 4.2**

  - [ ] 2.6 Write property test — Data LocalStorage korup diinisialisasi ulang (Property 6)
    - **Property 6: Data LocalStorage korup diinisialisasi ulang ke array kosong**
    - Gunakan `fc.anything().filter(v => !Array.isArray(v))` dan `fc.string()` sebagai generator (nilai non-array dan string tidak valid)
    - Verifikasi `loadTodos()` mengembalikan `[]` dan kunci `auraTimer_todos` diset ke `"[]"`
    - **Validates: Requirements 4.4**

  - [ ] 2.7 Write property test — Toggle checkbox adalah operasi idempoten dua kali (Property 7)
    - **Property 7: Toggle checkbox adalah operasi round-trip (idempoten dua kali)**
    - Gunakan `fc.array(todoItemArb, { minLength: 1, maxLength: 20 })` dan `fc.integer({ min: 0 })` untuk random index sebagai generator — generator harus mencakup item dengan `completed === true` DAN `completed === false`
    - Verifikasi `toggleTodo(id); toggleTodo(id)` → `completed` identik dengan nilai awal
    - Verifikasi secara eksplisit bahwa klik pada item yang sudah selesai (`completed === true`) mengubah `completed` ke `false` (toggle tidak diabaikan)
    - **Validates: Requirements 2.2, 2.3**

  - [ ] 2.8 Write property test — Toggle tidak mengubah posisi atau field lain (Property 8)
    - **Property 8: Toggle tidak mengubah posisi atau field lain item**
    - Gunakan `fc.array(todoItemArb, { minLength: 1, maxLength: 20 })` dan random index sebagai generator
    - Verifikasi: (a) panjang daftar tetap N, (b) posisi semua item tidak berubah, (c) hanya field `completed` pada item target yang berubah
    - **Validates: Requirements 2.5**

  - [ ] 2.9 Write property test — Hapus item berdasarkan id mengurangi daftar tepat satu (Property 9)
    - **Property 9: Hapus item berdasarkan id mengurangi daftar tepat satu**
    - Gunakan `fc.array(todoItemArb, { minLength: 1, maxLength: 20 })` dan random index sebagai generator
    - Verifikasi daftar berisi tepat N−1 item, id target tidak ada, urutan item sisa terjaga
    - **Validates: Requirements 3.2, 3.3**

  - [ ] 2.10 Write property test — Semua id yang dihasilkan bersifat unik (Property 10)
    - **Property 10: Semua id yang dihasilkan bersifat unik**
    - Gunakan `fc.integer({ min: 1, max: 100 })` sebagai generator untuk jumlah pemanggilan `generateId()`
    - Verifikasi `new Set(ids).size === N` untuk setiap N pemanggilan
    - **Validates: Requirements 6.1, 6.3**

- [ ] 3. Checkpoint — Store layer complete
  - Pastikan semua property test Store Layer (Property 1–10) lulus. Tanyakan kepada pengguna jika ada pertanyaan.

- [ ] 4. Implement `todo.js` — DOM Rendering and UI
  - [ ] 4.1 Implementasi fungsi rendering DOM privat
    - Implementasikan fungsi privat `renderTodos()`: kosongkan `#todo-list`, render setiap `TodoItem` sebagai `<li class="todo-item" data-id="{id}">` berisi `<input type="checkbox" id="todo-check-{id}" class="todo-checkbox" aria-label="Tandai selesai: {text}">`, `<label for="todo-check-{id}" class="todo-text">{text}</label>`, dan `<button type="button" class="todo-delete-btn" aria-label="Hapus tugas: {text}">×</button>`
    - Tambahkan class `completed` pada `<li>` saat `completed === true` (untuk CSS strikethrough)
    - Set atribut `checked` pada checkbox sesuai `completed` pada setiap item
    - Tampilkan/sembunyikan elemen `#todo-empty` SEGERA ketika `todos.length === 0` — tanpa menunggu animasi atau transisi UI selesai — untuk semua penyebab daftar menjadi kosong (hapus item, korupsi data, storage clearing, dll.)
    - _Requirements: 1.6, 2.2, 2.3, 3.4, 5.1_

  - [ ] 4.2 Implementasi fungsi `updateCounter(status)` privat
    - Implementasikan fungsi privat `updateCounter(status)`: hitung jumlah item dengan `completed === false`, set `#todo-counter-value` ke jumlah tersebut
    - Tampilkan `#todo-counter` (hapus atribut `hidden`) HANYA saat `status === 'running'`; untuk SEMUA status lain (idle, paused, stopped, atau nilai non-running apa pun), set atribut `hidden` pada `#todo-counter`
    - _Requirements: 5.2_

  - [ ] 4.3 Implementasi `initTodos()` dan event listeners
    - Implementasikan `initTodos()` yang diekspor: panggil `loadTodos()` → simpan ke variabel `todos` → panggil `renderTodos()`; jika `renderTodos()` melempar error setelah data berhasil dimuat, blokir seluruh interaksi pengguna hingga rendering berhasil (UI boleh tampak frozen — kondisi ini lebih disukai daripada membiarkan interaksi dengan state UI yang tidak konsisten)
    - Daftarkan listener click pada `#todo-add-btn`: baca nilai `#todo-input`, panggil `addTodo(text)`, jika berhasil kosongkan `#todo-input` dan panggil `renderTodos()`
    - Daftarkan listener `keydown` pada `#todo-input`: tangkap Enter (event.key === 'Enter'), jalankan logika yang sama dengan tombol "Tambah"
    - Daftarkan listener click dengan event delegation pada `#todo-list`: jika target memiliki class `todo-checkbox`, panggil `toggleTodo(id)` dan `renderTodos()`; jika target memiliki class `todo-delete-btn`, panggil `deleteTodo(id)` dan `renderTodos()`
    - Daftarkan listener `timerStateChange` pada `document`: panggil `updateCounter(event.detail.status)`
    - Ekspor `initTodos`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2, 4.1, 5.2, 5.5, 5.6_

- [ ] 5. Write unit tests for `todo.js`
  - [ ] 5.1 Write unit tests for DOM rendering and interaction
    - Test: `#todo-input`, tombol `#todo-add-btn`, dan `#todo-list` ada di DOM setelah `initTodos()`
    - Test: input valid + klik tombol "Tambah" → item baru muncul di `#todo-list` dan `#todo-input` dikosongkan
    - Test: input valid + tekan Enter → item baru muncul di `#todo-list` dan `#todo-input` dikosongkan
    - Test: input kosong (empty string) → tidak ada item baru ditambahkan ke DOM
    - Test: input whitespace-only → tidak ada item baru ditambahkan ke DOM
    - Test: input yang hanya berisi karakter spesial (misalnya `"!!!"`, `"---"`) → DITERIMA sebagai valid, item baru muncul di DOM
    - Test: pesan `#todo-empty` tampil saat list kosong; hilang saat ada item
    - Test: pesan `#todo-empty` tampil SEGERA ketika jumlah item mencapai nol (tanpa menunggu animasi)
    - Test: klik checkbox pada item belum selesai → label mendapat class atau style strikethrough, checkbox `checked`
    - Test: klik checkbox pada item sudah selesai → strikethrough hilang, checkbox tidak `checked` (toggle kembali ke uncompleted)
    - Test: klik tombol hapus → item dihapus dari DOM secara langsung
    - Test: LocalStorage key yang tidak ada → `initTodos()` inisialisasi array kosong tanpa error
    - Test: data korup di LocalStorage → `initTodos()` reset ke array kosong, tidak ada error
    - Test: `QuotaExceededError` saat `saveTodos()` → operasi tetap berjalan in-memory, banner peringatan tampil
    - Test: error penyimpanan selain `QuotaExceededError` → banner peringatan TIDAK tampil, error diabaikan secara senyap
    - Test: semua kunci LocalStorage yang ditulis oleh `todo.js` berawalan `auraTimer_`
    - Test: event `focusSessionComplete` tidak memodifikasi `todos` (tugas tidak terhapus, tidak ditandai selesai)
    - Test: `#todo-counter` memiliki atribut `hidden` saat timer berstatus `idle`, `paused`, atau `stopped`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 3.1, 3.2, 3.4, 4.1, 4.3, 4.4, 4.6, 5.1, 5.6_

- [ ] 6. Write property test for counter accuracy (Property 11)
  - [ ] 6.1 Write property test — Counter menampilkan jumlah item belum selesai yang benar (Property 11)
    - **Property 11: Counter hanya terlihat saat timer `running` dan menampilkan jumlah yang benar**
    - Definisikan arbitrari `todoItemArb` dan gunakan `fc.array(todoItemArb, { minLength: 0, maxLength: 20 })` dikombinasikan dengan `fc.constantFrom('running', 'idle', 'paused', 'stopped')` sebagai generator
    - Set `todos` dengan array tersebut, dispatch `timerStateChange` dengan `detail: { status }` yang sesuai
    - Verifikasi saat `status === 'running'`: `#todo-counter` tidak memiliki atribut `hidden` dan teks `#todo-counter-value` sama persis dengan `filter(t => !t.completed).length`
    - Verifikasi saat `status` adalah `idle`, `paused`, atau `stopped`: `#todo-counter` memiliki atribut `hidden` (counter tidak terlihat)
    - **Validates: Requirements 5.2**

- [ ] 7. Checkpoint — todo.js module complete
  - Pastikan semua unit test dan property test `todo.js` (Property 1–11) lulus. Tanyakan kepada pengguna jika ada pertanyaan.

- [ ] 8. Update `index.html` — Tambahkan Todo Panel Section
  - [ ] 8.1 Implementasi markup HTML untuk Todo_Panel
    - Tambahkan `<section id="todo-section" aria-labelledby="todo-heading">` ke `index.html` sebagai section baru setelah `#analytics-section`
    - Tambahkan `<h2 id="todo-heading">To-Do List</h2>` sebagai heading identifiable
    - Tambahkan `<div id="todo-counter" aria-live="polite" aria-atomic="true" hidden><span id="todo-counter-value">0</span> tugas tersisa</div>` (tersembunyi saat timer tidak running)
    - Tambahkan wrapper input: `<div id="todo-input-wrapper">` dengan `<label for="todo-input" class="visually-hidden">Tambah tugas baru</label>`, `<input type="text" id="todo-input" maxlength="200" placeholder="Tulis tugas baru..." autocomplete="off" aria-label="Tulis tugas baru" />`, dan `<button type="button" id="todo-add-btn" aria-label="Tambah tugas">Tambah</button>`
    - Tambahkan `<ul id="todo-list" aria-label="Daftar tugas" role="list"></ul>` untuk daftar tugas
    - Tambahkan `<p id="todo-empty" aria-live="polite">Belum ada tugas. Tambahkan tugas pertamamu!</p>` sebagai empty state
    - _Requirements: 1.1, 3.4, 5.1, 5.3, 5.4_

- [ ] 9. Update `style.css` — Styling Todo Panel
  - [ ] 9.1 Implementasi styling dasar Todo_Panel
    - Tambahkan styling untuk `#todo-section`: konsisten dengan section lain (`#soundscape-section`, `#analytics-section`)
    - Styling `#todo-input-wrapper`: layout flexbox horizontal, gap antar input dan tombol
    - Styling `#todo-input`: lebar penuh (flex: 1), border, padding, border-radius konsisten
    - Styling `#todo-add-btn`: konsisten dengan tombol lain di aplikasi
    - Styling `li.todo-item`: layout flexbox, gap antara checkbox, label, dan tombol hapus
    - Styling `.todo-text.completed` atau `li.todo-item.completed .todo-text`: `text-decoration: line-through`, warna muted
    - Styling `.todo-delete-btn`: tombol hapus kecil, konsisten dengan desain
    - Styling `#todo-counter`: teks ringkasan tugas tersisa, tersembunyi dengan `[hidden]`
    - Styling `#todo-empty`: teks placeholder saat daftar kosong, style muted/italic
    - _Requirements: 2.2, 3.4, 5.1_

  - [ ] 9.2 Implementasi CSS responsif untuk Todo_Panel
    - Pastikan `#todo-section` tidak menyebabkan horizontal scroll pada viewport 320px–1440px
    - Pada viewport <768px: pastikan `#todo-add-btn` dan `.todo-delete-btn` memiliki area sentuh minimal 44×44px (gunakan `min-height: 44px; min-width: 44px` atau `padding` yang cukup)
    - Pastikan `#todo-input` tidak melampaui lebar viewport pada layar kecil (gunakan `box-sizing: border-box` dan `max-width: 100%`)
    - _Requirements: 5.3, 5.4_

- [ ] 10. Update `app.js` — Integrasi Todo Module
  - [ ] 10.1 Implementasi inisialisasi dan event routing untuk todo.js
    - Tambahkan `import { initTodos } from './todo.js'` di bagian atas `app.js`
    - Panggil `initTodos()` di dalam `DOMContentLoaded` listener (setelah `initAnalytics()`)
    - Pasang listener pada `timerTick` dan `timerPhaseChange` untuk men-dispatch `timerStateChange` CustomEvent ke `document` dengan `detail: { status }` yang sesuai — ini memungkinkan `todo.js` menampilkan counter saat timer running
    - Pastikan `focusSessionComplete` yang sudah ada tidak memodifikasi state todo (requirement 5.6 sudah terpenuhi by design karena `todo.js` tidak mendengarkan event ini)
    - _Requirements: 5.2, 5.5, 5.6_

- [ ] 11. Write integration tests for todo-list feature
  - [ ] 11.1 Write integration tests untuk alur lengkap todo-list
    - Test: alur tambah → centang → hapus → reload → verifikasi persistensi data di LocalStorage
    - Test: dispatch `timerStateChange` dengan `status: 'running'` dari `document` → `#todo-counter` tampil dengan nilai yang benar
    - Test: dispatch `timerStateChange` dengan `status: 'idle'` → `#todo-counter` tersembunyi
    - Test: dispatch `focusSessionComplete` → todos tidak berubah (tidak terhapus, tidak ditandai selesai)
    - Test: urutan operasi add → toggle → toggle → delete → verifikasi state konsisten dengan LocalStorage
    - _Requirements: 2.5, 3.2, 3.3, 4.1, 5.2, 5.6_

- [ ] 12. Final checkpoint — Todo-list feature complete
  - Pastikan semua test (unit, property, integration) untuk todo-list lulus. Verifikasi `#todo-section` tidak menyebabkan horizontal scroll di viewport 320px. Verifikasi counter muncul dan akurat saat timer berjalan. Tanyakan kepada pengguna jika ada pertanyaan.

## Notes

- Semua kunci LocalStorage HARUS menggunakan prefix `auraTimer_` — khusus untuk todo menggunakan kunci `auraTimer_todos`
- `todo.js` tidak boleh mengimpor dari `timer.js`, `soundscape.js`, atau `analytics.js` — komunikasi hanya melalui CustomEvent
- `app.js` bertanggung jawab menjadi jembatan antara event timer dan `todo.js` via `timerStateChange`
- Property tests menggunakan `fast-check` dengan minimum 100 iterasi (`{ numRuns: 100 }`)
- Setiap property test diberi komentar tag: `// Feature: todo-list, Property N: <deskripsi>`
- Jalankan test dengan: `npx vitest --run`
- Event `focusSessionComplete` TIDAK boleh memodifikasi todos (requirement 5.6)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10"] },
    { "id": 3, "tasks": ["3"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3"] },
    { "id": 6, "tasks": ["5.1", "6.1"] },
    { "id": 7, "tasks": ["7"] },
    { "id": 8, "tasks": ["8.1", "9.1"] },
    { "id": 9, "tasks": ["9.2", "10.1"] },
    { "id": 10, "tasks": ["11.1"] },
    { "id": 11, "tasks": ["12"] }
  ]
}
```
