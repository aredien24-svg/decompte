const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Connexion à la base de données SQLite
const db = new sqlite3.Database('repas.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connecté à la base de données SQLite.');
});

// Création de la table des repas
db.run(`CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    date TEXT,
    meal_type TEXT,
    state TEXT,
    UNIQUE(user_email, date, meal_type)
)`, (err) => {
    if (err) console.error("Erreur table meals:", err.message);
    else console.log('Table des repas prête.');
});

// NOUVEAU : Création de la table des utilisateurs
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    firstname TEXT NOT NULL,
    lastname TEXT NOT NULL,
    job TEXT,
    room_number TEXT
)`, (err) => {
    if (err) console.error("Erreur table users:", err.message);
    else console.log('Table des utilisateurs prête.');
});


app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// --- API pour les REPAS ---

app.post('/api/save-meal', (req, res) => {
    const { user_email, date, meal_type, state } = req.body;
    const sql = `
        INSERT INTO meals (user_email, date, meal_type, state) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_email, date, meal_type) DO UPDATE SET state = excluded.state
    `;
    db.run(sql, [user_email, date, meal_type, state], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Repas sauvegardé !' });
    });
});

app.get('/api/get-meals', (req, res) => {
    const { user_email } = req.query;
    db.all(`SELECT date, meal_type, state FROM meals WHERE user_email = ?`, [user_email], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/get-all-meals', (req, res) => {
    db.all(`SELECT user_email, date, meal_type, state FROM meals`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


// --- NOUVEAU : API pour les UTILISATEURS ---

// Endpoint pour créer un nouvel utilisateur
app.post('/api/create-user', (req, res) => {
    const { email, firstname, lastname, job, room_number } = req.body;
    if (!email || !firstname || !lastname) {
        return res.status(400).json({ error: "L'email, le nom et le prénom sont requis." });
    }
    const sql = `INSERT INTO users (email, firstname, lastname, job, room_number) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [email, firstname, lastname, job, room_number], function(err) {
        if (err) {
            console.error(err.message);
            // Gère le cas où l'email existe déjà
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: "Cet email est déjà utilisé." });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Utilisateur créé avec succès !', id: this.lastID });
    });
});

// Endpoint pour récupérer tous les utilisateurs
app.get('/api/get-users', (req, res) => {
    db.all(`SELECT id, email, firstname, lastname, job, room_number FROM users ORDER BY lastname, firstname`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


// Lancer le serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});