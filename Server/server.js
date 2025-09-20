const express = require('express');
const { Client } = require('pg'); // On utilise le pilote PostgreSQL
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Connexion à la base de données externe (Supabase) via l'URL d'environnement
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Fonction pour connecter et préparer les tables
async function initializeDatabase() {
    try {
        await client.connect();
        console.log('Connecté à la base de données PostgreSQL (Supabase) !');

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, firstname TEXT NOT NULL,
                lastname TEXT NOT NULL, job TEXT, room_number TEXT
            );
        `);
        console.log("Table 'users' prête.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS meals (
                id SERIAL PRIMARY KEY, user_email TEXT, date TEXT,
                meal_type TEXT, state TEXT, UNIQUE(user_email, date, meal_type)
            );
        `);
        console.log("Table 'meals' prête.");

    } catch (err) {
        console.error('Erreur d\'initialisation de la base de données :', err.stack);
    }
}
initializeDatabase();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// --- Toutes les routes de l'API (version PostgreSQL) ---
app.post('/api/login', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM users WHERE email = $1', [req.body.email]);
        if (result.rows.length > 0) res.status(200).json({ message: 'Connexion réussie', user: result.rows[0] });
        else res.status(404).json({ error: 'Email non reconnu.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/create-user', async (req, res) => {
    const { email, firstname, lastname, job, room_number } = req.body;
    try {
        const result = await client.query('INSERT INTO users (email, firstname, lastname, job, room_number) VALUES ($1, $2, $3, $4, $5) RETURNING id', [email, firstname, lastname, job, room_number]);
        res.status(201).json({ message: 'Utilisateur créé !', id: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') res.status(409).json({ error: "Cet email est déjà utilisé." });
        else res.status(500).json({ error: err.message });
    }
});

app.get('/api/get-users', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM users ORDER BY lastname, firstname');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/save-meal', async (req, res) => {
    const { user_email, date, meal_type, state } = req.body;
    const query = `INSERT INTO meals (user_email, date, meal_type, state) VALUES ($1, $2, $3, $4) ON CONFLICT(user_email, date, meal_type) DO UPDATE SET state = excluded.state`;
    try {
        await client.query(query, [user_email, date, meal_type, state]);
        res.json({ message: 'Repas sauvegardé !' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/get-meals', async (req, res) => {
    try {
        const result = await client.query('SELECT date, meal_type, state FROM meals WHERE user_email = $1', [req.query.user_email]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/get-all-meals', async (req, res) => {
    try {
        const result = await client.query('SELECT user_email, date, meal_type, state FROM meals');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, () => console.log(`Serveur démarré sur le port ${port}`));