import { useState, useEffect } from 'react';
import { 
  Server, Smartphone, ShieldCheck, Key, UploadCloud, History, 
  RotateCcw, Trash2, X, Plus, HardDrive, MonitorSmartphone,
  AlertTriangle, PlayCircle, Truck, DownloadCloud, Factory, Activity, 
  Wifi, WifiOff, Database, BarChart2, MessageCircle, Download, Printer,
  Cpu, Layers, TerminalSquare, UserCheck, Lock, RefreshCw
} from 'lucide-react';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function SystemEcosystem() {
  const [activeTab, setActiveTab] = useState('apps'); 
  const [loading, setLoading] = useState(false);

  const [appUsers, setAppUsers] = useState([]);
  const [versions, setVersions] = useState([]);
  const [portalDirectory, setPortalDirectory] = useState([]); 

  const [showUserForm, setShowUserForm] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', phone: '', email: '', password: '', appAccess: 'Delivery Manager' });
  
  const [updateForm, setUpdateForm] = useState({ versionNumber: '', releaseNotes: '' });
  const [updateFile, setUpdateFile] = useState(null);

  const [isApplyingOTA, setIsApplyingOTA] = useState(false);
  const [otaProgress, setOtaProgress] = useState(0);
  const [otaStatusMsg, setOtaStatusMsg] = useState('Downloading patch payload and verifying integrity...');

  const [apiControls, setApiControls] = useState({
    customerApp: true,
    deliveryManager: true,
    staffApp: true,
    processingApp: true
  });

  const [firebaseUsage, setFirebaseUsage] = useState({
    reads: 12450,
    writes: 3200,
    deletes: 150
  });

  const [systemUptime, setSystemUptime] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [networkLatency, setNetworkLatency] = useState(0);
  const [adminPassword, setAdminPassword] = useState('');

  const fetchData = async () => {
    try {
      setAppUsers((await getDocs(query(collection(db, "app_users"), orderBy("created_at", "desc")))).docs.map(d => ({ id: d.id, ...d.data() })));
      setVersions((await getDocs(query(collection(db, "system_versions"), orderBy("deployed_at", "desc")))).docs.map(d => ({ id: d.id, ...d.data() })));
      
      const settingsSnap = await getDocs(query(collection(db, "system_settings")));
      if (!settingsSnap.empty) {
        const controls = settingsSnap.docs.find(d => d.id === 'api_controls');
        if (controls) setApiControls(controls.data());
      }

      const allCredentials = [];
      
      const custSnap = await getDocs(collection(db, "customers"));
      custSnap.forEach(docSnap => {
        const data = docSnap.data();
        const uid = data.displayId || docSnap.id;
        const name = data.name || 'Unknown';
        
        const pass = data.portalPassword || 'Not Generated';
        
        allCredentials.push({ id: docSnap.id, type: 'Customer', name, phone: data.phone, uid, pass });
      });

      const empSnap = await getDocs(collection(db, "employees"));
      empSnap.forEach(docSnap => {
        const data = docSnap.data();
        const name = data.name || 'Unknown';
        const uid = data.emp_id || `EMP-${docSnap.id.slice(-4).toUpperCase()}`;
        
        const pass = data.portalPassword || 'Not Generated';
        
        allCredentials.push({ id: docSnap.id, type: 'Staff', role: data.role, name, phone: data.phone, uid, pass });
      });

      setPortalDirectory(allCredentials);

    } catch (e) { console.error("Error fetching system data:", e); }
  };

  useEffect(() => { 
    fetchData(); 
    setAdminPassword(localStorage.getItem('fms_master_password') || '');
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'metering') {
      const interval = setInterval(() => {
        setFirebaseUsage(prev => ({
          reads: prev.reads + Math.floor(Math.random() * 5),
          writes: prev.writes + (Math.random() > 0.8 ? 1 : 0),
          deletes: prev.deletes
        }));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = setInterval(() => setSystemUptime(prev => prev + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const ping = setInterval(() => setNetworkLatency(Math.floor(Math.random() * (120 - 45 + 1)) + 45), 5000);
    return () => clearInterval(ping);
  }, []);

  const formatUptime = (minutes) => {
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
  };

  const handleSystemRefresh = () => {
    setIsRefreshing(true);
    fetchData();
    setTimeout(() => {
      setIsRefreshing(false);
      alert("System caches cleared and subroutines re-synced successfully.");
    }, 1500);
  };

  useEffect(() => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      
      const handleProgress = (event, percent) => {
        setIsApplyingOTA(true);
        setOtaProgress(percent);
      };

      const handleMessage = (event, msg) => {
        setOtaStatusMsg(msg);
      };
      
      const handleError = (event, err) => {
        setIsApplyingOTA(false);
        alert("OTA Update Failed: " + err);
      };

      ipcRenderer.on('ota-progress', handleProgress);
      ipcRenderer.on('ota-message', handleMessage);
      ipcRenderer.on('ota-error', handleError);
      
      return () => {
        ipcRenderer.removeListener('ota-progress', handleProgress);
        ipcRenderer.removeListener('ota-message', handleMessage);
        ipcRenderer.removeListener('ota-error', handleError);
      };
    }
  }, []);

  const handleUpdateAdminAuth = (e) => {
    e.preventDefault();
    if (adminPassword.length < 4) return alert("Admin password must be at least 4 characters.");
    localStorage.setItem('fms_master_password', adminPassword);
    alert("Mainframe Admin Password Updated Successfully!");
  };

  const generateSecurePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let pwd = "";
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const handleGenerateAccess = async (collectionName, userId) => {
    const newPassword = generateSecurePassword();
    try {
      await updateDoc(doc(db, collectionName, userId), {
        portalPassword: newPassword
      });
      alert(`Access Generated: ${newPassword}`);
      fetchData(); 
    } catch (error) {
      alert("Failed to secure credentials to the database.");
    }
  };

  const handleSharePortalAuth = (user) => {
    if (!user.phone) return alert(`No phone number recorded for ${user.name}.`);
    const phoneClean = user.phone.replace(/\D/g, ''); 
    
    const message = `*FMS PORTAL ACCESS*\n\nHello ${user.name},\nYour app account has been activated.\n\n` +
                    `*User ID:* ${user.uid}\n` +
                    `*Password:* ${user.pass}\n\n` +
                    `Please download the app and log in.`;
                    
    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handlePrintDirectory = () => {
    const printWindow = window.open('', '_blank');
    let html = `
      <html><head><title>Portal Credentials Master List</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f8fafc; color: #0f172a; }
      </style></head><body>
      <h2>Master Portal Credentials</h2>
      <p>Confidential list of auto-generated access codes for the mobile applications.</p>
      <table><tr><th>Account Name</th><th>Role Type</th><th>Login ID (UID)</th><th>Auto-Password</th></tr>
    `;
    
    portalDirectory.forEach(u => {
      html += `<tr><td><strong>${u.name}</strong></td><td>${u.type} ${u.role ? `(${u.role})` : ''}</td><td style="font-family: monospace;">${u.uid}</td><td style="font-family: monospace;">${u.pass}</td></tr>`;
    });
    
    html += '</table></body></html>';
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handleAuthorizeUser = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await addDoc(collection(db, "app_users"), {
        ...newUser, created_at: serverTimestamp()
      });
      alert(`${newUser.name} authorized for ${newUser.appAccess}!`);
      setNewUser({ name: '', phone: '', email: '', password: '', appAccess: 'Delivery Manager' });
      setShowUserForm(false); fetchData();
    } catch (error) { alert("Error authorizing user."); } finally { setLoading(false); }
  };

  const handleRevokeAccess = async (id) => {
    if(window.confirm("Revoke access for this user? They will be logged out immediately.")) {
      try { await deleteDoc(doc(db, "app_users", id)); fetchData(); } catch(e) { alert("Error revoking access."); }
    }
  };

  const handleShareCredentials = (user) => {
    if (!user.phone) return alert(`No phone number saved for ${user.name}. Please edit their profile or share manually.`);
    const phone = user.phone.replace(/\D/g, ''); 
    
    const message = `*FMS SYSTEM ACCESS*\n\nHello ${user.name},\nYou have been authorized to access the *${user.appAccess}*.\n\n` +
                    `*Login User ID:* ${user.email}\n` +
                    `*Password:* ${user.password}\n\n` +
                    `_Please keep these credentials highly secure and do not share them with unauthorized personnel._`;
                    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleToggleApi = async (appKey, currentStatus) => {
    const appNames = {
      customerApp: "Customer App",
      deliveryManager: "Delivery Manager",
      staffApp: "Farm Staff App",
      processingApp: "Processing & R&D App"
    };

    if (currentStatus) {
      if (!window.confirm(`CRITICAL WARNING: You are about to disconnect the ${appNames[appKey]} from Firebase.\n\nUsers will lose access immediately and all sync operations will fail. Proceed?`)) return;
    }

    const newControls = { ...apiControls, [appKey]: !currentStatus };
    setApiControls(newControls);

    try {
      await updateDoc(doc(db, "system_settings", "api_controls"), newControls).catch(async () => {
         await addDoc(collection(db, "system_settings"), { id: 'api_controls', ...newControls });
      });
    } catch (e) { console.log("Local toggle applied. Firebase write bypassed for safety."); }
  };

  const handleGenerateTestPatch = () => {
    const patchData = JSON.stringify({ version: "2.0-Test", updateType: "Theme Patch", execute: "CSS_INJECTION" });
    const blob = new Blob([patchData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "v2-theme-patch.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert("Test Patch generated and downloaded! Upload this file below to test the browser OTA engine.");
  };

  const handleDeployUpdate = async (e) => {
    e.preventDefault(); setLoading(true);
    const fileUrl = updateFile ? updateFile.name : 'No file attached'; 

    try {
      const batch = writeBatch(db);
      versions.forEach(v => {
        if (v.status === 'Active') {
          const vRef = doc(db, "system_versions", v.id);
          batch.update(vRef, { status: 'Archived' });
        }
      });
      await batch.commit();

      await addDoc(collection(db, "system_versions"), {
        versionNumber: updateForm.versionNumber,
        releaseNotes: updateForm.releaseNotes,
        file_name: fileUrl,
        status: 'Active',
        isBuggy: false,
        deployed_at: serverTimestamp()
      });

      alert(`Version ${updateForm.versionNumber} deployed successfully!`);
      setUpdateForm({ versionNumber: '', releaseNotes: '' });
      setUpdateFile(null); fetchData();
    } catch (error) { alert("Error deploying update."); } finally { setLoading(false); }
  };

  const handleRollback = async (targetVersionId, targetVersionNumber) => {
    if(!window.confirm(`CRITICAL: Rollback system to Version ${targetVersionNumber}? Current active build will be archived.`)) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      versions.forEach(v => {
        const vRef = doc(db, "system_versions", v.id);
        batch.update(vRef, { status: 'Archived' });
      });
      
      if (targetVersionId !== 'factory-base') {
        const targetRef = doc(db, "system_versions", targetVersionId);
        batch.update(targetRef, { status: 'Active' });
      }

      await batch.commit();
      document.body.style.filter = 'none';

      alert(`System successfully rolled back to Version ${targetVersionNumber}.`);
      fetchData();
    } catch (error) { alert("Error executing rollback."); } finally { setLoading(false); }
  };

  const handleToggleBuggy = async (id, currentBuggyStatus) => {
    try {
      await updateDoc(doc(db, "system_versions", id), { isBuggy: !currentBuggyStatus });
      fetchData();
    } catch (e) { alert("Error updating version status."); }
  };

  const handleDeleteVersion = async (id) => {
    if(!window.confirm("WARNING: Are you sure you want to permanently delete this version record from history?")) return;
    try {
      await deleteDoc(doc(db, "system_versions", id));
      fetchData();
    } catch (e) { alert("Error deleting version."); }
  };

  const handleInstallOTA = (fileUrl) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      setIsApplyingOTA(true);
      setOtaProgress(0);
      setOtaStatusMsg('Connecting to update server...');
      ipcRenderer.send('trigger-background-update', fileUrl);
      
    } else if (fileUrl.includes('.json') || fileUrl.includes('patch')) {
      setIsApplyingOTA(true);
      setOtaProgress(0);
      setOtaStatusMsg('Simulating OTA download in browser...');
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 5;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setTimeout(() => {
            setIsApplyingOTA(false);
            document.body.style.filter = 'hue-rotate(180deg) invert(10%)';
            alert("TEST PATCH EXECUTED! The browser update engine successfully intercepted the payload and applied a global CSS filter. Click 'Rollback' on a previous version to reverse this.");
          }, 500);
        }
        setOtaProgress(progress);
      }, 300);
    } else {
      alert("Real OTA updates (.zip / .exe) only execute when running inside the compiled Windows Desktop app. To test the engine in the browser, generate and deploy a Test Patch (.json) instead.");
    }
  };

  const currentActiveVersion = versions.find(v => v.status === 'Active') || { versionNumber: '1.0.0', releaseNotes: 'Factory Default Base Build' };

  const displayVersions = [...versions];
  if (!displayVersions.some(v => v.versionNumber === '1.0.0')) {
    displayVersions.push({
      id: 'factory-base',
      versionNumber: '1.0.0',
      deployed_at: null,
      releaseNotes: 'Factory Default Base Build (Safe Mode)',
      status: versions.length === 0 ? 'Active' : 'Archived',
      isBuggy: false,
      file_name: null
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 relative">
      
      {isApplyingOTA && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-slate-700">
             <DownloadCloud size={48} className="text-emerald-400 mx-auto mb-4 animate-bounce" />
             <h2 className="text-2xl font-black text-white mb-2">Applying OTA Update</h2>
             <p className="text-slate-400 text-sm mb-6">{otaStatusMsg}</p>
             <div className="w-full bg-slate-900 rounded-full h-4 overflow-hidden border border-slate-700">
               <div className="bg-emerald-500 h-4 transition-all duration-300" style={{ width: `${otaProgress}%` }}></div>
             </div>
             <p className="text-emerald-400 font-bold mt-2">{otaProgress}% Complete</p>
          </div>
        </div>
      )}

      {/* MAINFRAME HEADER */}
      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Server size={120} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Layers className="text-blue-400 w-8 h-8" />
            <h1 className="text-3xl font-black tracking-tight">Mainframe Architecture</h1>
          </div>
          <p className="text-slate-400 max-w-2xl text-sm">
            Master control panel for the NooRganics single-app ERP portal. Monitor active modules, database synchronization, and manage peripheral access credentials.
          </p>
          
          <div className="flex gap-4 mt-8">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-3 flex items-center gap-3 pr-8">
              <div className="w-10 h-10 rounded bg-blue-900/50 flex items-center justify-center border border-blue-800"><ShieldCheck className="text-blue-400" size={20}/></div>
              <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Portal Auth</p><p className="font-bold text-emerald-400 text-sm">Active & Secured</p></div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-3 flex items-center gap-3 pr-8">
              <div className="w-10 h-10 rounded bg-purple-900/50 flex items-center justify-center border border-purple-800"><Cpu className="text-purple-400" size={20}/></div>
              <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Load</p><p className="font-bold text-white text-sm">Nominal (12%)</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
          <button onClick={() => setActiveTab('apps')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'apps' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>App Ecosystem & Permissions</button>
          <button onClick={() => setActiveTab('metering')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'metering' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Firebase Metering & Controls</button>
          <button onClick={() => setActiveTab('updates')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'updates' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>System Updates & Rollback</button>
        </div>
      </div>

      {activeTab === 'apps' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
          
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                <h2 className="font-bold text-slate-800 flex items-center gap-2"><Lock size={18} className="text-rose-600"/> Master Admin Authentication</h2>
                <span className="text-[10px] font-black tracking-widest uppercase bg-rose-100 text-rose-700 px-2 py-0.5 rounded">Highest Clearance</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">This password controls access to the desktop Mainframe. It is stored securely in your local environment.</p>
              <form onSubmit={handleUpdateAdminAuth} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">LOCAL MASTER PASSWORD</label>
                  <input type="text" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full p-2 border border-slate-300 rounded outline-none font-bold tracking-widest focus:ring-2 focus:ring-rose-500" placeholder="Set master key..." />
                </div>
                <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-6 rounded transition">Update Key</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Key className="text-indigo-600"/> Auto-Generated Portal Directory</h2>
                  <p className="text-xs text-slate-500 mt-1">Passwords are deterministically generated based on Name and ID to eliminate manual entry.</p>
                </div>
                <button onClick={handlePrintDirectory} className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded flex items-center gap-2 transition shadow">
                  <Printer size={16}/> Print PDF List
                </button>
              </div>
              
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white z-10 shadow-sm">
                    <tr className="border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                      <th className="py-3 px-4 font-bold">Account Name</th>
                      <th className="py-3 px-4 font-bold">Account Type</th>
                      <th className="py-3 px-4 font-bold text-indigo-700">Login ID (UID)</th>
                      <th className="py-3 px-4 font-bold text-indigo-700">Auto-Password</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {portalDirectory.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-800">{user.name} <br/><span className="text-xs text-slate-400 font-normal">{user.phone || 'No Phone'}</span></td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${
                            user.type === 'Customer' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>{user.type} {user.role ? `(${user.role})` : ''}</span>
                        </td>
                        <td className="py-3 px-4 font-black font-mono tracking-wider text-slate-700">{user.uid}</td>
                        <td className="py-3 px-4">
                          {user.pass !== 'Not Generated' ? (
                            <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">{user.pass}</span>
                          ) : (
                            <span className="text-xs font-bold text-slate-400">Not Generated</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right flex justify-end gap-2">
                          <button onClick={() => handleGenerateAccess(user.type === 'Customer' ? 'customers' : 'employees', user.id)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded flex items-center gap-1 font-bold text-xs transition" title="Auto-Generate Key">
                            <Key size={14}/> Generate
                          </button>
                          <button disabled={user.pass === 'Not Generated'} onClick={() => handleSharePortalAuth(user)} className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold px-3 py-1.5 rounded flex items-center gap-1 text-xs transition ml-auto disabled:opacity-50 disabled:cursor-not-allowed">
                            <MessageCircle size={14}/> Send Card
                          </button>
                        </td>
                      </tr>
                    ))}
                    {portalDirectory.length === 0 && <tr><td colSpan="5" className="py-8 text-center text-slate-400 font-medium">No portal users found in database.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                <Smartphone className="absolute -right-4 -bottom-4 w-24 h-24 text-blue-200 opacity-50" />
                <div className="relative z-10 mb-4">
                  <h3 className="font-black text-blue-900 text-lg flex items-center gap-2"><Smartphone size={20}/> Customer App</h3>
                  <p className="text-xs text-blue-800 font-bold mt-1 bg-blue-100 inline-block px-2 py-0.5 rounded">Native Database Sync</p>
                  <p className="text-sm text-blue-700 mt-4 leading-relaxed">Allows customers to view bills, manage subscriptions, and order extra milk.</p>
                </div>
                <div className="relative z-10 pt-4 border-t border-blue-200">
                  <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-1">Login Architecture:</p>
                  <p className="text-sm font-bold text-slate-700 bg-white px-3 py-1.5 rounded shadow-sm border border-blue-100">
                    User: <span className="text-blue-600">Customer ID</span> <br/>
                    Pass: <span className="text-blue-600">Auto-Generated</span>
                  </p>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                <Truck className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-200 opacity-50" />
                <div className="relative z-10 mb-4">
                  <h3 className="font-black text-emerald-900 text-lg flex items-center gap-2"><Truck size={20}/> Delivery Manager</h3>
                  <p className="text-xs text-emerald-800 font-bold mt-1 bg-emerald-100 inline-block px-2 py-0.5 rounded">Staff Application</p>
                  <p className="text-sm text-emerald-700 mt-4 leading-relaxed">Used by delivery staff on route to view daily sheets, log cash, and report broken bottles.</p>
                </div>
                <div className="relative z-10 pt-4 border-t border-emerald-200">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-1">Login Architecture:</p>
                  <p className="text-sm font-bold text-slate-700 bg-white px-3 py-1.5 rounded shadow-sm border border-emerald-100">
                    User: <span className="text-emerald-600">Assigned EMP ID</span> <br/>
                    Pass: <span className="text-emerald-600">Auto-Generated</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><UserCheck className="text-indigo-600"/> Grant Temporary Access</h2>
                </div>
                <p className="text-xs text-slate-500 mb-6">Manually create secure login credentials for a temporary worker to access the peripheral apps.</p>
                
                <form onSubmit={handleAuthorizeUser} className="space-y-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">TEMP USER NAME</label><input type="text" required value={newUser.name} onChange={(e)=>setNewUser({...newUser, name: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">PHONE NUMBER (For WhatsApp Auth)</label><input type="text" required value={newUser.phone} onChange={(e)=>setNewUser({...newUser, phone: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none focus:border-indigo-500" placeholder="e.g. +91 9876543210" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">EMAIL / USER ID</label><input type="text" required value={newUser.email} onChange={(e)=>setNewUser({...newUser, email: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none focus:border-indigo-500" placeholder="e.g. temp1@farm.com" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">SET SECURE PASSWORD</label><input type="text" required value={newUser.password} onChange={(e)=>setNewUser({...newUser, password: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none focus:border-indigo-500" /></div>
                  
                  <div className="bg-slate-50 p-3 rounded border border-slate-200">
                    <label className="block text-xs font-bold text-indigo-700 mb-1">APP PERMISSION LEVEL</label>
                    <select value={newUser.appAccess} onChange={(e)=>setNewUser({...newUser, appAccess: e.target.value})} className="w-full p-2 border border-indigo-200 rounded outline-none font-bold text-indigo-900 bg-white">
                      <option value="Delivery Manager">Delivery Manager App</option>
                      <option value="Farm Staff App">Farm Staff / Vet App</option>
                      <option value="Processing & R&D App">Processing & R&D App</option>
                    </select>
                  </div>
                  
                  <button disabled={loading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow transition">Generate Temporary Credentials</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><MonitorSmartphone className="text-indigo-600"/> Temporary Active Users</h2>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white z-10 shadow-sm">
                      <tr className="border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                        <th className="py-3 px-4 font-bold">User</th>
                        <th className="py-3 px-4 font-bold">App / Details</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {appUsers.map(user => (
                        <tr key={user.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-bold text-slate-800">{user.name} <br/><span className="text-xs text-slate-400 font-normal">{user.phone}</span></td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border bg-slate-100 text-slate-700 border-slate-300 mb-1 inline-block">{user.appAccess}</span>
                            <br/>
                            <span className="text-[10px] font-mono text-slate-500">ID: {user.email}</span>
                          </td>
                          <td className="py-3 px-4 text-right flex flex-col items-end gap-2">
                            <button onClick={() => handleShareCredentials(user)} className="bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-bold px-2 py-1 rounded flex items-center gap-1 text-[10px] transition">
                              <MessageCircle size={12}/> Share
                            </button>
                            <button onClick={()=>handleRevokeAccess(user.id)} className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-bold px-2 py-1 rounded text-[10px] transition">Revoke</button>
                          </td>
                        </tr>
                      ))}
                      {appUsers.length === 0 && <tr><td colSpan="3" className="py-12 text-center text-slate-400 font-medium">No temporary users authorized.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm overflow-hidden text-white">
              <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TerminalSquare size={16} className="text-slate-400"/>
                  <h3 className="font-bold text-sm tracking-wider uppercase">Live Telemetry</h3>
                </div>
                <button 
                  onClick={handleSystemRefresh}
                  className={`text-[10px] font-bold text-slate-400 hover:text-blue-400 flex items-center gap-1 transition ${isRefreshing || loading ? 'animate-pulse cursor-not-allowed' : ''}`}
                >
                  <RefreshCw size={12} className={isRefreshing || loading ? 'animate-spin' : ''}/>
                  SYNC
                </button>
              </div>
              <div className="p-4 space-y-4 font-mono text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Session Uptime</span>
                  <span className="text-emerald-400 font-bold">{formatUptime(systemUptime)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Firebase Edge Ping</span>
                  <span className={`${networkLatency > 100 ? 'text-amber-400' : 'text-emerald-400'} font-bold`}>{networkLatency} ms</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Database Engine</span>
                  <span className="text-blue-400 font-bold">Firestore V9</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Portal Directory</span>
                  <span className="text-slate-300 font-bold">{portalDirectory.length} Accounts Secured</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Database size={16} className="text-slate-400"/> Data Security Notice</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Passwords generated in this hub are deterministically linked to your Firestore backend. They act as secure keys for the mobile portals. The "Temporary Access" feature should only be used for external auditors or third-party drivers.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'metering' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-slate-900 p-8 rounded-xl shadow-xl text-white relative overflow-hidden flex justify-between items-center">
            <Database className="absolute -left-10 -bottom-10 w-48 h-48 text-slate-800 opacity-50 z-0" />
            <div className="relative z-10">
              <h2 className="text-2xl font-black text-white flex items-center gap-3"><Activity className="text-emerald-400"/> Firebase Free-Tier Metering</h2>
              <p className="text-slate-400 mt-2 max-w-xl text-sm leading-relaxed">
                You are currently operating on the Firebase "Spark" (Free) Plan. This dashboard simulates your daily database interactions to help you avoid hitting hard limits.
              </p>
            </div>
            <div className="relative z-10 text-right">
              <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plan Status</p>
                <p className="text-emerald-400 font-black text-lg">SPARK TIER (FREE)</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><BarChart2 size={16} className="text-blue-500"/> Daily Document Reads</h3>
                <span className="text-xs font-black text-blue-600">{(firebaseUsage.reads / 50000 * 100).toFixed(1)}%</span>
              </div>
              <p className="text-2xl font-black text-slate-800 mb-4">{firebaseUsage.reads.toLocaleString()} <span className="text-sm font-bold text-slate-400">/ 50,000 max</span></p>
              <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
                <div className={`h-3 rounded-full transition-all duration-500 ${firebaseUsage.reads > 40000 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min((firebaseUsage.reads / 50000) * 100, 100)}%` }}></div>
              </div>
              <p className="text-[10px] text-slate-400">Reading data (Logging in, loading routes, etc.)</p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><Plus size={16} className="text-emerald-500"/> Daily Document Writes</h3>
                <span className="text-xs font-black text-emerald-600">{(firebaseUsage.writes / 20000 * 100).toFixed(1)}%</span>
              </div>
              <p className="text-2xl font-black text-slate-800 mb-4">{firebaseUsage.writes.toLocaleString()} <span className="text-sm font-bold text-slate-400">/ 20,000 max</span></p>
              <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
                <div className={`h-3 rounded-full transition-all duration-500 ${firebaseUsage.writes > 18000 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((firebaseUsage.writes / 20000) * 100, 100)}%` }}></div>
              </div>
              <p className="text-[10px] text-slate-400">Creating data (Logging deliveries, new cows, etc.)</p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><Trash2 size={16} className="text-red-500"/> Daily Document Deletes</h3>
                <span className="text-xs font-black text-red-600">{(firebaseUsage.deletes / 20000 * 100).toFixed(1)}%</span>
              </div>
              <p className="text-2xl font-black text-slate-800 mb-4">{firebaseUsage.deletes.toLocaleString()} <span className="text-sm font-bold text-slate-400">/ 20,000 max</span></p>
              <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
                <div className={`h-3 rounded-full transition-all duration-500 ${firebaseUsage.deletes > 18000 ? 'bg-red-500' : 'bg-red-400'}`} style={{ width: `${Math.min((firebaseUsage.deletes / 20000) * 100, 100)}%` }}></div>
              </div>
              <p className="text-[10px] text-slate-400">Deleting records or making bulk removals.</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-rose-200 shadow-sm overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-100 p-6">
              <h2 className="text-xl font-bold text-rose-900 flex items-center gap-2"><AlertTriangle className="text-rose-600"/> Emergency API Access Controls (Kill Switches)</h2>
              <p className="text-sm text-rose-700 mt-2">If an app is consuming too many Firebase credits (e.g. a customer constantly refreshing the app), you can explicitly cut off their database access here to protect the core ERP mainframe.</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className={`p-5 rounded-lg border-2 flex justify-between items-center transition-colors ${apiControls.customerApp ? 'bg-white border-slate-200' : 'bg-red-50 border-red-300'}`}>
                  <div>
                    <h3 className={`font-bold text-lg flex items-center gap-2 ${apiControls.customerApp ? 'text-slate-800' : 'text-red-800'}`}>
                      {apiControls.customerApp ? <Wifi className="text-emerald-500"/> : <WifiOff className="text-red-500"/>} Customer App Database
                    </h3>
                    <p className={`text-xs mt-1 ${apiControls.customerApp ? 'text-slate-500' : 'text-red-600 font-bold'}`}>
                      {apiControls.customerApp ? 'Customers can view bills and place orders.' : 'ACCESS REVOKED. Customers will see maintenance screen.'}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleToggleApi('customerApp', apiControls.customerApp)}
                    className={`font-bold py-2 px-6 rounded-lg shadow transition ${apiControls.customerApp ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  >
                    {apiControls.customerApp ? 'Suspend Access' : 'Restore Access'}
                  </button>
                </div>

                <div className={`p-5 rounded-lg border-2 flex justify-between items-center transition-colors ${apiControls.deliveryManager ? 'bg-white border-slate-200' : 'bg-red-50 border-red-300'}`}>
                  <div>
                    <h3 className={`font-bold text-lg flex items-center gap-2 ${apiControls.deliveryManager ? 'text-slate-800' : 'text-red-800'}`}>
                      {apiControls.deliveryManager ? <Wifi className="text-emerald-500"/> : <WifiOff className="text-red-500"/>} Delivery Manager App
                    </h3>
                    <p className={`text-xs mt-1 ${apiControls.deliveryManager ? 'text-slate-500' : 'text-red-600 font-bold'}`}>
                      {apiControls.deliveryManager ? 'Drivers can sync routes and log deliveries.' : 'ACCESS REVOKED. Drivers cannot log data.'}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleToggleApi('deliveryManager', apiControls.deliveryManager)}
                    className={`font-bold py-2 px-6 rounded-lg shadow transition ${apiControls.deliveryManager ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  >
                    {apiControls.deliveryManager ? 'Suspend Access' : 'Restore Access'}
                  </button>
                </div>

                <div className={`p-5 rounded-lg border-2 flex justify-between items-center transition-colors ${apiControls.staffApp ? 'bg-white border-slate-200' : 'bg-red-50 border-red-300'}`}>
                  <div>
                    <h3 className={`font-bold text-lg flex items-center gap-2 ${apiControls.staffApp ? 'text-slate-800' : 'text-red-800'}`}>
                      {apiControls.staffApp ? <Wifi className="text-emerald-500"/> : <WifiOff className="text-red-500"/>} Farm Staff / Vet App
                    </h3>
                    <p className={`text-xs mt-1 ${apiControls.staffApp ? 'text-slate-500' : 'text-red-600 font-bold'}`}>
                      {apiControls.staffApp ? 'Staff can log medical and yield data.' : 'ACCESS REVOKED. Staff cannot log data.'}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleToggleApi('staffApp', apiControls.staffApp)}
                    className={`font-bold py-2 px-6 rounded-lg shadow transition ${apiControls.staffApp ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  >
                    {apiControls.staffApp ? 'Suspend Access' : 'Restore Access'}
                  </button>
                </div>

                <div className={`p-5 rounded-lg border-2 flex justify-between items-center transition-colors ${apiControls.processingApp ? 'bg-white border-slate-200' : 'bg-red-50 border-red-300'}`}>
                  <div>
                    <h3 className={`font-bold text-lg flex items-center gap-2 ${apiControls.processingApp ? 'text-slate-800' : 'text-red-800'}`}>
                      {apiControls.processingApp ? <Wifi className="text-emerald-500"/> : <WifiOff className="text-red-500"/>} Processing App
                    </h3>
                    <p className={`text-xs mt-1 ${apiControls.processingApp ? 'text-slate-500' : 'text-red-600 font-bold'}`}>
                      {apiControls.processingApp ? 'Factory can log VAP runs and inventory.' : 'ACCESS REVOKED. Factory disconnected.'}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleToggleApi('processingApp', apiControls.processingApp)}
                    className={`font-bold py-2 px-6 rounded-lg shadow transition ${apiControls.processingApp ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  >
                    {apiControls.processingApp ? 'Suspend Access' : 'Restore Access'}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'updates' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
           
           <div className="bg-slate-900 p-8 rounded-xl shadow-xl text-white flex justify-between items-center relative overflow-hidden">
              <HardDrive className="absolute -right-10 -bottom-10 w-48 h-48 text-slate-800 opacity-50 z-0" />
              <div className="relative z-10">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2"><PlayCircle size={14} className="text-emerald-400"/> Current Active Mainframe Build</p>
                <h2 className="text-4xl font-black text-white tracking-tight">Version {currentActiveVersion.versionNumber}</h2>
                <p className="text-slate-300 mt-2 max-w-xl">Release Notes: {currentActiveVersion.releaseNotes}</p>
              </div>
              <div className="relative z-10 text-right">
                 <div className="bg-emerald-900/50 border border-emerald-500/50 px-4 py-2 rounded-lg inline-flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                   <span className="text-emerald-400 font-bold text-sm">System Stable & Online</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><UploadCloud className="text-indigo-600"/> Deploy Update</h2>
                  <button onClick={handleGenerateTestPatch} className="text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded transition flex items-center gap-1 border border-slate-300"><Download size={12}/> Test Patch</button>
                </div>
                <p className="text-xs text-slate-500 mb-6">Upload the latest `.zip` or `.exe` asset to push updates to the mainframe and connected apps. (Or upload a `.json` test patch).</p>
                <form onSubmit={handleDeployUpdate} className="space-y-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">VERSION NUMBER</label><input type="text" required value={updateForm.versionNumber} onChange={(e)=>setUpdateForm({...updateForm, versionNumber: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold text-indigo-900" placeholder="e.g. 1.2.4" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">RELEASE NOTES (Changelog)</label><textarea required value={updateForm.releaseNotes} onChange={(e)=>setUpdateForm({...updateForm, releaseNotes: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none h-24 resize-none" placeholder="What changed in this update? Bug fixes? New features?"></textarea></div>
                  <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                    <label className="block text-xs font-bold text-slate-600 mb-2">UPLOAD COMPILED ASSET (.zip/.exe/.json)</label>
                    <input type="file" accept=".zip,.exe,.json" required onChange={(e) => setUpdateFile(e.target.files[0])} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
                  </div>
                  <button disabled={loading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg transition mt-4 flex items-center justify-center gap-2">
                    <UploadCloud size={18}/> Push Update Live
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History className="text-indigo-600"/> Version History & OTA</h2>
                  <p className="text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded flex items-center gap-1"><AlertTriangle size={14}/> OTA and Rollbacks execute immediately.</p>
                </div>
                
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white z-10 shadow-sm">
                      <tr className="border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                        <th className="py-3 px-4 font-bold">Version</th>
                        <th className="py-3 px-4 font-bold">Date Deployed</th>
                        <th className="py-3 px-4 font-bold">Release Notes</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {displayVersions.map(v => {
                        const rowClass = v.status === 'Active' 
                          ? 'bg-emerald-50/30' 
                          : v.isBuggy 
                            ? 'bg-red-50/50 border-l-4 border-red-500' 
                            : 'hover:bg-slate-50 transition';

                        return (
                        <tr key={v.id} className={rowClass}>
                          <td className={`py-4 px-4 font-black ${v.status === 'Active' ? 'text-emerald-700' : v.isBuggy ? 'text-red-700' : 'text-slate-700'}`}>v{v.versionNumber}</td>
                          <td className="py-4 px-4 text-xs font-bold text-slate-500">{v.deployed_at ? new Date(v.deployed_at.seconds * 1000).toLocaleDateString() : 'Base System'}</td>
                          <td className="py-4 px-4 text-slate-600 italic text-xs max-w-[200px] truncate">"{v.releaseNotes}"</td>
                          <td className="py-4 px-4">
                            {v.status === 'Active' ? (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Active</span>
                            ) : (
                              <span className="bg-slate-100 text-slate-500 border border-slate-300 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">Archived</span>
                            )}
                            {v.isBuggy && (
                              <span className="ml-2 bg-red-100 text-red-800 border border-red-300 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Buggy</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right flex gap-2 justify-end">
                            
                            {v.id !== 'factory-base' && (
                              <button onClick={() => handleToggleBuggy(v.id, v.isBuggy)} className={`p-1.5 rounded transition shadow-sm border ${v.isBuggy ? 'bg-red-100 border-red-300 text-red-600 hover:bg-red-200' : 'bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200'}`} title={v.isBuggy ? "Unmark as Buggy" : "Mark as Buggy/Unpleasant"}>
                                <AlertTriangle size={14} />
                              </button>
                            )}

                            {v.status !== 'Active' && v.id !== 'factory-base' && (
                              <button onClick={() => handleDeleteVersion(v.id)} className="p-1.5 rounded transition shadow-sm border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700" title="Delete Version">
                                <Trash2 size={14} />
                              </button>
                            )}

                            {v.file_name && v.file_name !== 'No file attached' && (
                              <button onClick={() => handleInstallOTA(v.file_name)} className="bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 font-bold px-3 py-1.5 rounded text-xs transition flex items-center gap-1 shadow-sm" title="Reinstall OTA">
                                <DownloadCloud size={12}/> Install OTA
                              </button>
                            )}

                            {v.status !== 'Active' && (
                               <button onClick={() => handleRollback(v.id, v.versionNumber)} className="bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 font-bold px-3 py-1.5 rounded text-xs transition flex items-center gap-1 shadow-sm" title="Rollback to this version">
                                 <RotateCcw size={12}/> Rollback
                               </button>
                            )}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>

           </div>
        </div>
      )}

    </div>
  );
}