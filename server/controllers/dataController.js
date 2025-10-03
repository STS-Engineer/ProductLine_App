const pool = require('../config/db');
// NEW: Import the file controller for file deletion logic
const { deleteFile } = require('./fileController'); 

// --- AUDITING FUNCTION (Centralized logging) ---
exports.logAction = async (action, table_name, document_id, user_id, user_name, details = {}) => {
    try {
        await pool.query(
            'INSERT INTO audit_logs (action, table_name, document_id, user_id, user_name, details) VALUES ($1, $2, $3, $4, $5, $6)',
            [action, table_name, document_id, user_id, user_name, details]
        );
    } catch (error) {
        console.error(`CRITICAL: Failed to write audit log for ${action} on ${table_name}/${document_id}. Error:`, error);
        // Do not throw, as a failed log should not crash the main operation
    }
};

const { logAction } = exports; // Reference for internal use

// --- DYNAMIC CRUD OPERATIONS (using tableName from server.js routes) ---

// GET All Items
exports.getAllItems = (tableName) => async (req, res) => {
// ... (No change) ...
    try {
        let orderByClause = 'ORDER BY id ASC';
        let whereClause = '';
        const queryParams = [];

        if (tableName === 'audit_logs') {
            // FIX APPLIED HERE: Filter out LOGIN and LOGOUT actions at the database level
            orderByClause = 'ORDER BY logged_at DESC';
            whereClause = "WHERE action NOT IN ('LOGIN', 'LOGOUT')";
        } else if (tableName === 'users' || tableName === 'product_lines' || tableName === 'products') {
            orderByClause = 'ORDER BY created_at DESC';
        }

        const result = await pool.query(`SELECT * FROM ${tableName} ${whereClause} ${orderByClause}`, queryParams);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(`Error fetching ${tableName}:`, error);
        res.status(500).json({ message: `Error fetching data for ${tableName}.` });
    }
};

// CREATE Item
exports.createItem = (tableName) => async (req, res) => {
    // Data from req.body (non-file fields) AND req.files (file paths)
    const data = req.body; 
    const userId = req.user.id;
    const userName = req.user.displayName;
    
    // 1. Process uploaded files from Multer and add path to data payload
    if (req.files) {
        // Check for product_pictures (Products)
        if (req.files.product_pictures && req.files.product_pictures[0]) {
            // Store the relative URL to access the file later: 'uploads/filename.ext'
            data.product_pictures = `uploads/${req.files.product_pictures[0].filename}`;
        }
        // Check for attachments_raw (Product Lines)
        if (req.files.attachments_raw && req.files.attachments_raw[0]) {
            data.attachments_raw = `uploads/${req.files.attachments_raw[0].filename}`;
        }
    }
    
    const columns = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    // Add columns for user and date tracking
    const userColumns = 'created_by, updated_by';
    const userPlaceholders = `$${values.length + 1}, $${values.length + 2}`;
    
    // Store path for potential cleanup
    const fileToDeleteOnRollback = data.product_pictures || data.attachments_raw;

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // 2. Insert into main table
        const insertQuery = `INSERT INTO ${tableName} (${columns}, ${userColumns}) VALUES (${placeholders}, ${userPlaceholders}) RETURNING *`;
        
        const result = await client.query(insertQuery, [...values, userId, userId]);
        const newItem = result.rows[0];

        // 3. Audit Log (DUAL-WRITE)
        await logAction('CREATE', tableName, newItem.id, userId, userName, data);

        await client.query('COMMIT'); // Commit transaction
        res.status(201).json(newItem);

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error(`Error creating ${tableName}:`, error);
        
        // CRITICAL: Cleanup uploaded files if transaction fails
        if (fileToDeleteOnRollback) {
            deleteFile(fileToDeleteOnRollback);
        }

        // Handle common PostgreSQL errors (e.g., unique constraint violation)
        if (error.code === '23505') {
            return res.status(409).json({ message: `A record with this unique name/ID already exists.` });
        }
        res.status(500).json({ message: `Error creating new ${tableName}.` });
    } finally {
        client.release();
    }
};

