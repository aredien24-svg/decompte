const express = require('express');
const { Client } = require('pg');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Configuration de la connexion à la base de données PostgreSQL
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Connexion à la base de données
client.connect()
    .then(() => {
        console.log('Connecté à la base de données PostgreSQL !');
        // Créer la table des repas
        return client.query(`
            CREATE TABLE IF NOT EXISTS meals (
                id SERIAL PRIMARY KEY,
                user_email TEXT,
                date TEXT,
                meal_type TEXT,
                state TEXT,
                UNIQUE(user_email, date, meal_type)
            )
        `);
    })
    .then(() => {
        console.log('Table des repas créée ou déjà existante.');
    })
    .catch(err => {
        console.error('Erreur de connexion à la base de données :', err.stack);
    });

// Permettre au serveur de lire le format JSON
app.use(express.json());

// Servir les fichiers statiques (ton HTML/CSS/JS) depuis le dossier parent
app.use(express.static(path.join(__dirname, '..')));

// Endpoint pour sauvegarder les repas
app.post('/api/save-meal', (req, res) => {
    const { user_email, date, meal_type, state } = req.body;
    const query = `
        INSERT INTO meals (user_email, date, meal_type, state) 
        VALUES ($1, $2, $3, $4)
        ON CONFLICT(user_email, date, meal_type) DO UPDATE SET state = excluded.state
    `;
    client.query(query, [user_email, date, meal_type, state])
        .then(() => {
            res.json({ message: 'Repas sauvegardé !' });
        })
        .catch(err => {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        });
});

// Endpoint pour récupérer les repas d'un utilisateur
app.get('/api/get-meals', (req, res) => {
    const { user_email } = req.query;
    client.query('SELECT date, meal_type, state FROM meals WHERE user_email = $1', [user_email])
        .then(result => {
            res.json(result.rows);
        })
        .catch(err => {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        });
});

// Endpoint pour récupérer toutes les données pour l'administrateur
app.get('/api/get-all-meals', (req, res) => {
    client.query('SELECT user_email, date, meal_type, state FROM meals')
        .then(result => {
            res.json(result.rows);
        })
        .catch(err => {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        });
});

// Lancer le serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});