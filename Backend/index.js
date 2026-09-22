const express = require('express');
const cors = require('cors');
const {Pool} = require('pg');
const app = express()
app.use(cors({origin: true,credentials:true}));
const connectionString = process.env.DB_KEY

const pool = new Pool({connectionString,});



app.get('/api',async (req,res) => {
    const records = await pool.query("SELECT data FROM buildings");
    console.log(records.rows);
    // res.json({data:records});
})

app.post('/insert',async (req,res) => {
    const rec = req.body();
    console.log(rec);
    await pool.query('INSERT INTO buildings (data) VALUES ($1::jsonb)',rec);
    res.json({message:'inserted succesfully'});
})

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));