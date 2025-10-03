import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LogOut, Plus, Trash2, Save, X, Clock, Filter, Database, User, Mail, Zap, Loader, ChevronDown, Eye, Shield, FileText } from 'lucide-react'; // Removed 'Upload'
import Swal from "sweetalert2"; // Import SweetAlert2

// IMPORTANT: Update this to your deployed API server URL when moving off localhost
const BASE_API_URL = 'http://localhost:3001';

// List of columns managed by the server/database that should NOT be shown in forms or tables
const EXCLUDED_INTERNAL_COLUMNS = ['created_at', 'created_by', 'updated_at', 'updated_by', 'password_hash', 'product_line_id'];
const CHARACTER_EXPANSION_THRESHOLD = 30; // Threshold for long text fields in the modal

// --- Data Model Configuration based on PostgreSQL schema ---
const initialCollections = {
    product_lines: {
        name: 'Product Lines',
        apiPath: '/api/product_lines',
        filterableFields: ['name', 'product_line_manager', 'type_of_products'],
        // CRITICAL: attachments_raw is now a file path URL
        fields: ['id', 'name', 'type_of_products', 'manufacturing_locations', 'design_center', 'product_line_manager', 'history', 'type_of_customers', 'metiers', 'strength', 'weakness', 'perspectives', 'compliance_resource_id', 'attachments_raw', ...EXCLUDED_INTERNAL_COLUMNS],
        // Columns to show in the compact main table view (Removed capacity, gmdc_pct)
        compactFields: ['id', 'name', 'product_line_manager', 'type_of_products'],
        requiredFields: ['name', 'product_line_manager', 'type_of_products', 'manufacturing_locations', 'design_center', 'type_of_customers'],
        defaultValues: { name: '', type_of_products: '', product_line_manager: '', strength: '', weakness: '', attachments_raw: null }, // Initialize file field to null
        placeholder: { name: 'Engine Line X', type_of_products: 'Automotive', product_line_manager: 'Jane Doe' },
    },
    products: {
        name: 'Products',
        apiPath: '/api/products',
        filterableFields: ['product_name', 'product_line', 'capacity'],
        // CRITICAL: product_pictures is now a file path URL
        fields: ['id', 'product_name', 'product_line', 'description', 'product_definition', 'operating_environment', 'technical_parameters', 'machines_and_tooling', 'manufacturing_strategy', 'purchasing_strategy', 'prototypes_ppap_and_sop', 'engineering_and_testing', 'capacity', 'our_advantages', 'gmdc_pct', 'product_line_id', 'customers_in_production', 'customer_in_development', 'level_of_interest_and_why', 'estimated_price_per_product', 'prod_if_customer_in_china', 'costing_data', 'product_pictures', ...EXCLUDED_INTERNAL_COLUMNS],
        // Columns to show in the compact main table view
        compactFields: ['id', 'product_name', 'product_line', 'capacity', 'gmdc_pct'],
        requiredFields: ['product_name', 'product_line', 'capacity', 'gmdc_pct'],
        defaultValues: { product_name: '', product_line: '', description: '', capacity: '', gmdc_pct: 0.00, product_pictures: null }, // Initialize file field to null
        placeholder: { product_name: 'Sensor A1', product_line: 'Engine Line X', capacity: '1000/month', gmdc_pct: 35.50 },
    },
};

const collectionKeys = Object.keys(initialCollections);
const LOGS_API_PATH = '/api/audit_logs';


// --- Utility Functions ---

const formatTimestamp = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString();
    } catch (e) {
        return 'Invalid Date';
    }
};

const getFieldType = (field) => {
    if (field.includes('history') || field.includes('description') || field.includes('strategy') || field.includes('parameters') || field.includes('tooling') || field.includes('advantages') || field.includes('costing_data') || field.includes('definition') || field.includes('environment') || field.includes('locations') || field.includes('center') || field.includes('metiers') || field.includes('strength') || field.includes('weakness') || field.includes('perspectives') || field.includes('customers') || field.includes('prototypes_ppap_and_sop') || field.includes('engineering_and_testing')) return 'textarea';
    if (field.includes('gmdc_pct') || field.includes('estimated_price') || field.includes('capacity')) return 'number';
    if (field.includes('prod_if_customer_in_china')) return 'checkbox';
    // File/Image fields now map to the new file handling logic
    if (field.includes('product_pictures')) return 'file_image';
    if (field.includes('attachments_raw')) return 'file_attachment';

    return 'text';
};

// --- MODAL COMPONENT ---

