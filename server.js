const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Konfigurasi koneksi ke PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_toko_donat',
    password: 'kocak1221', 
    port: 5432,
});

// Cek Koneksi Database
pool.connect((err, client, release) => {
    if (err) {
        console.error('Gagal menyambung ke database:', err.stack);
    } else {
        console.log('Berhasil tersambung ke PostgreSQL! 🐘');
        if (release) release();
    }
});

// Endpoint API: Mengambil data menu
app.get('/api/menu', async (req, res) => {
    try {
        const hasil = await pool.query('SELECT * FROM menu_donat ORDER BY id ASC');
        res.json(hasil.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint API: Tambah Menu Baru (CREATE)
app.post('/api/menu', async (req, res) => {
    const { nama_donat, harga, stok, gambar, kategori } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO menu_donat (nama_donat, harga, stok, gambar, kategori) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nama_donat, harga, stok, gambar, kategori || 'Semua']
        );
        res.status(201).json({ message: 'Menu berhasil ditambahkan', data: result.rows[0] });
    } catch (err) {
        console.error("Gagal menambah menu:", err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint API: Edit Menu (UPDATE)
// UNTUK TAMBAH DATA (POST)
app.post('/api/menu', async (req, res) => {
    const { nama_donat, harga, stok, gambar, kategori } = req.body; 
    try {
        const result = await pool.query(
            'INSERT INTO menu_donat (nama_donat, harga, stok, gambar, kategori) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nama_donat, harga, stok, gambar, kategori || 'Semua']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Gagal menambah menu:", err);
        res.status(500).json({ error: err.message });
    }
});

// UNTUK EDIT DATA (PUT)
app.put('/api/menu/:id', async (req, res) => {
    const { id } = req.params;
    const { nama_donat, harga, stok, gambar, kategori } = req.body;
    try {
        const result = await pool.query(
            'UPDATE menu_donat SET nama_donat = $1, harga = $2, stok = $3, gambar = $4, kategori = $5 WHERE id = $6 RETURNING *',
            [nama_donat, harga, stok, gambar, kategori || 'Semua', id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Gagal mengupdate menu:", err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint API: Menerima Pesanan Baru (CHECKOUT)
app.post('/api/checkout', async (req, res) => {
    const { keranjang, total_harga, nama_pelanggan, no_wa, tipe_pesanan, alamat_pengiriman } = req.body;
    
    if (!keranjang || !Array.isArray(keranjang) || keranjang.length === 0) {
        return res.status(400).json({ error: "Data keranjang kosong atau tidak valid!" });
    }

    try {
        const notaBaru = await pool.query(
            `INSERT INTO pesanan 
            (total_harga, nama_pelanggan, no_wa, tipe_pesanan, alamat_pengiriman) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [total_harga, nama_pelanggan, no_wa, tipe_pesanan, alamat_pengiriman]
        );
        
        const idPesanan = notaBaru.rows[0].id;
        
        for (let item of keranjang) {
            await pool.query(
                'INSERT INTO detail_pesanan (id_pesanan, id_donat, jumlah, subtotal) VALUES ($1, $2, $3, $4)',
                [idPesanan, item.id, item.jumlah, item.harga * item.jumlah]
            );
        }
        
        res.status(201).json({ message: 'Pesanan berhasil dicatat!', id_nota: idPesanan });
    } catch (err) {
        console.error("ERROR SAAT CHECKOUT:", err.message); 
        res.status(500).json({ error: err.message });
    }
});

// Endpoint API: Mengambil Data Riwayat Pesanan
app.get('/api/riwayat', async (req, res) => {
    try {
        const pesanan = await pool.query('SELECT * FROM pesanan ORDER BY id DESC');
        const dataRiwayat = pesanan.rows;
        
        for (let i = 0; i < dataRiwayat.length; i++) {
            const pesananId = dataRiwayat[i].id;
            const rincian = await pool.query(
                `SELECT md.nama_donat AS nama, dp.jumlah, dp.subtotal 
                FROM detail_pesanan dp
                JOIN menu_donat md ON dp.id_donat = md.id
                WHERE dp.id_pesanan = $1`,
                [pesananId]
            );
            dataRiwayat[i].items = rincian.rows;
        }
        
        res.json(dataRiwayat);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint API: Update Status Pesanan (Untuk Admin)
app.put('/api/pesanan/:id', async (req, res) => {
    const {id} = req.params;
    const {status_baru} = req.body;
    
    try {
        await pool.query(
            'UPDATE pesanan SET status_pesanan = $1 WHERE id = $2',
            [status_baru, id]
        );
        res.json({message: 'Status berhasil diperbarui!'});
    } catch (err) {
        console.error("Gagal update status:", err);
        res.status(500).json({error: err.message});
    }
});

// Endpoint API: Login Admin
app.post('/api/login', async (req, res) => {
    const {username, password} = req.body;
    
    try {
        const result = await pool.query (
            'SELECT * FROM admin WHERE username = $1 AND password = $2',
            [username, password]
        );
        
        if (result.rows.length > 0) {
            res.json({success: true, message: 'Login berhasil!'});
        } else {
            res.status(401).json({success: false, message: 'Username atau Password salah!'});
        }
    } catch (err) {
        console.error("Error saat login:", err);
        res.status(500).json({error: err.message});
    }
});

// Endpoint API: Hapus Semua Pesanan Selesai
app.delete('/api/pesanan/selesai', async (req, res) => {
    try {
        // Hapus detail pesanan terlebih dahulu untuk menghindari error Foreign Key
        await pool.query("DELETE FROM detail_pesanan WHERE id_pesanan IN (SELECT id FROM pesanan WHERE status_pesanan = 'Selesai')");
        
        // Setelah detailnya terhapus, baru hapus nota pesanannya
        await pool.query("DELETE FROM pesanan WHERE status_pesanan = 'Selesai'");
        
        res.json({ message: 'Semua pesanan selesai berhasil dibersihkan!' });
    } catch (err) {
        console.error("Gagal membersihkan pesanan selesai:", err);
        res.status(500).json({ error: err.message });
    }
});

// Menyalakan server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server Backend berjalan di http://localhost:${PORT}`);
});