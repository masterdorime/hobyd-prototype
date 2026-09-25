# CR YOUTH 2026 — Proposal Ide Bisnis (diperbarui: bukti MVP)

CR YOUTH 2026

HACKATHON

PROPOSAL IDE BISNIS

HOBYD

Hobby and Bid

Live Auction untuk Kolektor Indonesia

[Gambar sampul: suasana live auction Hobyd — sisipkan tangkapan layar ruang live.]

Tim: Pekalongan Hemker Community

Telkom University

Ketua: Tristan Edgina Rakhadewa

Anggota 1: Farel Satrio Pratama

Anggota 2: Khoirul Fikri

Daftar Isi

1. Executive Summary
2. Latar Belakang / Problem
3. User & Market
4. Solution / Product
5. Core Auction Engine & Innovation
6. User Flow / Demo Flow
7. Value Proposition
8. Competitive Landscape
9. Business Model
10. Technical Feasibility
11. MVP & Roadmap
12. Conclusion
13. Appendix

## 1. Executive Summary

Kolektor barang hobi di Indonesia mengatur transaksi melalui kanal yang terpisah. Barang ditemukan di satu tempat, penawaran diajukan di tempat lain, dan pembayaran diselesaikan di tempat yang berbeda. Untuk barang koleksi, cara ini menimbulkan friksi karena nilai barang bergantung pada kelangkaan, kondisi fisik, keaslian, dan minat komunitas pada saat tertentu.

Hobyd (Hobby and Bid) adalah platform live auction berbasis website untuk kolektor. Penjual menyiarkan live dan melelang item satu per satu dengan timer. Pembeli mengajukan bid secara real time dan melihat harga terbentuk melalui kompetisi yang transparan. Pembedanya: pengalaman yang dirancang untuk kolektor, penemuan harga real time, mesin lelang yang otoritatif di server, riwayat bid yang terbuka, dan lapisan kepercayaan transaksi.

Target awal adalah kolektor Pokemon TCG di Indonesia. Pada hackathon, tim mendemokan satu room live dengan satu penjual dan beberapa penawar: bid real time dengan validasi server, perpanjangan anti-sniping, penguncian pemenang, dan demo pembayaran. Semua alur ini berjalan pada MVP yang dibangun: penjual membuat live dari dialog bernama, memilih kategori (termasuk Other), melelang item dengan mode soft close atau sudden death, dan pemenang membayar lalu bertukar kontak WhatsApp untuk serah terima. Penonton mobile mendapat tampilan video full-bleed dengan kartu bid dan chat sebagai overlay; penonton desktop mendapat side rail bid dan chat, mode theater, dan fullscreen. Kategori lain menyusul setelah model inti tervalidasi.

[Gambar 1. Loop inti Hobyd.]

## 2. Latar Belakang / Problem

Barang koleksi berbeda dari barang biasa. Nilai sebuah kartu Pokemon TCG berubah mengikuti kelangkaan cetakan, kondisi fisik, keaslian, dan minat komunitas. Harga yang wajar sulit ditetapkan sepihak sehingga membutuhkan kompetisi antar pembeli yang terlihat oleh semua pihak.

Observasi awal tim menunjukkan alur yang terpisah: penemuan barang di media sosial atau komunitas, diskusi di grup chat, penawaran manual melalui komentar, dan pembayaran di kanal lain. Lelang manual umumnya berjalan tanpa timer resmi dan tanpa catatan bid yang terstruktur. Hipotesis tim: alur live yang menggabungkan penemuan barang, bidding terstruktur, dan catatan transparan dapat meningkatkan kepercayaan transaksi. Hipotesis ini diuji pada pilot dengan metrik retensi penjual, partisipasi ulang pembeli, penyelesaian lelang, dan penyelesaian pembayaran.

Momen ini tepat karena tiga kebiasaan sudah terbentuk: menonton konten live, membayar dengan dompet digital, dan berkumpul di komunitas digital. Pengujian live tim dengan dua ponsel menemukan dua friksi yang tidak terlihat di desktop: kamera ponsel yang publish di atas 720p tidak selalu bisa di-decode ponsel penawar (layar hitam dengan chat tetap jalan), dan dialog yang tidak di-portal bisa terpotong oleh navigasi bawah. Keduanya diperbaiki di MVP: capture dibatasi 720p dan dialog di-portal ke document body. Yang belum tersedia dalam satu pengalaman yang fokus pada lelang adalah penemuan barang secara live, bidding terstruktur, dan alur transaksi kolektor.

