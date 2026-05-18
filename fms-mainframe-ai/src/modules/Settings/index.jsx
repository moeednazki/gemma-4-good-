import { useState, useEffect, useRef } from 'react';
import { Save, Database, ShieldAlert, UploadCloud } from 'lucide-react';

export default function Settings() {
  // -----------------------------------------------------
  // FIREBASE CONFIGURATION STATE
  // -----------------------------------------------------
  const [config, setConfig] = useState({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '' // Added to match your SDK config
  });
  const [saveStatus, setSaveStatus] = useState('');
  const fileInputRef = useRef(null);

  // -----------------------------------------------------
  // MASTER AUTHENTICATION STATE
  // -----------------------------------------------------
  const [authForm, setAuthForm] = useState({ 
    currentPassword: '', 
    newUsername: '', 
    newPassword: '' 
  });

  // Load existing keys from local storage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('fms_firebase_config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  }, []);

  const handleChange = (e) => {
    setConfig({
      ...config,
      [e.target.name]: e.target.value
    });
  };

  // --- NEW: JSON IMPORT HANDLER ---
  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedConfig = JSON.parse(event.target.result);
        
        // Basic validation to ensure it looks like a Firebase config object
        if (importedConfig.apiKey || importedConfig.projectId) {
          setConfig({
            apiKey: importedConfig.apiKey || '',
            authDomain: importedConfig.authDomain || '',
            projectId: importedConfig.projectId || '',
            storageBucket: importedConfig.storageBucket || '',
            messagingSenderId: importedConfig.messagingSenderId || '',
            appId: importedConfig.appId || '',
            measurementId: importedConfig.measurementId || ''
          });
          setSaveStatus("JSON loaded successfully! Please click 'Save Configuration Keys' to apply.");
        } else {
          alert("Invalid configuration file. Please ensure it contains standard Firebase keys (apiKey, projectId, etc.).");
        }
      } catch (err) {
        alert("Error parsing JSON file. Please ensure it is a valid JSON format.");
      }
      
      // Reset input so the same file can be uploaded again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
    reader.readAsText(file);
  };

  const handleSaveConfig = (e) => {
    e.preventDefault();
    localStorage.setItem('fms_firebase_config', JSON.stringify(config));
    
    alert('Configuration saved successfully. The system will now reboot to establish the live database bridge.');
    
    // FORCE RELOAD: Instantly reboots the app to apply the new Firebase keys
    window.location.reload(); 
  };

  const handleSecurityUpdate = (e) => {
    e.preventDefault();
    
    if (!authForm.currentPassword) {
       return alert("Current password is required to authorize changes.");
    }

    if (!authForm.newUsername || !authForm.newPassword) {
       return alert("Both a new username and a new password are required.");
    }
    
    // Retrieve the current actual password from storage (fallback to 'admin' if not set)
    const storedPassword = localStorage.getItem('fms_master_password') || 'admin';

    // Verify the user knows the current password before allowing a change
    if (authForm.currentPassword !== storedPassword) {
      return alert("ERROR: Current password is incorrect. Authorization denied.");
    }
    
    // Save the new credentials to the system storage so Login.jsx can read them
    localStorage.setItem('fms_master_username', authForm.newUsername);
    localStorage.setItem('fms_master_password', authForm.newPassword);
    
    alert("Admin Credentials Successfully Rotated! Your session has been terminated. Please log back in with your new credentials.");
    
    // Clear the form
    setAuthForm({ currentPassword: '', newUsername: '', newPassword: '' });
    
    // FORCE LOGOUT: Reloading the window dumps the React state and forces the Login screen to mount
    window.location.reload();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <Database className="text-blue-600 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">System Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Manage core Mainframe configurations and security credentials.</p>
        </div>
      </div>

      {/* CARD 1: CLOUD FIRESTORE CONNECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-lg font-semibold text-slate-800">Cloud Firestore Connection</h2>
          
          {/* NEW: IMPORT JSON BUTTON */}
          <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-slate-300 transition shadow-sm">
            <UploadCloud size={16} className="text-blue-600" /> Auto-Fill via JSON
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              onChange={handleImportJSON} 
              ref={fileInputRef}
            />
          </label>
        </div>
        
        {saveStatus && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium flex items-center gap-2">
            <Database size={16} /> {saveStatus}
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">API Key</label>
            <input type="password" name="apiKey" value={config.apiKey} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="AIzaSy..." required />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Auth Domain</label>
            <input type="text" name="authDomain" value={config.authDomain} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="your-project.firebaseapp.com" required />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Project ID</label>
            <input type="text" name="projectId" value={config.projectId} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="your-project-id" required />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Storage Bucket</label>
            <input type="text" name="storageBucket" value={config.storageBucket} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="your-project.appspot.com" required />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Messaging Sender ID</label>
            <input type="text" name="messagingSenderId" value={config.messagingSenderId} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="1234567890" required />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">App ID</label>
            <input type="text" name="appId" value={config.appId} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="1:1234567890:web:abc123def" required />
          </div>
          
          {/* NEW INPUT FOR MEASUREMENT ID */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Measurement ID (Optional)</label>
            <input type="text" name="measurementId" value={config.measurementId} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="G-ABC123DEF" />
          </div>

          <div className="md:col-span-2 pt-4 border-t border-slate-100 mt-2">
            <button type="submit" className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-lg hover:bg-slate-800 transition font-medium">
              <Save size={18} /> Save Configuration Keys
            </button>
          </div>
        </form>
      </div>

      {/* CARD 2: MASTER SECURITY CREDENTIALS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <ShieldAlert className="text-red-500" size={24} />
          <div>
            <h2 className="text-lg font-bold text-slate-800">Master Admin Credentials</h2>
            <p className="text-xs text-slate-500 mt-1">Rotate the primary login credentials for the desktop Mainframe.</p>
          </div>
        </div>

        <form onSubmit={handleSecurityUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">CURRENT MASTER PASSWORD *</label>
            <input 
              type="password" 
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:border-red-400"
              value={authForm.currentPassword}
              onChange={(e) => setAuthForm({...authForm, currentPassword: e.target.value})}
              placeholder="Enter current password to authorize changes"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">NEW ADMIN USERNAME / EMAIL</label>
              <input 
                type="text" 
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 outline-none focus:border-red-400"
                value={authForm.newUsername}
                onChange={(e) => setAuthForm({...authForm, newUsername: e.target.value})}
                placeholder="e.g. admin@farm.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">NEW MASTER PASSWORD</label>
              <input 
                type="password" 
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 outline-none focus:border-red-400"
                value={authForm.newPassword}
                onChange={(e) => setAuthForm({...authForm, newPassword: e.target.value})}
                placeholder="Enter new strong password"
              />
            </div>
          </div>

          <button type="submit" className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition">
            <ShieldAlert size={18} /> UPDATE SYSTEM CREDENTIALS
          </button>
        </form>
      </div>

    </div>
  );
}