const express = require('express');
const cors = require('cors');
const {Pool} = require('pg');
const app = express()
app.use(express.json());
app.use(cors({origin: true,credentials:true}));
const connectionString = process.env.DB_KEY

const pool = new Pool({connectionString,});



app.get('/api',async (req,res) => {
    try {
        const records = await pool.query("SELECT data FROM buildings");
        res.json(records.rows.map((record) => record.data));
    } catch (error) {
        console.error(error);
        res.status(500).json({message:'could not load buildings'});
    }
})

app.post('/insert',async (req,res) => {
    const rec = req.body.data
    console.log(rec);
    if (!rec || rec.name == null || rec.location == null) {
        return res.status(400).json({message:'name and location are required'});
    }

    try {
        await pool.query('INSERT INTO buildings (data) VALUES ($1::jsonb)',[rec]);
        res.json({message:'inserted successfully'});
    } catch (error) {
        console.error(error);
        res.status(500).json({message:'could not insert building'});
    }
})

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));