[Gambar 2. Alur terfragmentasi saat ini dan alur Hobyd.]

## 3. User & Market

Hobyd memulai dari satu beachhead: kolektor Pokemon TCG di Indonesia. Fokus sempit ini disengaja. Live marketplace menghadapi masalah chicken-and-egg: tanpa penjual tidak ada inventaris, tanpa inventaris tidak ada pembeli, dan tanpa pembeli penjual tidak bertahan. Satu niche yang anggotanya sudah saling mengenal memberi peluang terbaik untuk mempertemukan kedua sisi.

Tabel 1. Pengguna.

| | Kolektor Pembeli | Penjual |
|---|---|---|
| Siapa | Kolektor Pokemon TCG yang mencari kartu tertentu | Penjual atau reseller kartu, termasuk UMKM hobi |
| Perilaku | Mengikuti komunitas dan menonton konten live | Menjual melalui marketplace, media sosial, dan komunitas |
| Kebutuhan | Menemukan kartu dan menawar secara transparan | Berjualan live dengan alur yang terstruktur |
| Pain | Penawaran manual sulit diikuti dan dilacak | Negosiasi satu per satu memakan waktu |
| Alasan memakai Hobyd | Bidding real time dengan riwayat terbuka | Satu sesi live untuk banyak item dengan aturan otomatis |

Strategi likuiditas: bermitra dengan komunitas tertentu, mengkurasi penjual awal, mengadakan live berulang, mengukur retensi dan partisipasi, memperbaiki, lalu berekspansi. Beachhead adalah kolektor Pokemon TCG di Indonesia; perluasan ke diecast, sneakers, dan koleksi lain menyusul setelah model inti tervalidasi. Ukuran pasar tidak diestimasi dalam proposal ini. Variabel yang divalidasi: komunitas yang terjangkau, jumlah penjual, frekuensi transaksi, nilai transaksi rata-rata, dan partisipasi ulang.

[Gambar 3. Pipa likuiditas dan perluasan kategori.]

## 4. Solution / Product

Ruang lelang live Hobyd menampilkan video penjual, kartu item, harga berjalan, countdown, feed bid, dan tombol BID dalam satu layar. Loop pembeli: DISCOVER, WATCH, BID, WIN, PAY. Loop penjual: CREATE LIVE, ADD ITEM, START AUCTION, ACCEPT BIDS, CLOSE AUCTION.

[Gambar 4. Ruang lelang Hobyd — sisipkan tangkapan layar desktop dan mobile.]

Video live: siaran penjual yang sedang melelang. Penjual dari ponsel mendapat pratinjau kamera portrait 9:16; penonton ponsel mendapat video full-bleed dengan kartu bid dan chat sebagai overlay; penonton desktop mendapat side rail berisi kartu bid di atas dan chat di bawah, plus mode theater dan fullscreen dengan rail yang sama.

Kartu item: foto 16:9, deskripsi, harga berjalan, dan timer. Semua foto yang diunggah di-crop otomatis ke 16:9 saat diterima, dan setiap permukaan (lobi, kartu item, rail, mobile, sales) menampilkannya sebagai aspect-video object-cover, sehingga pratinjau sebelum posting sama persis dengan yang dilihat pembeli.

Feed bid: setiap penawaran tercatat dan terlihat peserta, beserta 5 bid teratas.

Tombol BID: satu ketukan untuk mengajukan penawaran berikutnya, dengan nominal cepat.

Pembuatan live: dialog Go Live meminta judul (1–80 karakter) dan kategori di awal, sehingga tidak ada room tanpa nama. Kategori: Sneakers, TCG, Vintage Clothing, Electronics, Other. Pemilik room dapat mengganti judul dan kategori belakangan.

## 5. Core Auction Engine & Innovation

