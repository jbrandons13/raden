# Product Requirements Document (PRD) & Architecture: RADEN ERP

## 1. Ikhtisar Proyek (Project Overview)
**Sistem Operasional & Produksi "RADEN" (ERP)**
RADEN adalah bisnis manufaktur/produk makanan (*Food & Beverage*) dengan tenaga kerja *part-time* sebanyak 15-20 orang. Sistem ini khusus dirancang untuk menangani kendala-kendala operasional meliputi:
- **Tantangan Mutasi *Yield* & *Wastage***: Produksi dapur memiliki hasil yang tidak dapat diprediksi (1 *batch* adonan memiliki *output* akhir yang bervariasi). Sistem memerlukan integrasi data "Estimasi Produksi" dan kewajiban pelaporan "Hasil Aktual" dari setiap tugas untuk menjaga sinkronisasi stok secara absolut.
- **Manajemen Staf *Part-Time***: Asumsi bahwa kehadiran penuh, namun Admin memerlukan kemudahan instruksi harian melalui fitur "Notes / Catatan" di setiap penyerahan jadwal.
- **Integrasi Fisik (Kertas/Dapur)**: Mengingat aktivitas di dalam lingkungan dapur basah dan alur kerja manual, cetakan *Print-Out* PDF mutlak dibutuhkan untuk pesanan (*orders*), jadwal (*schedules*), dan manifes operasional rekapitulasi toko ("All Toko").
- **Kendala Bahasa**: 100% *User Interface* (UI), *alerts*, peringatan, navigasi, dan tombol **WAJIB** disajikan dalam Bahasa Indonesia.

## 2. Peran & Persona Pengguna (Roles & Personas)
1. **Admin (Web / Desktop Optimized):** 
   - Bertanggung jawab memonitor lalu lintas pesanan, memantau pergerakan stok, menugaskan pekerjaan harian, dan mengecek performa bisnis secara vertikal. 
   - Membutuhkan visibilitas padat (*information-dense*), form kompleks, dan tampilan layar desktop yang luas.
2. **Staff (PWA / Mobile-First UI):**
   - Bertugas di lapangan/dapur mengeksekusi instruksi Admin, melengkapi *checklist*, hingga pemutakhiran pengecekan stok (Stok Opname).
   - Membutuhkan sistem yang intuitif, minim ketikan, ukuran tombol besar (*touch-friendly*), dan alur yang terpusat pada "*To-Do List*".

## 3. Batasan Teknis & Tech Stack (Standard 2026)
Sebagai platform berkinerja tinggi, sistem akan dikembangkan dengan fondasi modern:
- **Frontend & PWA**: React / Next.js. Wajib memiliki fitur *Progressive Web App* (PWA) yang dapat diunduh seperti aplikasi asli pada *mobile* atau tablet kasir.
- **Database Backend**: Supabase (PostgreSQL). Fokus pada sinkronisasi *Real-Time DB* antar perangkat (Contoh: Notifikasi penyesuaian stok baru tanpa harus *refresh* halaman).
- **PDF Generation**: `@react-pdf/renderer` untuk eksekusi generator dokumen cetak (Bon, Jadwal, Rekap) yang kuat, stabil, presisi tanpa batasan *layout browser* standar.

---

## 4. Rincian Antarmuka & Modul (Admin Pages)
Akses untuk *Admin* dirancang secara fungsional melalui Desktop PC / Tablet Landscape.

### 4.1. Dashboard
- **Widget Ringkasan Harian:** Metrik total pesanan, jumlah aktivitas dikerjakan, dan omzet atau rincian hasil khusus harian.
- **Widget Pesanan Aktif (*Active Orders*):** Menampilkan pesanan pada antrean untuk disiapkan.
- **Widget Peringatan Stok (*Low Stock Reminder*):** Pengingat visual batas kritis dari bahan baku atau stok mati.

### 4.2. Pesanan (Orders)
- **Daftar Pesanan (*List Orders*):** Memantau pesanan yang terjadwal.
- **Tambah Pesanan (*Add Orders Pop-up*):**
  - Kotak Input *Nama Pelanggan* melekat di bagian atas.
  - Daftar SEMUA produk tertampil langsung, *berdampingan* dengan sisa Stok Real-Time, diikuti *field* pengisian QTY pesanan.
- **Alur Pengiriman (*Dispatch Flow*):**
  - Mengklik tombol "**Dispatch**" akan menerbitkan *Preview Print Bon*.
  - Selesai ditinjau, status bergeser mutlak menjadi **"Siap Kirim/Ambil"**.
  - Pesanan berpindah ke log 'Riwayat Pesanan' (dapat diklik kembali untuk detail maupun *edit*).