const DetailModal = ({ isOpen, onClose, item, activeCollection, allProductLines, handleUpdate, isLoading, setApiError }) => {
    // CRITICAL: We need to ensure that item's file fields (which are strings/paths) are treated correctly.
    // When an input selects a file, we store the File object. Otherwise, it's the path string.
    const [formData, setFormData] = useState(item);
    const [expandedFields, setExpandedFields] = useState({});

    useEffect(() => {
        // Reset form data when item changes or modal opens
        setFormData({
            ...item,
            // Ensure numeric values are numbers for input type='number'
            gmdc_pct: item.gmdc_pct ? parseFloat(item.gmdc_pct) : 0.00
        });
        setExpandedFields({});
    }, [item, isOpen]);

    if (!isOpen) return null;

    const handleFieldChange = (field, value) => {
        // Correct handler for modal inputs
        const finalValue = field === 'gmdc_pct' ? parseFloat(value) : (field === 'prod_if_customer_in_china' ? value : value);
        setFormData(prev => ({ ...prev, [field]: finalValue }));
    };
    
    // CRITICAL CHANGE: Stores the native File object in state, signaling handleRequest to use FormData.
    const handleFileChange = (field, file) => {
        setFormData(prev => ({ ...prev, [field]: file }));
    };


    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validation Check (NOTE: File fields are optional unless specifically listed in requiredFields)
        const requiredCheck = activeCollection.requiredFields.every(field => {
            const value = formData[field];
            // Check for presence and ensure File objects are not erroneously validated as false
            return activeCollection.requiredFields.includes(field) ? !!value : true;
        });

        if (!requiredCheck) {
            Swal.fire('Validation Error', `Missing required fields: ${activeCollection.requiredFields.filter(field => !formData[field]).join(', ')}`, 'warning');
            return;
        }

        // Call the main update handler passed from App
        handleUpdate(formData.id, formData);
    };

    const isProduct = activeCollection.name === 'Products';

    const renderInput = (field, label, type, isRequired) => {
        const baseClass = "p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm w-full";
        const currentValue = formData[field] || ''; // Can be string (path) or File object
        const isLongText = type === 'textarea';
        const isExpanded = isLongText && (String(currentValue).length > CHARACTER_EXPANSION_THRESHOLD || expandedFields[field]);

        
        if (isProduct && field === 'product_line') {
             return (
                 <div className="relative flex flex-col">
                     <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                     <select
                         value={currentValue}
                         onChange={(e) => handleFieldChange(field, e.target.value)}
                         required={isRequired}
                         className={`${baseClass} appearance-none pr-8`}
                         disabled={isLoading}
                     >
                         <option value="" disabled>-- Select a Product Line --</option>
                         {allProductLines.map(pl => (
                             <option key={pl.id} value={pl.name}>
                                 {pl.name}
                             </option>
                         ))}
                     </select>
                     <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 bottom-3 pointer-events-none" />
                 </div>
             );
        }

        if (isLongText) {
             // Textarea with expansion logic
             const rowCount = isExpanded ? 6 : 2;
             const canExpand = String(currentValue).length > CHARACTER_EXPANSION_THRESHOLD;
             return (
                 <div className={`relative flex flex-col ${isExpanded ? 'col-span-full' : 'col-span-1'}`}>
                     <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                     <textarea
                         rows={rowCount}
                         value={currentValue}
                         onChange={(e) => handleFieldChange(field, e.target.value)}
                         required={isRequired}
                         className={baseClass}
                         disabled={isLoading}
                     />
                     {canExpand && (
                         <button 
                             type="button"
                             onClick={() => setExpandedFields(prev => ({ ...prev, [field]: !prev[field] }))}
                             className="text-indigo-500 text-xs mt-1 self-start hover:text-indigo-700 transition"
                         >
                             {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
                         </button>
                     )}
                 </div>
             );
        }
        
        if (type === 'file_image' || type === 'file_attachment') {
            const isImage = type === 'file_image';
            const fileData = formData[field]; // Can be a string (path) or a File object
            
            // Determine the state of the file field
            const isPath = typeof fileData === 'string' && fileData.startsWith('uploads/');
            const isNewFile = fileData && fileData instanceof File;
            const hasData = isPath || isNewFile;

            
            const handleFileSelect = (e) => {
                const file = e.target.files[0];
                handleFileChange(field, file);
                // Clear the input value to allow re-selection of the same file
                e.target.value = null; 
            };

            const handleView = () => {
                // If it's a new file, we can't view it yet (it's not on the server)
                if (isNewFile) {
                     Swal.fire('File Not Uploaded', 'This is a new file selection. It will be viewable after you click "Save Changes".', 'info');
                     return;
                }
                
                if (!isPath) return;

                const rawFileUrl = `${BASE_API_URL}/${fileData}`; // Construct the full URL
                const fileName = fileData.substring(fileData.lastIndexOf('/') + 1);
                
                // CRITICAL FIX: Determine file type for conditional viewing method
                const isCommonImage = isImage && (fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) !== null);
                
                const isOfficeFile = fileName.toLowerCase().match(/\.(docx|xlsx|pptx|doc|xls|ppt)$/) !== null;

                let viewerUrl = rawFileUrl;
                let viewerNote = 'If the file doesn\'t display above, your browser may not support direct viewing of this file type.';
                
                if (isOfficeFile) {
                    // Use Google Docs Viewer for unsupported Office formats (requires public URL access)
                    viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(rawFileUrl)}&embedded=true`;
                    viewerNote = 'Microsoft Office files are being displayed via Google Docs Viewer. This requires your backend server to be publicly accessible.';
                }


                if (isCommonImage) {
                    // 1. IMAGE DISPLAY (Existing logic for direct image URL)
                    Swal.fire({
                        title: `${label} Preview`,
                        imageUrl: rawFileUrl,
                        imageAlt: label,
                        width: 800,
                        imageWidth: '90%', 
                        imageHeight: 'auto', 
                        padding: '1em',
                        showCloseButton: true,
                        showConfirmButton: false,
                        customClass: {
                            image: 'object-contain h-auto'
                        }
                    });
                } else {
                    // 2. DOCUMENT/GENERAL ATTACHMENT DISPLAY (Using Iframe)
                    Swal.fire({
                        title: `${label} Review: ${fileName}`,
                        html: `
                            <div style="width: 100%; height: 60vh; border: 1px solid #ccc; background-color: #eee;">
                                <iframe 
                                    src="${viewerUrl}" 
                                    style="width: 100%; height: 100%; border: none;" 
                                    title="${fileName} Viewer"
                                    sandbox="allow-scripts allow-same-origin allow-popups"
                                >
                                </iframe>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">
                                ${viewerNote} You can right-click the file in the viewer or <a href="${rawFileUrl}" target="_blank" download class="text-indigo-600 hover:text-indigo-800 font-semibold">click here to download it</a>.
                            </p>
                        `,
                        width: '90%', // Use a large width for better document viewing
                        showCloseButton: true,
                        showConfirmButton: false,
                        customClass: {
                            container: 'swal2-container-large-iframe',
                            popup: 'swal2-popup-large',
                            title: 'text-lg',
                        },
                        allowOutsideClick: true,
                        allowEscapeKey: true,
                    });
                }
            };

            return (
                <div className="relative flex flex-col col-span-full">
                    <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                    <div className="flex space-x-2">
                        <input
                            type="file"
                            accept={isImage ? "image/*" : "*/*"}
                            onChange={handleFileSelect}
                            // key prop ensures input resets when state changes from File to null
                            key={isPath ? fileData : (isNewFile ? fileData.name : 'empty')} 
                            className={`${baseClass} p-1 text-sm file:mr-4 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100`}
                            disabled={isLoading}
                        />
                        {/* The button appears if there is any data (path or new file) */}
                        {hasData && (
                            <button
                                type="button"
                                onClick={handleView}
                                className={`p-2 rounded-lg transition flex items-center ${isPath ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-300 text-gray-700 cursor-not-allowed'}`}
                                title={isPath ? 'View Loaded Data' : 'File not uploaded yet. Save to view.'}
                                disabled={isNewFile} // Disable the view button if it's only a new file object
                            >
                                {/* Use Eye for images, FileText for general attachments */}
                                {isImage ? <Eye className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                            </button>
                        )}
                        {/* Clear button shows if there is ANY data (path or new file) */}
                        {hasData && (
                            <button
                                type="button"
                                onClick={() => handleFileChange(field, null)} // Clear button
                                className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center"
                                title="Clear File/Link"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    {isPath && <p className="text-xs text-green-600 mt-1">Current File Link: {fileData}</p>}
                    {isNewFile && <p className="text-xs text-blue-600 mt-1">New File Selected: {fileData.name}</p>}
                    {!hasData && <p className="text-xs text-gray-500 mt-1">No file currently attached.</p>}
                </div>
            );
        }

        if (type === 'checkbox') {
             // Checkbox logic
             return (
                 <div className="flex items-center space-x-2 p-2 col-span-full">
                     <input
                         type="checkbox"
                         id={`modal-${field}`}
                         checked={!!currentValue}
                         onChange={(e) => handleFieldChange(field, e.target.checked)}
                         className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                         disabled={isLoading}
                     />
                     <label htmlFor={`modal-${field}`} className="text-sm font-medium text-gray-700">{label}</label>
                 </div>
             );
        }

        return (
            <div className="relative flex flex-col">
                <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                <input
                    type={type}
                    step={type === 'number' ? '0.01' : 'any'}
                    value={currentValue}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    required={isRequired}
                    className={baseClass}
                    disabled={isLoading}
                />
            </div>
        );
    };

    // Filter out internal columns, but include ID for viewing
    const displayFields = activeCollection.fields.filter(field => !EXCLUDED_INTERNAL_COLUMNS.includes(field));

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Eye className="w-5 h-5 mr-2 text-indigo-500" />
                        Edit/View: {item.id ? activeCollection.name.slice(0, -1) : ''} (ID: {item.id ? String(item.id).substring(0, 8) : 'N/A'})
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayFields.filter(f => f !== 'id').map(field => {
                            const label = field.toUpperCase().replace(/_/g, ' ');
                            const type = getFieldType(field);
                            const isRequired = activeCollection.requiredFields.includes(field);
                            
                            return (
                                <React.Fragment key={field}>
                                    {renderInput(field, label, type, isRequired)}
                                </React.Fragment>
                            );
                        })}
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center"
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- AUTHENTICATION SCREEN ---
// CRITICAL FIX: Ensure all props are correctly destructured in LoginScreen function signature
const LoginScreen = ({ setAuthToken, setUserData, setIsLoading, isLoading }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isSigningUp, setIsSigningUp] = useState(false);
    const [error, setError] = useState(null);

    const handleAuth = async (endpoint, payload) => {
        // FIX: setIsLoading is now correctly defined via props
        setIsLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${BASE_API_URL}/api/auth/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.message && data.message.includes('secretOrPrivateKey')) {
                    throw new Error("Authentication failed. Backend JWT_SECRET not configured.");
                }
                throw new Error(data.message || `Authentication failed with status ${response.status}`);
            }
            
            setAuthToken(data.token);
            setUserData(data.user);
            sessionStorage.setItem('authToken', data.token);
            sessionStorage.setItem('userData', JSON.stringify(data.user));

        } catch (err) {
            console.error(`${endpoint} error:`, err);
            setError(err.message || 'An unknown error occurred.');
        } finally {
            // FIX: setIsLoading is now correctly defined via props
            setIsLoading(false);
        }
    };

    const handleSignup = (e) => {
        e.preventDefault();
        handleAuth('signup', { email, password, displayName });
    };

    const handleLogin = (e) => {
        e.preventDefault();
        handleAuth('login', { email, password });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 space-y-6">
                <h1 className="text-3xl font-bold text-center text-indigo-700 flex items-center justify-center">
                    <Database className="w-8 h-8 mr-2 text-indigo-500" />
                    {isSigningUp ? 'Create Account' : 'RFQ Data'}
                </h1>
                
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                <form onSubmit={isSigningUp ? handleSignup : handleLogin} className="space-y-4">
                    {isSigningUp && (
                        <div className="relative">
                            <User className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Display Name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                required={isSigningUp}
                                className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                disabled={isLoading}
                            />
                        </div>
                    )}
                    <div className="relative">
                        <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                            <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="relative">
                        <Zap className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={isLoading}
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition duration-150 flex items-center justify-center disabled:opacity-50 shadow-md shadow-indigo-300"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <Loader className="w-5 h-5 animate-spin mr-2" />
                        ) : isSigningUp ? 'Sign Up' : 'Log In'}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-600">
                    {isSigningUp ? (
                        <>
                            Already have an account?{' '}
                            <button onClick={() => setIsSigningUp(false)} className="text-indigo-600 font-medium hover:text-indigo-800">
                                Log In
                            </button>
                        </>
                    ) : (
                        <>
                            Need an account?{' '}
                            <button onClick={() => setIsSigningUp(true)} className="text-indigo-600 font-medium hover:text-indigo-800">
                                Sign Up
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
};

// --- MAIN APPLICATION COMPONENT ---
const App = () => {
    const [authToken, setAuthToken] = useState(sessionStorage.getItem('authToken'));
    const [userData, setUserData] = useState(() => {
        const storedUser = sessionStorage.getItem('userData');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    // NEW STATE: Tracks if this is the very first load (used to control initial spinner)
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const [items, setItems] = useState([]);
    const [allProductLines, setAllProductLines] = useState([]);
    const [logs, setLogs] = useState([]);
    const [activeCollectionKey, setActiveCollectionKey] = useState(collectionKeys[0]);
    
    const [newItemData, setNewItemData] = useState(initialCollections[activeCollectionKey].defaultValues);
    const [logFilterTerm, setLogFilterTerm] = useState('');
    const [itemFilterTerm, setItemFilterTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState(null);

    // --- MODAL STATE ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState(null);

    // --- FORM STATE (NEW) ---
    const [isFormVisible, setIsFormVisible] = useState(false);

    // --- FILTER STATE ---
    const [activeFilterField, setActiveFilterField] = useState(null);
    
    const activeCollection = initialCollections[activeCollectionKey];

    // Check if the current user is an admin (CRITICAL FIX)
    const isAdmin = userData && userData.user_role === 'admin';

    // Handler for logout (made a useCallback to be stable dependency for fetchData)
    const handleLogout = useCallback(async () => {
        if (authToken) {
            try {
                await fetch(`${BASE_API_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                    }
                });
                console.log("Logout action logged successfully.");
            } catch (error) {
                console.error("Failed to log out action on server:", error);
            }
        }
        
        setAuthToken(null);
        setUserData(null);
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        setItems([]);
        setLogs([]);
    }, [authToken]);


    // Reset new item data when collection switches
    useEffect(() => {
        setNewItemData(initialCollections[activeCollectionKey].defaultValues);
        setIsFormVisible(false); // Hide form on collection switch
    }, [activeCollectionKey]);


    // 1. Data Fetching (Simulates GET request to API)
    // CRITICAL FIX: Added isUserAction parameter to control when to show loading overlay.
    const fetchData = useCallback(async (isUserAction = false) => {
        if (!authToken || !userData) {
            setIsLoading(false);
            return;
        }
        
        // CRITICAL FIX: Only set isLoading=true if it's the very first load OR a user-initiated action (CRUD callback).
        if (isInitialLoad || isUserAction) { 
            setIsLoading(true);
        }
        setApiError(null);

        try {
            // Fetch main data and logs
            const mainDataPromise = fetch(`${BASE_API_URL}${activeCollection.apiPath}`, { 
                headers: { Authorization: `Bearer ${authToken}` }
            });
            const logsPromise = fetch(`${BASE_API_URL}${LOGS_API_PATH}`, { 
                headers: { Authorization: `Bearer ${authToken}` }
            });
            // Always fetch product lines for the relational dropdown filter
            const plPromise = fetch(`${BASE_API_URL}${initialCollections.product_lines.apiPath}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });

            const [itemsResponse, logsResponse, plResponse] = await Promise.all([mainDataPromise, logsPromise, plPromise]);

            if (!itemsResponse.ok) throw new Error(`Failed to fetch ${activeCollection.name} data.`);
            if (!logsResponse.ok) throw new Error(`Failed to fetch Audit Logs.`);
            if (!plResponse.ok) throw new Error(`Failed to fetch Product Lines data.`);

            const fetchedItems = await itemsResponse.json();
            const fetchedLogs = await logsResponse.json();
            const fetchedProductLines = await plResponse.json();

            setItems(fetchedItems);
            setAllProductLines(fetchedProductLines);
            
            fetchedLogs.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
            setLogs(fetchedLogs);
            
        } catch (error) {
            console.error("Error fetching data:", error);
            if (error.message.includes('Failed to fetch') || error.message.includes('Invalid or expired token')) {
                handleLogout(); 
                setApiError("Session expired or API unreachable. Please log in again.");
            } else {
                setApiError(error.message || "Failed to fetch data from API. Check server status.");
            }
        } finally {
            // CRITICAL FIX: Only disable loading after the initial load, OR after a user-initiated action.
            if (isInitialLoad || isUserAction) { 
                setIsLoading(false);
                setIsInitialLoad(false);
            }
        }
    }, [activeCollectionKey, authToken, userData, isInitialLoad, activeCollection.apiPath, activeCollection.name, handleLogout]); 


    // Initial fetch and polling setup
    useEffect(() => {
        // Initial fetch: Call with true to show loading spinner once.
        fetchData(true); 
        
        // The interval continues to run, but calls fetchData(false) so it bypasses
        // the setIsLoading(true/false) logic inside fetchData, preventing the greying effect.
        const interval = setInterval(() => fetchData(false), 10000); 
        return () => clearInterval(interval);
    }, [fetchData]);


    // --- CRUD Handlers ---

    // CRITICAL CHANGE: handleRequest now detects File objects and sends FormData
    const handleRequest = async (method, path, body = null, successCallback = () => {}) => {
        if (!authToken) return;
        // Keep this set to true for user-initiated actions (CRUD)
        setIsLoading(true); 
        setApiError(null);

        const fileFields = ['attachments_raw', 'product_pictures'];
        // Check for presence of a File object in the body
        const hasFile = body && fileFields.some(field => body[field] && body[field] instanceof File);

        let headers = {};
        let requestBody = null;

        if (hasFile) {
            // Use FormData for file upload
            const formData = new FormData();
            
            for (const key in body) {
                // IMPORTANT: Send the File object with its field name
                if (fileFields.includes(key) && body[key] instanceof File) {
                    formData.append(key, body[key], body[key].name);
                } 
                // Don't send null/undefined files or ID in the body payload
                else if (body[key] !== null && key !== 'id') { 
                    // Stringify non-file objects/numbers for FormData if necessary, 
                    // though most primitive types are handled fine.
                    formData.append(key, body[key]);
                }
            }
            // Headers must NOT contain 'Content-Type': 'application/json' for Multer/FormData
            headers = { 'Authorization': `Bearer ${authToken}` };
            requestBody = formData;
        } else {
            // Use JSON for standard data
            headers = { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            };
            // Ensure we remove 'id' from the JSON body for PUT/POST
            const jsonBody = body ? Object.keys(body).reduce((acc, key) => {
                if (key !== 'id') acc[key] = body[key];
                return acc;
            }, {}) : null;
            requestBody = jsonBody ? JSON.stringify(jsonBody) : null;
        }

        try {
            const response = await fetch(`${BASE_API_URL}${path}`, {
                method: method,
                headers: headers,
                body: requestBody,
            });

            if (!response.ok) {
                const errorData = response.status !== 204 ? await response.json() : {};
                throw new Error(errorData.message || `API call failed with status ${response.status}.`);
            }

            // Success Notification
            if (method === 'POST') {
                Swal.fire('Created!', `${activeCollection.name.slice(0, -1)} successfully created.`, 'success');
            } else if (method === 'PUT') {
                 Swal.fire('Updated!', `${activeCollection.name.slice(0, -1)} successfully updated.`, 'success');
            } else if (method === 'DELETE') {
                 Swal.fire('Deleted!', `${activeCollection.name.slice(0, -1)} permanently removed.`, 'success');
            }

            successCallback();
            // CRITICAL FIX: Call fetchData(true) to trigger a data refresh AND show the loading spinner during the refresh.
            fetchData(true); 

        } catch (error) {
            console.error(`Error during ${method} operation:`, error);
            // Display error notification
            Swal.fire('Error!', `${error.message}`, 'error');
            setApiError(error.message || "An unknown error occurred during API operation.");
        } finally {
            setIsLoading(false);
        }
    };


    const handleCreate = (e) => {
        e.preventDefault();
        
        // --- Validation Check ---
        const requiredCheck = activeCollection.requiredFields.every(field => {
            const value = newItemData[field];
            // Checkbox fields are optional and default to false
            return activeCollectionKey === 'products' && field === 'prod_if_customer_in_china' ? true : !!value;
        });
        
        if (!requiredCheck) {
             setApiError(`Missing required fields: ${activeCollection.requiredFields.filter(field => !newItemData[field]).join(', ')}`);
             return;
        }
        
        // --- DATA PREPARATION BEFORE SENDING ---
        let itemToCreate = { ...newItemData };

        // Whitelist keys based on the active collection's defined fields
        const allowedFields = activeCollection.fields.filter(field => !EXCLUDED_INTERNAL_COLUMNS.includes(field));
        
        const finalPayload = Object.keys(itemToCreate).reduce((acc, key) => {
            if (allowedFields.includes(key)) { 
                // File objects are kept as is (they signal FormData upload)
                if (itemToCreate[key] instanceof File) {
                    acc[key] = itemToCreate[key];
                } 
                // Handle numeric conversion for the database
                else if (key === 'gmdc_pct' || key === 'estimated_price') {
                     acc[key] = parseFloat(itemToCreate[key]);
                } 
                // Include other data, including path strings or null for non-file data
                else {
                    acc[key] = itemToCreate[key];
                }
            }
            return acc;
        }, {});
        
        // Database Type Specific ID Handling
        delete finalPayload.id; // Let PostgreSQL auto-generate BIGINT
        
        // --- END DATA PREPARATION ---

        handleRequest(
            'POST', 
            activeCollection.apiPath, 
            finalPayload, 
            () => { 
                setNewItemData(initialCollections[activeCollectionKey].defaultValues);
                setIsFormVisible(false); // Hide form on successful creation
            }
        );
    };

    const handleUpdate = (id, formData) => {
        
        // --- DATA PREPARATION BEFORE SENDING (Similar to create) ---
        const allowedFields = activeCollection.fields.filter(field => !EXCLUDED_INTERNAL_COLUMNS.includes(field));
        
        const finalPayload = Object.keys(formData).reduce((acc, key) => {
            if (allowedFields.includes(key)) { 
                // File objects are kept as is (they signal FormData upload)
                if (formData[key] instanceof File) {
                    acc[key] = formData[key];
                } 
                // Handle numeric conversion
                else if (key === 'gmdc_pct' || key === 'estimated_price') {
                     acc[key] = parseFloat(formData[key]);
                }
                // Include other data, including path strings or null for non-file data
                else {
                    acc[key] = formData[key];
                }
            }
            return acc;
        }, {});
        
        // --- END DATA PREPARATION ---

        handleRequest(
            'PUT', 
            `${activeCollection.apiPath}/${id}`, 
            finalPayload, // The ID will be used from the URL path
            () => { // Success callback
                setModalData(null);
                setIsModalOpen(false);
            }
        );
    };

    const handleDelete = (id) => {
        // --- SWEETALERT2 CONFIRMATION ---
        Swal.fire({
            title: 'Are you sure?',
            text: `You are about to delete this ${activeCollection.name.slice(0, -1)}. This action is permanent and will be logged.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                handleRequest('DELETE', `${activeCollection.apiPath}/${id}`);
            }
        });
    };
    
    // --- UI State Handlers ---

    // Opens modal and sets data for viewing/editing
    const openModalForEdit = (item) => {
        setModalData(item);
        setIsModalOpen(true);
    };

    const handleCollectionSwitch = (key) => {
        setActiveCollectionKey(key);
        setItemFilterTerm('');
        setActiveFilterField(null); // Reset filter field when switching collections
        setIsFormVisible(false); // Hide form on switch
    };
    
    // Handler used by inputs in the New Item Form
    const handleNewItemChange = (field, value) => {
        // CRITICAL CHANGE: Handle File object storage
        if (value instanceof File) {
             setNewItemData(prev => ({ ...prev, [field]: value }));
             return;
        }
        
        const finalValue = field === 'gmdc_pct' ? parseFloat(value) : (field === 'prod_if_customer_in_china' ? value : value);
        setNewItemData(prev => ({ ...prev, [field]: finalValue }));
    };
    
    // Handler for form cancellation
    const cancelForm = () => {
        setNewItemData(initialCollections[activeCollectionKey].defaultValues);
        setIsFormVisible(false);
    };


    // --- Filtering Logic (Client-Side) ---
    
    const uniqueFilterValues = useMemo(() => {
        if (!activeFilterField) return [];
        const values = items.map(item => item[activeFilterField]).filter(Boolean);
        return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
    }, [items, activeFilterField]);

    const filteredItems = useMemo(() => {
        const term = itemFilterTerm.toLowerCase().trim();
        let filtered = items;

        if (activeFilterField && term) {
            filtered = filtered.filter(item => 
                String(item[activeFilterField]).toLowerCase() === term
            );
        } else if (!activeFilterField && term) {
            const displayFields = activeCollection.fields.filter(field => !EXCLUDED_INTERNAL_COLUMNS.includes(field));

            filtered = filtered.filter(item => 
                displayFields.some(key => 
                    String(item[key]).toLowerCase().includes(term)
                )
            );
        }

        return filtered;
    }, [items, itemFilterTerm, activeFilterField, activeCollection.fields]);

    const filteredLogs = useMemo(() => {
        const term = logFilterTerm.toLowerCase().trim();
        if (!term) return logs.filter(log => log.action !== 'LOGIN' && log.action !== 'LOGOUT');
        
        const excludedActions = ['LOGIN', 'LOGOUT'];

        return logs.filter(log => !excludedActions.includes(log.action)).filter(log => 
            (log.action?.toLowerCase().includes(term)) ||
            (log.table_name?.toLowerCase().includes(term)) ||
            (log.user_name?.toLowerCase().includes(term)) ||
            (String(log.document_id)?.toLowerCase().includes(term))
        );
    }, [logs, logFilterTerm]);

    // --- Render Functions ---
    
    const renderHeader = () => (
        <header className="bg-gray-800 p-4 shadow-lg flex justify-between items-center flex-wrap">
            <h1 className="text-2xl font-extrabold text-indigo-400 flex items-center">
                <Database className="inline-block mr-2 h-6 w-6 text-indigo-400" />
                RFQ StreamLine
            </h1>
            <div className="text-right flex items-center space-x-4 mt-2 sm:mt-0">
                <span className="text-sm font-medium text-gray-300 truncate max-w-xs flex items-center">
                    User: **{userData.displayName}** ({userData.id}) 
                    {/* Role Indicator */}
                    {isAdmin && <Shield className="w-4 h-4 ml-2 text-yellow-400 inline" title="Administrator Access" />}
                </span>
                <button
                    onClick={handleLogout}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-150 shadow-md flex items-center text-sm font-semibold"
                >
                    <LogOut className="w-4 h-4 mr-1" />
                    Logout
                </button>
            </div>
        </header>
    );

    const renderItemForm = () => (
        <div className={`bg-white p-6 rounded-xl shadow-xl transition-all duration-300 ease-in-out overflow-hidden mt-6 ${isFormVisible ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0 p-0'}`}>
            <form onSubmit={handleCreate} className="space-y-4">
                <h2 className="text-xl font-bold text-gray-700 mb-4">Add New {activeCollection.name.slice(0, -1)}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {activeCollection.fields.filter(f => f !== 'id' && !EXCLUDED_INTERNAL_COLUMNS.includes(f)).map(field => {
                        const type = getFieldType(field);
                        const isRequired = activeCollection.requiredFields.includes(field);
                        const label = field.toUpperCase().replace(/_/g, ' ');
                        const baseClass = "p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm";
                        
                        // --- RELATIONAL DROPDOWN FOR PRODUCTS ---
                        if (activeCollectionKey === 'products' && field === 'product_line') {
                            return (
                                <div key={field} className="relative flex flex-col">
                                    <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                                    <select
                                        value={newItemData[field] || ''}
                                        onChange={(e) => handleNewItemChange(field, e.target.value)}
                                        required={isRequired}
                                        className={`${baseClass} appearance-none pr-8`}
                                        disabled={isLoading}
                                    >
                                        <option value="" disabled>-- Select a Product Line --</option>
                                        {allProductLines.map(pl => (
                                            <option key={pl.id} value={pl.name}>
                                                {pl.name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 bottom-3 pointer-events-none" />
                                </div>
                            );
                        }
                        // --- FILE INPUTS (IMAGE/ATTACHMENT) ---
                        if (type === 'file_image' || type === 'file_attachment') {
                            const isImage = type === 'file_image';
                            
                            const handleFileSelect = (e) => {
                                const file = e.target.files[0];
                                // CRITICAL: Call handler with the File object
                                handleNewItemChange(field, file);
                                // Clear the input value to allow re-selection of the same file
                                e.target.value = null; 
                            };
                            
                            const currentFile = newItemData[field]; // This will be a File object or null
                            
                            return (
                                <div key={field} className="relative flex flex-col col-span-full">
                                    <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                                    <input
                                        type="file"
                                        accept={isImage ? "image/*" : "*/*"}
                                        onChange={handleFileSelect}
                                        key={currentFile ? currentFile.name : 'empty'} // Key hack to reset input when file is cleared
                                        className={`${baseClass} p-1 text-sm file:mr-4 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100`}
                                        disabled={isLoading}
                                    />
                                    {currentFile && currentFile instanceof File && (
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-xs text-blue-600">New File Selected: {currentFile.name}</p>
                                            <button
                                                type="button"
                                                onClick={() => handleNewItemChange(field, null)}
                                                className="text-red-500 text-xs hover:text-red-700"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    )}
                                    {!currentFile && <p className="text-xs text-gray-500 mt-1">No file currently selected.</p>}
                                </div>
                            );
                        }

                        // --- TEXTAREA FOR LONG FIELDS ---
                        if (type === 'textarea') {
                            return (
                                <div key={field} className="relative flex flex-col col-span-full sm:col-span-2">
                                    <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                                    <textarea
                                        rows="2"
                                        placeholder={activeCollection.placeholder[field] || label}
                                        value={newItemData[field] || ''}
                                        onChange={(e) => handleNewItemChange(field, e.target.value)}
                                        required={isRequired}
                                        className={`${baseClass}`}
                                        disabled={isLoading}
                                    />
                                </div>
                            );
                        }
                        // --- CHECKBOX FOR BOOLEAN FIELDS ---
                        if (type === 'checkbox') {
                             return (
                                 <div key={field} className="flex items-center space-x-2">
                                     <input
                                         type="checkbox"
                                         id={`new-${field}`}
                                         checked={!!newItemData[field]}
                                         onChange={(e) => handleNewItemChange(field, e.target.checked)}
                                         className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                         disabled={isLoading}
                                     />
                                     <label htmlFor={`new-${field}`} className="text-sm font-medium text-gray-700">{label}</label>
                                 </div>
                             );
                        }
                        
                        // --- DEFAULT INPUT (TEXT/NUMBER) ---
                        return (
                            <div key={field} className="relative flex flex-col">
                                 <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                                <input
                                    type={type}
                                    step={type === 'number' ? '0.01' : 'any'}
                                    placeholder={activeCollection.placeholder[field] || label}
                                    value={newItemData[field] || ''}
                                    onChange={(e) => handleNewItemChange(field, e.target.value)}
                                    required={isRequired}
                                    className={baseClass}
                                    disabled={isLoading}
                                />
                            </div>
                        );
                    })}
                </div>
                
                {/* Form Actions (FIXED: Always present inside the collapsing div for all forms) */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                        type="button"
                        onClick={cancelForm}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                        disabled={isLoading}
                    >
                        <X className="w-5 h-5 mr-2 inline" /> Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition duration-150 flex items-center justify-center disabled:opacity-50 shadow-md"
                    >
                        {isLoading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                        ) : (
                            <Save className="w-5 h-5 mr-2" />
                        )}
                        {isLoading ? 'Saving...' : `Save ${activeCollection.name.slice(0, -1)}`}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderItemsTable = () => (
        <div className="bg-white p-6 rounded-xl shadow-xl mt-6 overflow-x-auto">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 className="2xl font-bold text-gray-800 flex items-center">
                    {activeCollection.name} Data
                    <span className="ml-2 text-sm font-medium text-indigo-500 p-1 bg-indigo-50 rounded-full">{items.length} items</span>
                </h2>
                
                {/* Toggle Create Form Button */}
                <button
                    onClick={() => setIsFormVisible(prev => !prev)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-md transition duration-150 flex items-center ${isFormVisible ? 'bg-gray-400 hover:bg-gray-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                    disabled={isLoading}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    {isFormVisible ? 'Collapse Form' : `Add New ${activeCollection.name.slice(0, -1)}`}
                </button>
            </div>
            
            {apiError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg my-4" role="alert">
                    <p className="font-bold">Data Error:</p>
                    <p className="text-sm">{apiError}</p>
                </div>
            )}
            
            {/* Filter Controls */}
            <div className="flex space-x-2 mb-4">
                 {/* 1. Filter Field Selector (Dropdown) */}
                <div className="relative">
                    <select
                        onChange={(e) => {
                            const field = e.target.value;
                            setActiveFilterField(field === "" ? null : field);
                            setItemFilterTerm(""); // Reset term when field changes
                        }}
                        value={activeFilterField || ""}
                        className="appearance-none pr-8 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                        disabled={isLoading}
                    >
                        <option value="">-- All Columns --</option>
                        {activeCollection.filterableFields.map(field => (
                            <option key={field} value={field}>
                                Filter by {field.toUpperCase().replace(/_/g, ' ')}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                </div>

                {/* 2. Filter Input (Text or Dropdown) */}
                <div className="relative">
                    {activeFilterField ? (
                        <select
                            onChange={(e) => setItemFilterTerm(e.target.value)}
                            value={itemFilterTerm}
                            className="appearance-none pr-8 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                            disabled={isLoading}
                        >
                            <option value="">--- All {activeFilterField.toUpperCase().replace(/_/g, ' ')} ---</option>
                            {uniqueFilterValues.map(value => (
                                <option key={value} value={String(value).toLowerCase()}>
                                    {value}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            placeholder={`Search All Fields...`}
                            value={itemFilterTerm}
                            onChange={(e) => setItemFilterTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm w-full sm:w-48"
                            disabled={isLoading}
                        />
                    )}
                    <Filter className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                </div>
            </div>
            
            {/* COMPACT TABLE DISPLAY */}
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        {activeCollection.compactFields.map(field => (
                            <th key={field} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {field.toUpperCase().replace(/_/g, ' ')}
                            </th>
                        ))}
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {isLoading && items.length === 0 ? (
                        <tr>
                            <td colSpan={activeCollection.compactFields.length + 1} className="px-4 py-4 text-center text-indigo-500">
                                <Loader className="w-5 h-5 animate-spin inline mr-2" /> Loading data from API...
                            </td>
                        </tr>
                    ) : filteredItems.length === 0 ? (
                        <tr>
                            <td colSpan={activeCollection.compactFields.length + 1} className="px-4 py-4 text-center text-gray-500">
                                No items found matching filter criteria.
                            </td>
                        </tr>
                    ) : (
                        filteredItems.map(item => (
                            <tr key={item.id} className={'hover:bg-gray-50'}>
                                {activeCollection.compactFields.map(field => {
                                    const type = getFieldType(field);
                                    
                                    return (
                                        <td key={field} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 truncate max-w-[150px]">
                                            {field === 'id' ? String(item[field]).substring(0, 8) + '...' 
                                                : type === 'checkbox' ? (item[field] ? 'Yes' : 'No') 
                                                : String(item[field] || 'N/A')}
                                        </td>
                                    )})}
                                <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                                    <button 
                                        onClick={() => openModalForEdit(item)} 
                                        className="text-indigo-600 hover:text-indigo-800 transition p-1 rounded-full hover:bg-indigo-100 disabled:opacity-50" 
                                        disabled={isLoading}
                                        title="View/Edit Details"
                                    >
                                        <Eye className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(item.id)} 
                                        className="text-red-600 hover:text-red-800 transition p-1 rounded-full hover:bg-red-100 disabled:opacity-50 ml-2" 
                                        disabled={isLoading}
                                        title="Delete Record"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );

    const renderAuditLogs = () => (
        <div className="mt-8 bg-gray-50 p-6 rounded-xl shadow-xl overflow-x-auto">
            <div className="flex justify-between items-center mb-4 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <Clock className="w-6 h-6 mr-2 text-yellow-600" />
                    Audit Logs
                </h2>
                <div className="relative mt-2 sm:mt-0">
                    <input
                        type="text"
                        placeholder="Filter Logs (Action, User, or Table)"
                        value={logFilterTerm}
                        onChange={(e) => setLogFilterTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 shadow-sm w-full sm:w-64"
                        disabled={isLoading}
                    />
                    <Filter className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">Every user action is recorded here.</p>
            
            <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-200 sticky top-0">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Action</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">User</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Table</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Record ID</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredLogs.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-4 py-4 text-center text-gray-500">
                                    No matching logs found.
                                </td>
                            </tr>
                        ) : (
                            filteredLogs.map((log, index) => (
                                <tr key={index} className="hover:bg-yellow-50">
                                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${log.action === 'CREATE' ? 'text-green-600' : log.action === 'UPDATE' ? 'text-blue-600' : 'text-red-600'}`}>
                                        {log.action}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 font-medium">
                                        {log.user_name || log.user_id}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                        {log.table_name}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-xs font-mono text-gray-500">
                                        {String(log.document_id).substring(0, 8)}...
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                        {formatTimestamp(log.logged_at)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );


    if (!authToken || !userData) {
        // The props are: { setAuthToken, setUserData, setIsLoading, isLoading }
        return <LoginScreen 
            setAuthToken={setAuthToken} 
            setUserData={setUserData} 
            setIsLoading={setIsLoading} 
            isLoading={isLoading} 
        />;
    }

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            {renderHeader()}
            
            <main className="p-4 sm:p-8 max-w-7xl mx-auto">
                
                {/* Collection Selector Tabs */}
                <div className="flex space-x-2 border-b border-gray-300 mb-6">
                    {collectionKeys.map(key => (
                        <button
                            key={key}
                            onClick={() => handleCollectionSwitch(key)}
                            className={`py-3 px-6 text-lg font-medium transition duration-150 rounded-t-lg ${
                                activeCollectionKey === key
                                    ? 'border-b-4 border-indigo-600 text-indigo-700 bg-white shadow-t'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                            }`}
                            disabled={isLoading}
                        >
                            {initialCollections[key].name}
                        </button>
                    ))}
                </div>

                {renderItemForm()}
                
                {renderItemsTable()}

                {/* CONDITIONAL RENDERING BASED ON ROLE */}
                {isAdmin && renderAuditLogs()}

            </main>

            {/* Modal must be rendered outside the main content flow */}
            {modalData && (
                <DetailModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    item={modalData}
                    activeCollection={activeCollection}
                    allProductLines={allProductLines}
                    handleUpdate={handleUpdate}
                    isLoading={isLoading}
                    setApiError={setApiError}
                />
            )}
        </div>
    );
};

export default App;