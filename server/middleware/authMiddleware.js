// Pseudo-code: Assume Firebase Admin SDK is initialized and available via 'admin'
const admin = require('firebase-admin');

/**
 * Middleware to verify Firebase ID Token and attach user data to the request.
 */
const authenticate = async (req, res, next) => {
    // 1. Check for the Authorization header
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        console.warn("Authentication failed: No Bearer token.");
        return res.status(401).send({ error: 'Unauthorized: No token provided.' });
    }

    const token = header.split(' ')[1];
    
    try {
        // 2. Verify the Firebase ID Token
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // 3. Attach user info (UID and Name) to the request object
        req.user = {
            uid: decodedToken.uid,
            displayName: decodedToken.name || decodedToken.email || decodedToken.uid,
        };
        next(); // Proceed to the controller function
    } catch (error) {
        console.error("Token verification failed:", error.message);
        return res.status(401).send({ error: 'Unauthorized: Invalid or expired token.' });
    }
};

module.exports = authenticate;