### 4.3. Pelanggan (Customers)
- **Direktori Database:** Daftar orang maupun toko pelanggan.
- **Metrik Analitik:** Total pendapatan (*revenue*) dari pelanggan tersebut, frekuensi / total pesanan per pelanggan.
- **Cetak Dokumen:** Tombol "**Print Out**" daftar alamat dan kontak pelanggan.

### 4.4. Estimasi Produksi
- **Master Data:** Menentukan rasio konversi/asumsi bahan produksi (*Target Yields*).
- *Contoh: 1 (satu) resep/batch ukuran Adonan Lapis menghasilkan ± 40 potong.*

### 4.5. Stok Produk (Barang Jadi)
- **Tampilan Utama:** Daftar SEMUA produk terpampang secara vertikal (Dilarang menggunakan *dropdown* navigasi produk).
- **Fungsi Khusus:** Tambah Produk Baru, Penyesuaian stok manual / *Manual Adjustment*.
- **Konfirmasi Keamanan:** Setiap penyesuaian wajib dilalui oleh *Double-Confirmation Pop-Up* untuk meminimalisasi salah ketik.
- **Tinjauan Mutasi:** *Stock change logs* (*Log* jejak histori perubahan barang keluar masuk).
- **Cetak Dokumen:** Tombol "**Print Out**" rekap ketersediaan inventaris ujung gawang barang jadi.

### 4.6. Semua Stok (Bahan Baku / Raw Materials)
- **Manajemen Inventaris Kasar:** Penambahan/pengurangan material dengan besaran Qty nyata. Sistem *tracking* stok manual dasar.
- **Organisasi Fleksibel:** Admin dapat menambah *Tab* baru untuk klasifikasi ragam kategori tambahan (Contoh: Daging, Sayur, Tepung, dsb.).
- **Catatan Belanja:** Kolom "**Notes**" berisikan rekomendasi nilai pengadaan / *purchasing* mingguan.
- Menampilkan riwayat cek stok silang / Opname dari laporan Staff.

### 4.7. Jadwal Harian
- **Saran Algoritmik:** Mengadopsi *Low stock banner recommendation* agar Admin terpicu membuat perintah produksi prioritas mengacu pada stok yang habis.
- **Form Penugasan:** Memuat antarmuka seluruh daftar Produk, kolom Input **Qty**, barisan *Dropdown* pelaksana tugas (Staf yang bertugas), dan kotak **"Notes"** (Wajib hadir untuk instruksi panduan spesifik).
- **Cetak Dokumen:** Tombol "**Print Out**" mencetak rekap jadwal operasional lapangan untuk direkatkan secara fisik konvensional.

### 4.8. Staff & Jadwal Kerja
- **Informasi Direktori:** Tambah/Hapus karyawan (Nama, Jabatan).
- **Kalender Interaktif:** Format Matriks/Grid. (Baris = Nama Staff, Kolom = Hari / Tanggal).
- **Kode Jadwal Shift Kustom:**
  - *EM:* (05.00 - 13.00)
  - *EMS:* (05.00 - 10.00)
  - *M:* (08.00 - 16.00)
  - *A:* (13.00 - 21.00)
  - *AS:* (15.00 - 20.00)
- **Cetak Dokumen:** Tombol "**Print Out**" lembar rekap absensi / jadwal penugasan harian.

### 4.9. Daftar Checklist
- **Ruang Lingkup 3 Bagian:** *Pastry*, *General*, *Kitchen*.
- **Kendali Sistem:** Admin dapat menambah kustom tugas baru kapan pun (Contoh: "Kuras Box Es", "Deep Clean Oven").
- **Validasi Unggahan Foto:** Keabsahan hasil tugas dapat disematkan label "*Mandatory*" untuk mengunggah foto laporan langsung via HP Staff.
- **Rekam Jejak:** Log *Daily History* (Riwayat Harian) atas hasil verifikasi fasilitas yang diselesaikan hari tersebut.

### 4.10. Order Harian
- **Pemetaan Visual:** Menampilkan kumpulan Box berisi Kalender/Tanggal Order.
- **Sistem Modals / Pop-Up:** Mengklik box tanggal order akan membuka jendela *Table* integratif berisikan dua tampilan utama:
  - **Tabel ALL TOKO:** Kumpulan omzet merujuk agregat per-produk keseluruhan yang harus disiapkan. (Contoh: Total produk Nastar untuk hari ini wajib berjumlah 150 kotak).
  - **Tabel PEMECAHAN ORDER:** Rincian detail produk memecah distribusi total tadi menjadi rute spesifik alamat/customer. (Contoh: "Nastar -> Toko X: 100", "Nastar -> Toko Y: 50").
