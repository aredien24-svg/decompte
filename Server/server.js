const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initializeDatabase() {
    try {
        const client = await pool.connect();
        console.log('Connecté à la base de données PostgreSQL !');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, firstname TEXT NOT NULL,
                lastname TEXT NOT NULL, job TEXT, room_number TEXT
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS meals (
                id SERIAL PRIMARY KEY, user_email TEXT, date TEXT,
                meal_type TEXT, state TEXT, UNIQUE(user_email, date, meal_type)
            );
        `);
        client.release();
    } catch (err) {
        console.error('Erreur d\'initialisation de la base de données :', err.stack);
    }
}

initializeDatabase();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// --- API ---
app.post('/api/create-user', async (req, res) => {
    const { email, firstname, lastname, job, room_number } = req.body;
    try {
        const result = await pool.query('INSERT INTO users (email, firstname, lastname, job, room_number) VALUES ($1, $2, $3, $4, $5) RETURNING id', [email, firstname, lastname, job, room_number]);
        res.status(201).json({ message: 'Utilisateur créé !', id: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') res.status(409).json({ error: "Cet email est déjà utilisé." });
        else res.status(500).json({ error: 'Erreur serveur.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [req.body.email]);
        if (result.rows.length > 0) res.status(200).json({ message: 'Connexion réussie', user: result.rows[0] });
        else res.status(404).json({ error: 'Email non reconnu.' });
    } catch (err) { res.status(500).json({ error: 'Erreur serveur.' }); }
});

app.get('/api/get-users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users ORDER BY lastname, firstname');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Erreur serveur.' }); }
});

app.post('/api/save-meal', async (req, res) => {
    const { user_email, date, meal_type, state } = req.body;
    const query = `INSERT INTO meals (user_email, date, meal_type, state) VALUES ($1, $2, $3, $4) ON CONFLICT(user_email, date, meal_type) DO UPDATE SET state = excluded.state`;
    try {
        await pool.query(query, [user_email, date, meal_type, state]);
        res.json({ message: 'Repas sauvegardé !' });
    } catch (err) { res.status(500).json({ error: 'Erreur serveur.' }); }
});

app.get('/api/get-meals', async (req, res) => {
    try {
        const result = await pool.query('SELECT date, meal_type, state FROM meals WHERE user_email = $1', [req.query.user_email]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Erreur serveur.' }); }
});

app.get('/api/get-all-meals', async (req, res) => {
    try {
        const result = await pool.query('SELECT user_email, date, meal_type, state FROM meals');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Erreur serveur.' }); }
});

app.listen(port, () => console.log(`Serveur démarré sur le port ${port}`));