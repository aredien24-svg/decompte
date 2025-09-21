const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs'); // On ajoute le module 'fs' pour gérer les fichiers
const app = express();
const port = process.env.PORT || 3000;

// Le chemin '/data' correspondra au disque permanent sur Fly.io
const dbDir = '/data';
// On s'assure que le dossier existe avant de créer la base de données dedans
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'repas.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erreur en ouvrant la base de données', err.message);
    } else {
        console.log('Connecté à la base de données SQLite sur le volume persistant.');
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, firstname TEXT NOT NULL, lastname TEXT NOT NULL, job TEXT, room_number TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS meals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT, date TEXT, meal_type TEXT, state TEXT, UNIQUE(user_email, date, meal_type))`);
            console.log("Tables 'users' et 'meals' prêtes.");
        });
    }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// --- API (version SQLite) ---
app.post('/api/login', (req, res) => {
    db.get('SELECT * FROM users WHERE email = ?', [req.body.email], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (user) res.status(200).json({ message: 'Connexion réussie', user });
        else res.status(404).json({ error: 'Email non reconnu.' });
    });
});

app.post('/api/create-user', (req, res) => {
    const { email, firstname, lastname, job, room_number } = req.body;
    const query = 'INSERT INTO users (email, firstname, lastname, job, room_number) VALUES (?, ?, ?, ?, ?)';
    db.run(query, [email, firstname, lastname, job, room_number], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: "Cet email est déjà utilisé." });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Utilisateur créé !', id: this.lastID });
    });
});

app.get('/api/get-users', (req, res) => {
    db.all('SELECT * FROM users ORDER BY lastname, firstname', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/save-meal', (req, res) => {
    const { user_email, date, meal_type, state } = req.body;
    const upsertQuery = `
        INSERT INTO meals (user_email, date, meal_type, state) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_email, date, meal_type) DO UPDATE SET state = excluded.state`;
    db.run(upsertQuery, [user_email, date, meal_type, state], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Repas sauvegardé !' });
    });
});

app.get('/api/get-meals', (req, res) => {
    db.all('SELECT date, meal_type, state FROM meals WHERE user_email = ?', [req.query.user_email], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/get-all-meals', (req, res) => {
    db.all('SELECT user_email, date, meal_type, state FROM meals', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(port, () => console.log(`Serveur démarré sur le port ${port}`));