- **Cetak Dokumen:** Tombol "**Print Out**" tersendiri berfungsi memproduksi cetakan fisik kedua *manifest* (All Toko & Distribusi Alamat).

---

## 5. Rincian Antarmuka & Modul (Staff Pages)
Desain diatur melalui rekayasa berbasis *User Interface* seluler/mobile (*Mobile-First*), dengan navigasi ketukan yang ringkas agar beradaptasi di lingkungan aktivitas dinamis staf.

### 5.1. Jobdesk Harian
- **Layout Terpusat**: Form selajur berkolom identik menyamai fitur Jadwal Harian sisi Admin (Menghindari kebingungan operasional dari dua lini).
- **CRUCIAL WORKFLOW: Jendela "Hasil Aktual":**
  1. Staf mengklik tombol "**Konfirmasi**" (Selesai pada jadwal).
  2. Sebuah **Pop-up Wajib (*Mandatory*)** langsung muncul di tengah layar.
  3. Form interaktif meminta penginputen kuantitas *Output* final dari dapur di kotak **"Hasil Aktual"** (*Actual Yield*). 
  4. Angka aktual konfirmasi akan langsung terekam dan meng-*update* nominal modul *Product Stock* secara otomatis, menyelesaikan *bottleneck* permasalahan hasil adonan yang terbuang.

### 5.2. Order Harian
- Visibilitas murni sebagai pelengkap dari fitur Order Harian Admin. Staff dalam dapur dapat secara instan mengklik kotak Tanggal, membuka rincian **Tabel All Toko** maupun **Tabel Pemecahan Order** pada gawai mereka untuk persiapan barang, dan menekan "**Print Out**" mengirim sinkronisasi ke printer pos lokal.

### 5.3. Checklist Harian
- Staf disajikan tabel 3 pilar pemeriksaan area: *Pastry, General, Kitchen*.
- Konfigurasi form kotak centang / *checkbox* yang sederhana. Terintegrasi native ke **Akses Kamera Handphone**. 
- Bila ditautkan wajib oleh Admin (*Mandatory Foto*), sistem akan mengunci proses verifikasi final staf sampai foto sasaran telah diunggah / dipotret sinkron menuju *Database*.

### 5.4. Check Stock
- Fasilitas Audit Dapur Harian (*Stock Opname*). Staff mengecek material mentah fisik di kulkas/gudang.
- Menginput nilai "Total Qty Fisik Aktual" ditambah saran isian kolom "*Berapa banyak yang harus dibeli?*".
- Segera setelah diserahkan (*Submit*), hasil secara *real-time* beralih kepada layar panel khusus Modul "**Semua Stok**" Admin.

---

## 6. Fase Implementasi (Implementation Phases)

### Phase 1: Minimum Viable Product (MVP)
- **Fokus Esensial:** Infrastruktur PWA *Mobile*, sistem *Auth* & peran pengguna dasar, serta instrumen utama sinkronisasi DB (Supabase *Real-Time*).
- **Modul Manajerial Pertama:** Mengukuhkan pangkalan modul "Stok Produk", "Semua Stok" dan penyusunan master data "Estimasi Produksi".
- **Eksekusi Penugasan Dapur:** Pembuatan fungsional jadwal "Admin -> Jobdesk Staff", disertai peluncuran jendela pop-up kewajiban pelaporan "Hasil Aktual" agar mutasi masuk inventoris produk otomatis bekerja.
- **Mesin Order:** Fungsional Pop-up "Tambah Pesanan" (tampil berdampingan stok produk), hingga bergeser lewat mekanisme *Dispatch* sederhana ke log rekam distribusi.
- **Generator Dokumen Dapur:** Menjamin `react-pdf` sanggup menghasilkan minimal form *Print Out* di segmen penugasan jadwal dan tabel order dapur *All Toko*.

### Phase 2: Performa Data & Agregat Komprehensif
- **Otomatisasi Lanjutan:** Aktivasi sistem kalender jadwal shift karyawan berdasar *database* nama.
- **Sistem Checklist Kamera Berpelindung:** Modul fungsional jepretan wajib lapangan via staf yang tervisualkan ke penyimpanan *Object Storage* harian Admin.
- **Inteligensi Peringatan:** Websockets mutlak persembunyian sinyal layar interaktif agar Dasbor Admin berkerlip peringatan status pesanan rendah inventaris dan omzet terkini tanpa membebankan penundaan halaman browser.
