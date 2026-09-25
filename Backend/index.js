const express = require('express');
const cors = require('cors');
const {Pool} = require('pg');
const app = express()
app.use(express.json());
app.use(cors({origin: true,credentials:true}));
const connectionString = process.env.DB_KEY

const pool = new Pool({connectionString,});

const isValidDate = (value) => !Number.isNaN(Date.parse(value));



app.get('/api',async (req,res) => {
    try {
        const records = await pool.query(`
            SELECT
                b.id,
                b.name,
                b.location,
                b.fare,
                b.type,
                b.tags,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', s.id,
                            'slot_number', s.slot_number,
                            'vacant', s.vacant
                        ) ORDER BY s.slot_number
                    ) FILTER (WHERE s.id IS NOT NULL),
                    '[]'::json
                ) AS slots
            FROM buildings b
            LEFT JOIN parking_slots s ON s.building_id = b.id
            GROUP BY b.id
            ORDER BY b.id
        `);
        res.json(records.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({message:'could not load buildings'});
    }
})


app.post('/insert',async (req,res) => {
    const rec = req.body.data;
    console.log(rec);
    if (
        !rec ||
        typeof rec.name !== 'string' ||
        !rec.location ||
        typeof rec.location !== 'object' ||
        Array.isArray(rec.location) ||
        !Number.isInteger(rec.fare) ||
        typeof rec.type !== 'string' ||
        !Array.isArray(rec.tags) ||
        !rec.tags.every((tag) => typeof tag === 'string') ||
        !Number.isInteger(rec.slot_count) ||
        rec.slot_count < 1
    ) {
        return res.status(400).json({
            message: 'data must include name, location, fare, type, tags, and a positive slot_count',
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const building = await client.query(
            `INSERT INTO buildings (name, location, fare, type, tags)
             VALUES ($1, $2::jsonb, $3, $4, $5)
             RETURNING id`,
            [rec.name, rec.location, rec.fare, rec.type, rec.tags]
        );

        await client.query(
            `INSERT INTO parking_slots (building_id, slot_number, vacant)
             SELECT $1, slot_number, true
             FROM generate_series(1, $2) AS slot_number`,
            [building.rows[0].id, rec.slot_count]
        );

        await client.query('COMMIT');
        res.status(201).json({
            message:'inserted successfully',
            building_id: building.rows[0].id,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({message:'could not insert building'});
    } finally {
        client.release();
    }
})

app.get('/vacancy/:buildingId', async (req,res) => {
    const buildingId = Number.parseInt(req.params.buildingId, 10);
    const {start_time: startTime, end_time: endTime} = req.query;

    if (!Number.isInteger(buildingId) || buildingId < 1) {
        return res.status(400).json({message:'buildingId must be a positive integer'});
    }
    if ((startTime && !endTime) || (!startTime && endTime) ||
        (startTime && (!isValidDate(startTime) || !isValidDate(endTime)))) {
        return res.status(400).json({message:'start_time and end_time must be valid dates provided together'});
    }
    if (startTime && new Date(startTime) >= new Date(endTime)) {
        return res.status(400).json({message:'end_time must be after start_time'});
    }

    try {
        const query = startTime
            ? `
                SELECT s.id, s.slot_number, s.vacant
                FROM parking_slots s
                WHERE s.building_id = $1
                  AND s.vacant = true
                  AND NOT EXISTS (
                      SELECT 1
                      FROM bookings b
                      WHERE b.slot_id = s.id
                        AND b.status IN ('pending', 'confirmed')
                        AND tstzrange(b.start_time, b.end_time, '[)')
                            && tstzrange($2::timestamptz, $3::timestamptz, '[)')
                  )
                ORDER BY s.slot_number
            `
            : `
                SELECT s.id, s.slot_number, s.vacant
                FROM parking_slots s
                WHERE s.building_id = $1 AND s.vacant = true
                ORDER BY s.slot_number
            `;
        const values = startTime ? [buildingId, startTime, endTime] : [buildingId];
        const records = await pool.query(query, values);
        res.json(records.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({message:'could not load vacant slots'});
    }
})

app.post('/booking', async (req,res) => {
    const booking = req.body.data || req.body;
    const userId = booking?.user_id;
    const slotId = Number(booking?.slot_id);
    const {start_time: startTime, end_time: endTime} = booking || {};

    if (
        userId == null ||
        !Number.isInteger(slotId) ||
        slotId < 1 ||
        !isValidDate(startTime) ||
        !isValidDate(endTime) ||
        new Date(startTime) >= new Date(endTime)
    ) {
        return res.status(400).json({message:'user_id, slot_id, start_time, and end_time are required'});
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const slot = await client.query(
            'SELECT id, vacant FROM parking_slots WHERE id = $1 FOR UPDATE',
            [slotId]
        );
        if (slot.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({message:'parking slot not found'});
        }
        if (!slot.rows[0].vacant) {
            await client.query('ROLLBACK');
            return res.status(409).json({message:'parking slot is not vacant'});
        }

        const conflict = await client.query(
            `SELECT 1
             FROM bookings
             WHERE slot_id = $1
               AND status IN ('pending', 'confirmed')
               AND tstzrange(start_time, end_time, '[)')
                   && tstzrange($2::timestamptz, $3::timestamptz, '[)')
             LIMIT 1`,
            [slotId, startTime, endTime]
        );
        if (conflict.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({message:'parking slot is already booked for that time'});
        }

        const created = await client.query(
            `INSERT INTO bookings (user_id, slot_id, start_time, end_time, status, created_at)
             VALUES ($1, $2, $3, $4, 'confirmed', NOW())
             RETURNING id, user_id, slot_id, start_time, end_time, status, created_at`,
            [userId, slotId, startTime, endTime]
        );
        await client.query('COMMIT');
        res.status(201).json(created.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({message:'could not create booking'});
    } finally {
        client.release();
    }
})

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));