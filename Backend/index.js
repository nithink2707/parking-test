const express = require('express');
const cors = require('cors');
const {Pool} = require('pg');
const app = express()
app.use(cors({origin: true,credentials:true}));
const connectionString = 'postgresql://neondb_owner:npg_OXYTnAdWe85w@ep-holy-brook-b3lq6na9-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

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