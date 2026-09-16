const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Konfigurasi koneksi ke PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_toko_donat',
    password: 'kocak1221', 
    port: 5432,
});

// Cek Koneksi Database
pool.connect((err) => {
    if (err) {
        console.error('Gagal menyambung ke database:', err.stack);
    } else {
        console.log('Berhasil tersambung ke PostgreSQL! 🐘');
    }
});

// Endpoint API: Mengambil data menu
app.get('/api/menu', async (req, res) => {
    try {
        const hasil = await pool.query('SELECT * FROM menu_donat');
        res.json(hasil.rows); // Kirim data donat dalam format JSON
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint API: Menerima Pesanan Baru (CHECKOUT)
app.post('/api/checkout', async (req, res) => {
    const { keranjang, total_harga } = req.body;

    try {
        // 1. Simpan nota utama dulu untuk dapat ID Pesanan-nya
        const notaBaru = await pool.query(
            'INSERT INTO pesanan (total_harga) VALUES ($1) RETURNING id',
            [total_harga]
        );
        const idPesanan = notaBaru.rows[0].id;

        // 2. Simpan rincian donat-donatnya ke detail_pesanan
        for (let item of keranjang) {
            await pool.query(
                'INSERT INTO detail_pesanan (id_pesanan, id_donat, jumlah, subtotal) VALUES ($1, $2, $3, $4)',
                [idPesanan, item.id, item.jumlah, item.harga * item.jumlah]
            );
        }

        // 3. Beri tahu React bahwa semuanya sukses!
        res.status(201).json({ message: 'Pesanan berhasil dicatat!', id_nota: idPesanan });
    } catch (err) {
        console.error("ERROR SAAT CHECKOUT:", err.message); 
        res.status(500).json({ error: err.message });
    }
});

// Endpoint API: Mengambil Data Riwayat Pesanan
app.get('/api/riwayat', async (req, res) => {
    try {
        // Tarik data utama pesanan, urutkan dari yang terbaru (DESC)
        const pesanan = await pool.query('SELECT * FROM pesanan ORDER BY waktu_pesan DESC');
        const dataRiwayat = pesanan.rows;

        // Looping untuk menarik detail donat dari setiap pesanan
        for (let i = 0; i < dataRiwayat.length; i++) {
            const pesananId = dataRiwayat[i].id;
            
            // Lakukan pencarian nama donat dengan menggabungkan tabel detail_pesanan dan menu_donat
            const rincian = await pool.query(
                `SELECT md.nama, dp.jumlah, dp.subtotal 
                 FROM detail_pesanan dp
                 JOIN menu_donat md ON dp.id_donat = md.id
                 WHERE dp.id_pesanan = $1`,
                [pesananId]
            );
            // Masukkan hasil rincian ke dalam objek pesanan utama
            dataRiwayat[i].items = rincian.rows;
        }

        res.json(dataRiwayat); // Kirim paket data lengkap ke React
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Menyalakan server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server Backend berjalan di http://localhost:${PORT}`);
});