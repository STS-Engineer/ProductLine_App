const db = require('../config/db'); // PostgreSQL connection pool

// Allowed collections for universal CRUD endpoints
const allowedCollections = ['product_lines', 'products', 'users', 'audit_logs'];

/**
 * Executes a dual-write: first to the main table, then to the audit_logs table.
 * @param {string} action - CREATE, UPDATE, DELETE
 * @param {string} table_name - The table being modified
 * @param {string} document_id - The ID of the record modified
 * @param {number} user_id - The ID of the user performing the action
 * @param {string} user_email - The email of the user
 * @param {object} details - Optional details about the change
 */
const logAction = async (action, table_name, document_id, user_id, user_email, details = {}) => {
    try {
        const query = `
            INSERT INTO public.audit_logs (action, table_name, document_id, user_id, user_email, details)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await db.query(query, [
            action, 
            table_name, 
            document_id, 
            user_id, 
            user_email, 
            JSON.stringify(details)
        ]);
    } catch (error) {
        console.error("CRITICAL: Failed to write audit log:", error.message);
    }
};

// --- CRUD Functions ---

const getItems = (req, res) => {
    const collectionName = req.params.collectionName;

    if (!allowedCollections.includes(collectionName)) {
        return res.status(400).json({ error: 'Invalid collection name.' });
    }

    // Sort audit logs by date descending
    const orderBy = collectionName === 'audit_logs' ? 'ORDER BY logged_at DESC' : '';
    
    db.query(`SELECT * FROM public.${collectionName} ${orderBy}`)
        .then(result => {
            res.json(result.rows);
        })
        .catch(error => {
            console.error(`Error fetching ${collectionName}:`, error.message);
            res.status(500).json({ error: `Failed to fetch ${collectionName} data.` });
        });
};

const createItem = async (req, res) => {
    const collectionName = req.params.collectionName;

    if (!allowedCollections.includes(collectionName) || collectionName === 'audit_logs' || collectionName === 'users') {
        return res.status(400).json({ error: 'Cannot create items on this collection via this route.' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        const fields = Object.keys(req.body);
        const values = Object.values(req.body);
        
        // Add created_by, updated_by, and created_at/updated_at fields
        fields.push('created_by', 'updated_by');
        values.push(req.user.id, req.user.id); 

        const placeholderIndices = fields.map((f, i) => `$${i + 1}`).join(', ');
        const fieldNames = fields.join(', ');

        const insertQuery = `
            INSERT INTO public.${collectionName} (${fieldNames})
            VALUES (${placeholderIndices})
            RETURNING *;
        `;

        const result = await client.query(insertQuery, values);
        const newItem = result.rows[0];
        
        // Log the action (Dual-Write)
        await logAction('CREATE', collectionName, newItem.id, req.user.id, req.user.email, req.body);

        await client.query('COMMIT'); // End transaction
        res.status(201).json(newItem);

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error(`Error creating item in ${collectionName}:`, error.message);
        res.status(500).json({ error: `Failed to create new ${collectionName} item. ${error.message}` });
    } finally {
        client.release();
    }
};

const updateItem = async (req, res) => {
    const collectionName = req.params.collectionName;
    const id = req.params.id;

    if (!allowedCollections.includes(collectionName) || collectionName === 'audit_logs' || collectionName === 'users') {
        return res.status(400).json({ error: 'Cannot update this collection via this route.' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // 1. Prepare Update Query
        const updates = req.body;
        const setClauses = [];
        const values = [];
        let index = 1;

        for (const key in updates) {
            setClauses.push(`${key} = $${index}`);
            values.push(updates[key]);
            index++;
        }

        // Add user and timestamp tracking
        setClauses.push(`updated_by = $${index}`, `updated_at = NOW()`);
        values.push(req.user.id);
        index++;
        
        values.push(id); // ID is the last parameter ($index)

        const updateQuery = `
            UPDATE public.${collectionName}
            SET ${setClauses.join(', ')}
            WHERE id = $${index}
            RETURNING *;
        `;

        const result = await client.query(updateQuery, values);
        
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Item not found.' });
        }
        
        const updatedItem = result.rows[0];

        // 2. Log the action (Dual-Write)
        await logAction('UPDATE', collectionName, id, req.user.id, req.user.email, updates);

        await client.query('COMMIT'); // End transaction
        res.status(200).json(updatedItem);

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error(`Error updating item in ${collectionName}:`, error.message);
        res.status(500).json({ error: `Failed to update ${collectionName} item. ${error.message}` });
    } finally {
        client.release();
    }
};

const deleteItem = async (req, res) => {
    const collectionName = req.params.collectionName;
    const id = req.params.id;

    if (!allowedCollections.includes(collectionName) || collectionName === 'audit_logs' || collectionName === 'users') {
        return res.status(400).json({ error: 'Cannot delete this collection via this route.' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        const deleteQuery = `
            DELETE FROM public.${collectionName}
            WHERE id = $1;
        `;

        const result = await client.query(deleteQuery, [id]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Item not found for deletion.' });
        }
        
        // Log the action (Dual-Write)
        await logAction('DELETE', collectionName, id, req.user.id, req.user.email, { message: 'Record deleted.' });

        await client.query('COMMIT'); // End transaction
        res.status(204).send(); // HTTP 204 No Content for successful deletion

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error(`Error deleting item in ${collectionName}:`, error.message);
        res.status(500).json({ error: `Failed to delete ${collectionName} item. ${error.message}` });
    } finally {
        client.release();
    }
};

module.exports = {
    getItems,
    createItem,
    updateItem,
    deleteItem,
    logAction // Exported for use by the auth controller
};