Inovasi produk: pengalaman yang dirancang untuk kolektor, penemuan barang secara live, penemuan harga real time, lelang per item yang terstruktur dengan dua mode (soft close yang memperpanjang timer dan sudden death yang tidak pernah bergeser), lapisan kepercayaan, dan alur transaksi Indonesia. Inovasi engineering: state lelang yang otoritatif di server. Browser peserta tidak menentukan hasil lelang.

Setiap bid melewati validasi server yang memeriksa status lelang, nominal dan kelipatan, sisa timer, otorisasi, dan batas laju. Bid yang tiba bersamaan diurutkan dengan timestamp server. Setiap bid tercatat dalam jejak audit dan disiarkan ke seluruh klien. Countdown dihitung dari waktu server agar konsisten di semua perangkat. Bid di detik akhir memperpanjang timer dalam batas aturan (mode soft; maksimal perpanjangan yang dikonfigurasi). Saat timer habis, item dikunci pada penawar tertinggi. Alur: bid request, validasi server, update state, broadcast, update klien, perpanjangan atau penutupan, winner lock.

Capture video dibatasi 720p agar ponsel penawar selalu bisa men-decode stream ponsel penjual. Flag diagnostik (?debug=1) menampilkan pengaturan capture dan event track untuk repro perangkat spesifik.

[Gambar 5. Mesin lelang: server sebagai sumber kebenaran.]

## 6. User Flow / Demo Flow

Penjual membuka dialog Go Live, memberi judul dan kategori, lalu menyalakan kamera dan memulai stream.

Penjual menampilkan item pertama beserta harga awal, lalu menekan Start bid untuk menjalankan timer.

Penawar bergabung, menonton siaran, dan menekan BID.

Server memvalidasi setiap bid; harga dan riwayat diperbarui ke semua layar.

Bid di detik akhir memperpanjang timer sesuai aturan (mode soft).

Timer habis atau penjual menutup lebih awal (konfirmasi dua ketuk); pemenang dikunci dan diumumkan, lalu masuk demo pembayaran.

Pemenang membayar dalam jendela 5:00, lalu meninggalkan nomor WhatsApp di halaman menang; penjual melihat nomor itu di halaman yang sama dan di inbox Sales, lalu menghubungi untuk serah terima.

Penjual melanjutkan ke item berikutnya dengan alur yang sama.

[Gambar 6. Mekanisme timer dan anti-sniping.]

Alur pembayaran menangani dua hasil: lunas dalam jendela waktu menjadi order confirmed; kedaluwarsa menjadi expired dan item di-relist (kembali dilelang) sebagai item baru. Kriteria sukses demo: banyak penawar dapat bid bersamaan, semua klien menerima state yang konsisten, bid tidak valid ditolak server, bid di akhir memperpanjang timer, pemenang tidak berubah setelah lock, dan pemenang dapat masuk alur pembayaran. Kriteria ini diuji pada pengujian live dua ponsel plus desktop.

## 7. Value Proposition

Tabel 2. Value.

| | Value |
|---|---|
| Penjual | Satu sesi live mengelola banyak item dengan aturan otomatis; negosiasi manual berkurang; catatan transaksi tersimpan; nomor pemenang terkumpul di inbox Sales. |
| Pembeli | Menemukan barang secara live; bidding real time; harga terbentuk transparan; riwayat bid dapat diperiksa; checkout setelah menang; countdown terlihat di kartu bid mobile. |
| Komunitas | Event lelang terstruktur di sekitar komunitas; interaksi langsung penjual dan kolektor dalam satu tempat. |

Kepercayaan dibangun berlapis. Sebelum lelang: profil penjual, dengan verifikasi sebagai roadmap. Saat lelang: validasi server, riwayat bid terbuka, dan jejak audit. Setelah lelang: status bayar, catatan transaksi, kontak serah terima, dan reputasi, dengan penanganan sengketa sebagai roadmap. Fitur roadmap dinyatakan secara eksplisit dan tidak diklaim tersedia di MVP.

[Gambar 7. Lapisan kepercayaan sebelum, saat, dan setelah lelang.]

## 8. Competitive Landscape

Competitive scan awal mengelompokkan solusi berdasarkan pekerjaan yang diselesaikan. Tabel berikut adalah gambaran umum yang akan divalidasi lebih lanjut.