// UPDATE Item
exports.updateItem = (tableName) => async (req, res) => {
    const { id } = req.params;
    const data = req.body; // Contains non-file fields and file path if uploaded
    const userId = req.user.id;
    const userName = req.user.displayName;
    
    // Determine the specific file field for the current table
    const fileField = tableName === 'products' ? 'product_pictures' : 
                      tableName === 'product_lines' ? 'attachments_raw' : null;

    // 1. Process uploaded files from Multer and add path to data payload
    if (req.files && fileField) {
        if (req.files[fileField] && req.files[fileField][0]) {
            data[fileField] = `uploads/${req.files[fileField][0].filename}`;
        }
    }

    // Filter out server-managed columns. 'data' now contains new file path if uploaded.
    const allowedKeys = Object.keys(data).filter(key => 
        !['id', 'created_at', 'created_by', 'updated_at', 'updated_by'].includes(key)
    );

    if (allowedKeys.length === 0 && !req.files) {
        return res.status(400).json({ message: 'No valid fields or new file provided for update.' });
    }
    
    const setClauses = allowedKeys
        .map((key, i) => `${key} = $${i + 1}`)
        .join(', ');

    const values = allowedKeys.map(key => data[key]);
    
    // Append updated_at and updated_by to the end of SET clauses
    // userId is $N+1, id is $N+2 (where N is values.length)
    const totalValues = [...values, userId, id]; 
    const setClauseFinal = (setClauses ? `${setClauses}, ` : '') + `updated_at = NOW(), updated_by = $${values.length + 1}`;
    
    let oldFilePath = null; // Store old file path for cleanup after successful update
    let newFilePath = data[fileField]; // Path of the file uploaded NOW
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // 2. Get the old data for the audit log AND old file path
        // FIX: Only select the specific file field for this table
        const selectFields = fileField ? `*, ${fileField}` : '*';
        const oldDataResult = await pool.query(`SELECT ${selectFields} FROM ${tableName} WHERE id = $1`, [id]);
        const oldData = oldDataResult.rows[0] || {};
        
        // If a NEW file was uploaded (newFilePath is set)
        if (newFilePath && fileField) {
            oldFilePath = oldData[fileField];
        }

        // 3. Update main table
        const updateQuery = `UPDATE ${tableName} SET ${setClauseFinal} WHERE id = $${values.length + 2} RETURNING *`;
        const result = await pool.query(updateQuery, totalValues);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `${tableName} with ID ${id} not found.` });
        }
        
        // 4. FILE CLEANUP (Success): Delete the old file if a new one was successfully saved to DB
        if (oldFilePath && newFilePath) {
            deleteFile(oldFilePath);
        }

        // 5. Audit Log (DUAL-WRITE)
        await logAction('UPDATE', tableName, id, userId, userName, { oldData, newData: data });

        await client.query('COMMIT'); // Commit transaction
        res.status(200).json(result.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error(`Error updating ${tableName}:`, error);
        
        // CRITICAL: Cleanup the NEWLY uploaded file if the database update failed
        if (newFilePath) {
            deleteFile(newFilePath);
        }

        res.status(500).json({ message: `Error updating ${tableName}.` });
    } finally {
        client.release();
    }
};

// DELETE Item
exports.deleteItem = (tableName) => async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userName = req.user.displayName;

    // Determine the specific file field for the current table
    const fileField = tableName === 'products' ? 'product_pictures' : 
                      tableName === 'product_lines' ? 'attachments_raw' : null;
    
    const client = await pool.connect();
    let fileToDelete = null; 
    try {
        await client.query('BEGIN'); // Start transaction

        // 1. Get the record's file path before deletion
        let selectQuery = `SELECT * FROM ${tableName} WHERE id = $1`;
        
        // FIX: Conditionally select only the relevant file field if it exists
        if (fileField) {
            selectQuery = `SELECT ${fileField} FROM ${tableName} WHERE id = $1`;
        }
        
        const oldDataResult = await pool.query(selectQuery, [id]);
        const oldData = oldDataResult.rows[0];

        if (oldData && fileField) {
            fileToDelete = oldData[fileField]; // Use the determined file field
        }

        // 2. Delete from main table
        const result = await pool.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
        
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `${tableName} with ID ${id} not found.` });
        }
        
        // 3. FILE CLEANUP (Success)
        if (fileToDelete) {
            deleteFile(fileToDelete);
        }

        // 4. Audit Log (DUAL-WRITE)
        await logAction('DELETE', tableName, id, userId, userName, { status: 'Record permanently deleted.' });

        await client.query('COMMIT'); // Commit transaction
        res.status(204).send(); // HTTP 204 No Content for successful deletion

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error(`Error deleting ${tableName}:`, error);
        res.status(500).json({ message: `Error deleting ${tableName}.` });
    } finally {
        client.release();
    }
};
