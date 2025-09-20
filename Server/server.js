const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 3000;

// Création de la base de données
const db = new sqlite3.Database('repas.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connecté à la base de données des repas.');
});

// Créer la table des repas
db.run(`CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    date TEXT,
    meal_type TEXT,
    state TEXT,
    UNIQUE(user_email, date, meal_type)
)`, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Table des repas créée ou déjà existante.');
});

// Permettre au serveur de lire le format JSON
app.use(express.json());

// Servir le fichier index.html comme page d'accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Servir les fichiers statiques (ton HTML/CSS/JS) depuis le dossier parent
app.use(express.static(path.join(__dirname, '..')));

// Endpoint pour sauvegarder les repas
app.post('/api/save-meal', (req, res) => {
    const { user_email, date, meal_type, state } = req.body;
    db.run(`INSERT INTO meals (user_email, date, meal_type, state) VALUES (?, ?, ?, ?)
            ON CONFLICT(user_email, date, meal_type) DO UPDATE SET state = excluded.state`,
        [user_email, date, meal_type, state],
        function(err) {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Repas sauvegardé !', id: this.lastID });
        });
});

// Endpoint pour récupérer les repas d'un utilisateur
app.get('/api/get-meals', (req, res) => {
    const { user_email } = req.query;
    db.all(`SELECT date, meal_type, state FROM meals WHERE user_email = ?`, [user_email], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Endpoint pour récupérer toutes les données pour l'administrateur
app.get('/api/get-all-meals', (req, res) => {
    db.all(`SELECT user_email, date, meal_type, state FROM meals`, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Lancer le serveur
app.listen(port, () => {
    console.log(`Serveur démarré à l'adresse http://localhost:${port}`);
});