Tabel 3. Lanskap kompetitif.

| Kemampuan | Marketplace umum | Live commerce | Grup komunitas | Hobyd |
|---|---|---|---|---|
| Penemuan live | Terbatas | Ya | Terbatas | Ya |
| Lelang terstruktur | Tidak | Terbatas | Tidak | Ya |
| Bid real time | Tidak | Terbatas | Tidak | Ya |
| Timer resmi | Tidak | Sebagian | Tidak | Ya |
| Riwayat bid | Tidak | Terbatas | Tidak | Ya |
| Alur transaksi | Ya | Ya | Tidak | Ya |

Marketplace umum menyelesaikan katalog dan transaksi; live commerce menyelesaikan konten live dan penjualan harga tetap; grup komunitas menyelesaikan kebersamaan niche dan transaksi informal. Hobyd menempati posisi lelang live yang fokus pada kolektor dengan penemuan harga real time, bidding terstruktur, dan alur transaksi. Potensi moat: komunitas kolektor, jaringan penjual, sistem reputasi, riwayat transaksi dan lelang, UX khusus kolektor, dan live berulang. Ini adalah potensi yang perlu dibangun, bukan keunggulan yang sudah terbukti.

## 9. Business Model

Model bisnis adalah hipotesis awal yang diuji pada pilot. Hipotesis pendapatan: komisi transaksi yang dibayar penjual saat lelang selesai hingga pembayaran, ditambah layanan penjual premium dan biaya kurasi, promosi, atau event. Nilai untuk penjual: akses pembeli yang berkumpul saat live, proses lelang terstruktur, catatan transaksi, dan inbox Sales yang menghimpun kontak pemenang. Struktur biaya: infrastruktur video, pemrosesan pembayaran, cloud, dukungan pelanggan, dan operasi kepercayaan. Rumus dasar: GMV x take rate = pendapatan platform. Semua angka fee adalah hipotesis, bukan fakta.

[Gambar 8. Model bisnis dan rumus pendapatan.]

[Gambar 9. Flywheel: seller dan buyer saling menguatkan.]

## 10. Technical Feasibility

Kamera penjual diteruskan melalui lapisan video live ke penonton. Permintaan bid diteruskan ke server lelang, divalidasi, disimpan sebagai state, lalu disiarkan ke seluruh klien. Penutupan lelang memicu winner lock dan alur pembayaran. Video dan state lelang adalah dua sistem terpisah sehingga gangguan video tidak merusak catatan transaksi. Stack pendukung: Next.js untuk website, Supabase untuk data dan realtime, LiveKit untuk video, QRIS mock/sandbox untuk demo pembayaran. Teknologi adalah enabler; inovasinya terletak pada workflow, mekanisme lelang, dan pengalaman kolektor.

[Gambar 10. Arsitektur fungsional.]

Otorisasi: hanya peserta room yang dapat bid; hanya penjual (pemilik room) yang mengontrol lelang; hanya pemenang yang dapat menyimpan kontak serah terima; daftar order penjual dibatasi room miliknya sendiri.

Validasi server untuk setiap bid sebelum mengubah state.

Batas laju per pengguna untuk mencegah spam.

Penanganan konkurensi dengan timestamp server.

Catatan bid yang dapat ditelusuri dan tidak dapat diubah peserta.

Isolasi kegagalan antara lapisan video dan state lelang.

Satu topik realtime per komponen; tidak ada dua subscriber pada satu topik.

Pembersih otomatis: room preview yang tidak pernah live lebih dari 10 menit terhapus saat lobi dibuka; room live yang tidak berpenghuni melewati batas yang sama diakhiri (ended), bukan dihapus, agar order tetap tersimpan.

## 11. MVP & Roadmap

MVP hackathon yang dibangun: live satu penjual dan beberapa penonton; dialog Go Live bernama dengan kategori; video live (portrait penjual mobile, full-bleed penonton mobile, side rail + theater + fullscreen desktop); kartu item dengan foto 16:9 WYSIWYG; bidding real time dengan validasi server; timer dengan mode soft close dan sudden death; kategori gate termasuk Other; anti-sniping; winner lock; demo pembayaran 5:00; kontak WhatsApp pemenang; inbox Sales; pembersih room terbengkalai. Suite 90 tes unit lolos, typecheck bersih, production build hijau.

