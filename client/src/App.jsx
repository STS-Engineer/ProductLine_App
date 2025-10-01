import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LogOut, Plus, Trash2, Edit, Save, X, Database, Filter, Clock, User } from 'lucide-react';

// --- Configuration ---
// Base URL for your Node.js/Express API server
const BASE_API_URL = 'http://localhost:3001'; 
// NOTE: Change this to your deployed server address when ready.

// --- Data Model Configuration based on PostgreSQL schema ---
const initialCollections = {
  product_lines: {
    name: 'Product Lines',
    apiPath: '/api/product_lines',
    // Subset of fields to display and edit
    fields: ['name', 'type_of_products', 'product_line_manager', 'strength', 'weakness'],
    defaultValues: { name: '', type_of_products: '', product_line_manager: '', strength: '', weakness: '' },
    placeholder: { name: 'New Line Name', type_of_products: 'Automotive', product_line_manager: 'Jane Doe', strength: 'High Margin', weakness: 'Supply Chain Risk' },
  },
  products: {
    name: 'Products',
    apiPath: '/api/products',
    // Subset of fields to display and edit
    fields: ['product_name', 'product_line', 'description', 'capacity', 'gmdc_pct'],
    defaultValues: { product_name: '', product_line: '', description: '', capacity: '', gmdc_pct: '0.00' }, // gmdc_pct must be string for initial form state
    placeholder: { product_name: 'Product X100', product_line: 'Electronics', description: 'New generation sensor.', capacity: '1000/month', gmdc_pct: 35.50 },
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
    return dateString;
  }
};

/**
 * Custom Modal for Confirmation (replacing window.confirm)
 */
const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
            <p className="text-lg font-semibold text-gray-800 mb-6">{message}</p>
            <div className="flex justify-end space-x-3">
                <button 
                    onClick={onCancel} 
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                >
                    Cancel
                </button>
                <button 
                    onClick={onConfirm} 
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                >
                    Confirm Delete
                </button>
            </div>
        </div>
    </div>
);


