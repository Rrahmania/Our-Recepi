# Frontend-ourrecepi

Aplikasi berbasis web untuk berbagi resep masakan Nusantara yang fungsional, terstruktur, dan dibangun menggunakan prinsip Pemrograman Berorientasi Objek (PBO) serta arsitektur MVC (Model-View-Controller).

---

## Fitur Utama Berdasarkan Peran (Role)

### Pengguna Umum (Tanpa Login)
* Menjelajahi resep kuliner populer Nusantara di halaman beranda.
* Melakukan filtrasi resep berdasarkan kategori makanan (Daging, Ayam, Nasi, Sayur, dll.).
* Melihat detail bahan, langkah memasak, dan rating resep secara transparan.

### Pengguna Terregistrasi (Regular User)
* Melakukan **Register** dan **Login** secara aman.
* Menambahkan resep masakan kreasi sendiri (mendukung unggah gambar berbasis Base64).
* Mengelola resep pribadi (fitur CRUD: Tambah & Hapus resep sendiri).
* Menyimpan resep milik orang lain ke dalam daftar **Resep Favorit**.
* Memberikan komentar serta rating bintang (1-5) pada resep.

### Administrator (Admin)
* Mengakses **Dashboard Admin** khusus.
* Memiliki kendali penuh (*Moderasi*) untuk menghapus resep milik pengguna mana pun jika dinilai melanggar ketentuan.

---

## Skema Database 
1. `accounts`: Menyimpan data pengguna (Kolom `role_type` membedakan `ADMIN` dan `USER`).
2. `recipes`: Menyimpan data utama resep masakan yang terhubung ke tabel `accounts` via *Foreign Key* `user_id`.
3. `recipe_ingredients`: Tabel pembantu (*Element Collection*) untuk menyimpan daftar bahan makanan yang terikat pada `recipe_id`.
4. `recipe_steps`: Tabel pembantu (*Element Collection*) untuk menyimpan urutan langkah memasak yang terikat pada `recipe_id`.
5. `comments`: Tabel transaksi yang menghubungkan `user_id` dan `recipe_id` untuk menyimpan data rating (bintang 1-5) dan komentar teks.

---


## Penerapan 4 Pilar Utama PBO (Pemrograman Berorientasi Objek)

### 1. Abstraction (Abstraksi)
* **Kelas Abstrak (`Account.java`):** Digunakan sebagai cetak biru induk yang tidak dapat diinstansiasi secara langsung, melainkan mendefinisikan kontrak fungsi abstrak `public abstract String getRolePermissions()`.
* **Interface Service (`RecipeService.java`):** Menyediakan kontrak fungsi logika bisnis (seperti `createRecipe`, `deleteRecipe`) tanpa mengekspos detail implementasinya kepada Controller.

### 2. Encapsulation (Enkapsulasi)
* Semua atribut pada kelas model/entitas (seperti `Account`, `Recipe`, `Comment`) diatur dengan hak akses `private`.
* Akses data dilakukan secara aman melalui metode Getter dan Setter.
* Atribut sensitif seperti `password` dilindungi menggunakan anotasi `@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)` agar tidak bocor ke sisi klien saat pertukaran data JSON.

### 3. Inheritance (Pewarisan)
* Kelas `Admin.java` dan `RegularUser.java` mewarisi (extends) seluruh atribut dasar (id, username, email, password) dari kelas induk `Account.java`.
* Menggunakan strategi `@Inheritance(strategy = InheritanceType.SINGLE_TABLE)` dengan kolom diskriminator untuk memetakan hierarki objek ke dalam satu tabel database tunggal secara efisien.

### 4. Polymorphism (Polimorfisme)
* **Method Overriding:** Kelas `Admin` dan `RegularUser` melakukan override pada fungsi `getRolePermissions()` untuk menghasilkan deskripsi hak akses yang berbeda secara dinamis.
* **Polimorfisme Dinamis (Hak Akses):** Pada `RecipeServiceImpl.java`, fungsi penghapusan resep memeriksa instansiasi objek menggunakan `instanceof`. Objek ber-tipe `Admin` diizinkan menghapus resep milik siapa saja, sedangkan objek ber-tipe `RegularUser` dikunci secara polimorfik hanya dapat menghapus resep miliknya sendiri.

---

## Arsitektur Sistem & Design Pattern

### 1. Model-View-Controller (MVC)
* **Model:** Representasi data dan ORM (Object-Relational Mapping) menggunakan Spring Data JPA (`model/` dan `repository/`).
* **View:** Antarmuka pengguna interaktif menggunakan HTML, CSS, dan JavaScript (`index.html`, `style.css`, `script.js`).
* **Controller:** Penyedia REST API endpoint untuk menghubungkan logika bisnis dengan antarmuka pengguna (`controller/`).

### 2. Singleton Pattern
* Komponen Service dan Repository dikelola sepenuhnya oleh Spring Container sebagai Bean berskala tunggal (Singleton), memastikan efisiensi memori dan konsistensi status aplikasi.

---

## Demo Aplikasi (URL Deployment)
* **Frontend (Vercel):** `https://our-recepi.vercel.app/`
* **Backend API (Render):** `https://backendrecepi.onrender.com/api`
* **Database (Cloud):** PostgreSQL via Neon.tech

---

## Tech Stack (Teknologi yang Digunakan)
* **Frontend:** HTML5, CSS, JavaScript
* **Backend:** Java , Spring Boot (Web, Data JPA)
* **Database:** PostgreSQL (Neon.tech Cloud Database)
* **DevOps / Deployment:** Docker, Render (Backend), Vercel (Frontend)

---

## Cara Menjalankan Proyek Secara Lokal
### Menjalankan Frontend (HTML)
1. Buka Folder Frontend lalu run (ctrl + F5)