Di luar MVP: verifikasi penjual lanjutan, reputasi, pengungkapan kondisi, penanganan sengketa, logistik, analitik, chat order dalam aplikasi, dan kategori tambahan. Tahapan: Fase 1 pilot komunitas Pokemon TCG (KPI: retensi penjual, partisipasi ulang) — berjalan; Fase 2 validasi product-market fit (KPI: penyelesaian lelang dan pembayaran); Fase 3 perbaikan trust dan transaksi; Fase 4 ekspansi kategori. Metrik produk: auction completion, invalid bid rate, payment completion, sinkronisasi dan latensi. Metrik marketplace: retensi penjual, partisipasi ulang, item terjual per live, lelang selesai per live.

[Gambar 11. Roadmap pilot hingga ekspansi.]

## 12. Conclusion

[Gambar 12. Rekap: problem, Hobyd, bukti MVP, langkah berikut.]

Transaksi kolektor membutuhkan penemuan harga yang transparan dalam alur yang terstruktur. Hobyd menjawabnya dengan live auction untuk kolektor yang didukung mesin lelang server-authoritative dan riwayat bid terbuka. Demo hackathon menunjukkan live, bid, win, dan pay berjalan, ditambah serah terima kontak dan inbox Sales. Langkah berikut: pilot pada komunitas Pokemon TCG untuk memvalidasi retensi dan partisipasi sebelum memperbaiki dan berekspansi.

## 13. Appendix

A. Arsitektur penuh: lihat Gambar 10. Lapisan video (kamera, live video, penonton) terpisah dari jalur transaksi (bid, engine, state, broadcast, lock, payment).

B. Model data (sesuai implementasi):

Tabel 4. Model data.

| Tabel | Kolom kunci |
|---|---|
| rooms | id, title, seller_name, owner_id, status (preview/live/ended), category (Sneakers/TCG/Vintage Clothing/Electronics/Other), thumbnail_url |
| items | id, room_id, title, img_url, start_price, current_price, ends_at, status, auction_mode (soft/hard), duration_sec (10–300), winner |
| bids | id, item_id, bidder, amount, created_at (waktu server) |
| profiles | id, name, reputation (roadmap) |
| orders | id, item_id, winner, winner_contact, status (pending/paid/expired/cancelled), paid_at |
| chat_messages | id, room_id, nickname, body, created_at |

[Gambar 13. State lelang.]

C. Alur pembayaran:

[Gambar 14. Jalur lunas dan kedaluwarsa.]

D. Risk matrix:

Tabel 5. Risiko.

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Tidak ada penawar | Lelang sepi | Peluncuran bersama komunitas |
| Penjual tidak mengirim | Pembeli dirugikan | Reputasi dan kontrol transaksi |
| Pemenang tidak membayar | Item tertahan | Batas waktu bayar dan relist |
| Penjual palsu | Kepercayaan turun | Roadmap verifikasi |
| Race condition | Harga salah | State otoritatif di server |
| Video gagal | Demo terganggu | State lelang terpisah dari video |
| Kondisi barang salah | Sengketa | Disclosure, reputasi, roadmap sengketa |
| Ponsel tidak bisa decode stream ponsel | Layar hitam, chat tetap jalan | Capture dibatasi 720p; flag ?debug=1 untuk repro |
| Dialog terpotong navigasi bawah | Penjual mobile tidak bisa Go Live | Dialog di-portal ke document body |

E. Layar demo (sisipkan tangkapan layar nyata):

[Gambar 15. Halaman utama.]

[Gambar 16. Modal pemenang.]

[Gambar 17. Pembayaran demo.]

F. Rencana riset: observasi komunitas Pokemon TCG, interview penjual dan pembeli tentang workflow saat ini, lalu pilot dengan metrik retensi penjual, partisipasi ulang, penyelesaian lelang, penyelesaian pembayaran, kesediaan memakai, dan kesediaan penjual mengadakan live. Referensi: dokumentasi resmi Next.js, Supabase, LiveKit, dan QRIS.