// --- Authentication Screen Component ---
const LoginScreen = ({ setAuthStatus, setLoginError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoading(true);

    const endpoint = isSigningUp ? '/api/auth/signup' : '/api/auth/login';
    const body = { email, password };
    if (isSigningUp) {
      body.displayName = displayName;
    }

    try {
      const response = await fetch(`${BASE_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isSigningUp ? 'sign up' : 'log in'}.`);
      }

      // Success: Save token and user info
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setAuthStatus({ token: data.token, user: data.user });

    } catch (error) {
      console.error('Auth Error:', error.message);
      setLoginError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-2xl">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 flex items-center justify-center">
            <User className="w-8 h-8 mr-2 text-indigo-600" />
            {isSigningUp ? 'Create Your Account' : 'Sign In'}
        </h2>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {isSigningUp && (
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display Name"
              className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
          />

          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition duration-150 shadow-md"
          >
            {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
            ) : (
                isSigningUp ? 'Sign Up' : 'Sign In'
            )}
          </button>
        </form>
        <div className="text-center">
          <button
            onClick={() => { setIsSigningUp(!isSigningUp); setLoginError(null); }}
            className="font-medium text-indigo-600 hover:text-indigo-500 text-sm"
          >
            {isSigningUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main Application Component ---
const App = () => {
  const [authStatus, setAuthStatus] = useState({ token: null, user: null });
  const [loginError, setLoginError] = useState(null);
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeCollectionKey, setActiveCollectionKey] = useState(collectionKeys[0]);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [newItemData, setNewItemData] = useState(initialCollections[activeCollectionKey].defaultValues);
  const [logFilterTerm, setLogFilterTerm] = useState('');
  const [itemFilterTerm, setItemFilterTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(null);

  const { token, user } = authStatus;
  const activeCollection = initialCollections[activeCollectionKey];

  // 1. Initial Authentication Check (Load from localStorage)
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      try {
        setAuthStatus({ token: savedToken, user: JSON.parse(savedUser) });
      } catch (e) {
        // Clear invalid storage data
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // 2. Data Fetching (Simulates GET request to API)
  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);

    try {
      const headers = { 
        'Authorization': `Bearer ${token}` 
      };

      // 1. Fetch main data
      const itemsResponse = await fetch(`${BASE_API_URL}${activeCollection.apiPath}`, { headers });
      const fetchedItems = await itemsResponse.json();
      
      // 2. Fetch logs
      const logsResponse = await fetch(`${BASE_API_URL}${LOGS_API_PATH}`, { headers });
      const fetchedLogs = await logsResponse.json();
      
      if (!itemsResponse.ok || !logsResponse.ok) {
          throw new Error("Failed to fetch data from one or more endpoints.");
      }

      setItems(fetchedItems);
      setLogs(fetchedLogs);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      // Optional: Handle token expiry here (e.g., setAuthStatus to logged out)
    } finally {
      setIsLoading(false);
    }
  }, [token, activeCollection.apiPath]);

  useEffect(() => {
    fetchData();
    // Use polling to simulate real-time updates from other users
    const interval = setInterval(fetchData, 5000); 
    return () => clearInterval(interval);
  }, [fetchData]);


  // 3. Data Action Handler (used by CRUD operations)
  const handleDataAction = useCallback(async (method, path, data) => {
    if (!token) return { success: false, error: "Not authenticated" };

    try {
      const response = await fetch(`${BASE_API_URL}${path}`, {
        method: method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API call failed with status ${response.status}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error during ${method} operation:`, error.message);
      return { success: false, error: error.message };
    }
  }, [token]);

  // --- CRUD Handlers ---

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!token) return;
    setIsLoading(true);

    // Filter out empty strings for non-text fields, and ensure gmdc_pct is numeric
    const payload = Object.entries(newItemData).reduce((acc, [key, value]) => {
        if (key === 'gmdc_pct') {
            acc[key] = parseFloat(value) || 0.00;
        } else if (value !== null && value !== undefined && String(value).trim() !== '') {
            acc[key] = value;
        }
        return acc;
    }, {});

    const result = await handleDataAction('POST', activeCollection.apiPath, payload);
    
    if (result.success) {
      setNewItemData(activeCollection.defaultValues);
      fetchData(); 
    } else {
        alert(`Creation failed: ${result.error}`); // Use custom alert in real app
    }
    setIsLoading(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!token || !editingId) return;
    setIsLoading(true);

    const payload = Object.entries(editFormData).reduce((acc, [key, value]) => {
        if (key === 'gmdc_pct') {
            acc[key] = parseFloat(value) || 0.00;
        } else if (value !== null && value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {});
    
    const result = await handleDataAction('PUT', `${activeCollection.apiPath}/${editingId}`, payload);
    
    if (result.success) {
      setEditingId(null);
      setEditFormData({});
      fetchData(); 
    } else {
        alert(`Update failed: ${result.error}`); // Use custom alert in real app
    }
    setIsLoading(false);
  };

  const handleDelete = async (id) => {
    if (!token) return;
    
    // Use the stored ID from confirmation
    const idToDelete = isConfirmingDelete;
    if (!idToDelete) return; 
    
    setIsConfirmingDelete(null);
    setIsLoading(true);

    const result = await handleDataAction('DELETE', `${activeCollection.apiPath}/${idToDelete}`);
    
    if (result.success) {
      fetchData(); 
    } else {
        alert(`Deletion failed: ${result.error}`); // Use custom alert in real app
    }
    setIsLoading(false);
  };
  
  // --- UI State Handlers ---

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditFormData(item);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleEditChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleNewItemChange = (field, value) => {
    setNewItemData(prev => ({ ...prev, [field]: value }));
  };

  const handleCollectionSwitch = (key) => {
    setActiveCollectionKey(key);
    setEditingId(null);
    setItemFilterTerm('');
    setNewItemData(initialCollections[key].defaultValues);
    // Fetch data for the new collection immediately
    // Note: fetchData will be called via useEffect interval shortly
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setAuthStatus({ token: null, user: null });
    setItems([]);
    setLogs([]);
  };
  
  // --- Filtering Logic (Client-Side) ---

  const filteredItems = useMemo(() => {
    const term = itemFilterTerm.toLowerCase().trim();
    if (!term) return items;
    
    return items.filter(item => 
        Object.keys(item).some(key => {
            // Only check fields defined in the current collection plus name/id
            if (activeCollection.fields.includes(key) || key === 'id' || key === 'name') {
                return String(item[key]).toLowerCase().includes(term);
            }
            return false;
        })
    );
  }, [items, itemFilterTerm, activeCollection.fields]);

  const filteredLogs = useMemo(() => {
    const term = logFilterTerm.toLowerCase().trim();
    if (!term) return logs;
    
    return logs.filter(log => 
        (log.action?.toLowerCase().includes(term)) ||
        (log.table_name?.toLowerCase().includes(term)) ||
        (log.user_email?.toLowerCase().includes(term)) ||
        (String(log.document_id)?.toLowerCase().includes(term))
    );
  }, [logs, logFilterTerm]);


  // --- Render Functions ---

  const renderHeader = () => (
    <header className="bg-gray-800 p-4 shadow-lg flex justify-between items-center flex-wrap">
      <h1 className="text-2xl font-extrabold text-indigo-400 flex items-center">
        <Database className="inline-block mr-2 h-6 w-6 text-indigo-400" />
        PostgreSQL Management Console
      </h1>
      <div className="text-right flex items-center space-x-4 mt-2 sm:mt-0">
        {user && token ? (
          <>
            <span className="text-sm font-medium text-gray-300 truncate max-w-xs">
              {user.displayName} ({user.id})
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-150 shadow-md flex items-center text-sm font-semibold"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </button>
          </>
        ) : (
          <span className="text-sm font-medium text-yellow-500">
            Authentication Required
          </span>
        )}
      </div>
    </header>
  );

  const renderItemForm = () => (
    <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow-xl space-y-4">
      <h2 className="text-xl font-bold text-gray-700">Add New {activeCollection.name.slice(0, -1)}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {activeCollection.fields.map(field => (
          <input
            key={field}
            type={field === 'gmdc_pct' ? 'number' : 'text'}
            step={field === 'gmdc_pct' ? '0.01' : 'any'}
            placeholder={activeCollection.placeholder[field] || field}
            value={newItemData[field] || ''}
            onChange={(e) => handleNewItemChange(field, e.target.value)}
            required
            className="p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          />
        ))}
      </div>
      <button
        type="submit"
        disabled={!token || isLoading}
        className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition duration-150 flex items-center justify-center disabled:opacity-50 shadow-md"
      >
        {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
        ) : (
            <Plus className="w-5 h-5 mr-2" />
        )}
        {isLoading ? 'Processing...' : `Create ${activeCollection.name.slice(0, -1)}`}
      </button>
    </form>
  );

  const renderItemsTable = () => (
    <div className="bg-white p-6 rounded-xl shadow-xl mt-6 overflow-x-auto">
      <div className="flex justify-between items-center mb-4 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          {activeCollection.name} Data
          <span className="ml-2 text-sm font-medium text-indigo-500 p-1 bg-indigo-50 rounded-full">{items.length} items</span>
        </h2>
        <div className="relative mt-2 sm:mt-0">
            <input
                type="text"
                placeholder={`Filter ${activeCollection.name}...`}
                value={itemFilterTerm}
                onChange={(e) => setItemFilterTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm w-full sm:w-48"
            />
            <Filter className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        </div>
      </div>
      
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            {activeCollection.fields.map(field => (
              <th key={field} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {field.toUpperCase().replace(/_/g, ' ')}
              </th>
            ))}
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {isLoading && items.length === 0 ? (
            <tr>
              <td colSpan={activeCollection.fields.length + 2} className="px-4 py-4 text-center text-indigo-500">
                Loading data from API...
              </td>
            </tr>
          ) : filteredItems.length === 0 ? (
            <tr>
              <td colSpan={activeCollection.fields.length + 2} className="px-4 py-4 text-center text-gray-500">
                No items found matching filter criteria.
              </td>
            </tr>
          ) : (
            filteredItems.map(item => (
              <tr key={item.id} className={item.id === editingId ? 'bg-indigo-50' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-500">{String(item.id).substring(0, 6)}...</td>
                {activeCollection.fields.map(field => (
                  <td key={field} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {item.id === editingId ? (
                      <input
                        type={field === 'gmdc_pct' ? 'number' : 'text'}
                        step={field === 'gmdc_pct' ? '0.01' : 'any'}
                        value={editFormData[field] || ''}
                        onChange={(e) => handleEditChange(field, e.target.value)}
                        className="p-1 border border-indigo-300 rounded-md w-full"
                      />
                    ) : (
                      item[field]
                    )}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  {item.id === editingId ? (
                    <>
                      <button onClick={handleUpdate} className="text-green-600 hover:text-green-800 transition p-1 rounded-full hover:bg-green-100 disabled:opacity-50" disabled={isLoading}>
                        <Save className="w-5 h-5" />
                      </button>
                      <button onClick={cancelEditing} className="text-red-600 hover:text-red-800 transition p-1 rounded-full hover:bg-red-100 disabled:opacity-50" disabled={isLoading}>
                        <X className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEditing(item)} className="text-indigo-600 hover:text-indigo-800 transition p-1 rounded-full hover:bg-indigo-100 disabled:opacity-50" disabled={isLoading}>
                        <Edit className="w-5 h-5" />
                      </button>
                      <button onClick={() => setIsConfirmingDelete(item.id)} className="text-red-600 hover:text-red-800 transition p-1 rounded-full hover:bg-red-100 disabled:opacity-50" disabled={isLoading}>
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
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
            />
            <Filter className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-4">Every action (Data CRUD, Login, Signup) is recorded here.</p>
      
      <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-200 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Action</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">User Email</th>
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
                        <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${log.action === 'CREATE' || log.action === 'SIGNUP' ? 'text-green-600' : log.action === 'UPDATE' || log.action === 'LOGIN' ? 'text-blue-600' : 'text-red-600'}`}>
                            {log.action}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 font-medium">
                            {log.user_email}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                            {log.table_name || 'N/A'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-xs font-mono text-gray-500">
                            {String(log.document_id || 'N/A').substring(0, 6)}...
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

  // --- Main Render Logic ---

  if (!token) {
    return <LoginScreen setAuthStatus={setAuthStatus} setLoginError={setLoginError} />;
  }
  
  return (
    <div className="min-h-screen bg-gray-100 font-sans">
        {isConfirmingDelete && (
            <ConfirmationModal
                message={`Are you sure you want to delete this record (ID: ${String(isConfirmingDelete).substring(0, 8)}...)? This action will be logged.`}
                onConfirm={() => handleDelete(isConfirmingDelete)}
                onCancel={() => setIsConfirmingDelete(null)}
            />
        )}
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
        
        {/* API Error Display */}
        {loginError && (
            <div className="p-3 mb-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <p className="font-semibold">API/Auth Error:</p>
                <p className="text-sm">{loginError}. Please check your server status and credentials.</p>
            </div>
        )}

        {renderItemForm()}
        
        {renderItemsTable()}

        {renderAuditLogs()}

      </main>
    </div>
  );
};

export default App;
