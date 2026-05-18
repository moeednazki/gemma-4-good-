import { useState, useEffect, useRef } from 'react';
import { 
  HardDrive, DownloadCloud, UploadCloud, CheckCircle, 
  AlertTriangle, ShieldCheck, Database, RefreshCw, FileJson,
  ListChecks, ArrowRight, X, CheckSquare, XSquare, Inbox
} from 'lucide-react';
import { collection, addDoc, getDocs, serverTimestamp, deleteDoc, doc, query, orderBy, where, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function Backups() {
  const [activeTab, setActiveTab] = useState('inbox'); 
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  
  const [pendingItems, setPendingItems] = useState([]);
  const [syncReport, setSyncReport] = useState(null);

  const [lastBackupDate, setLastBackupDate] = useState(() => {
    return localStorage.getItem('fms_last_backup_date') || 'Never';
  });
  const [lastBackupSize, setLastBackupSize] = useState(() => {
    return localStorage.getItem('fms_last_backup_size') || '0 KB';
  });

  const fetchPendingData = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "quarantine_inbox"), orderBy("timestamp", "desc")));
      setPendingItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error fetching pending verifications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingData();
  }, [activeTab]);

  const getModuleName = (item) => {
    // Delivery App
    if (item.type === 'DELIVERY_LOG') return 'Delivery App -> Milk Drop';
    if (item.type === 'SPOILAGE_LOG') return 'Delivery App -> Spoilage Report';
    if (item.type === 'CUSTOMER_PAYMENT') return 'Delivery App -> Payment';
    if (item.type === 'INTERNAL_TRANSFER') return 'Delivery App -> Transfer';
    if (item.type === 'NEW_CUSTOMER') return 'Delivery App -> New Lead / Waitlist';
    
    // Farm Staff App
    if (item.type === 'MILK_YIELD') return 'Farm App -> Milk Yield';
    if (item.type === 'MEDICAL_LOG') return 'Farm App -> Medical Record';
    if (item.type === 'FEED_LOG') return 'Farm App -> Feed / Top Dress';

    const map = {
      'milk_deliveries': 'Logistics -> Milk Deliveries',
      'customer_payments': 'Logistics -> Customer Payments',
      'spoilage_logs': 'Logistics -> Spoilage & Loss',
      'customers': 'Logistics -> Customer Directory',
      'bottle_inventory': 'Logistics -> Bottle Inventory',
      'inventory': 'Economics -> Master Inventory',
      'vendor_payments': 'Economics -> Vendor Ledger',
      'utility_logs': 'Economics -> Utility Bills',
      'medical_records': 'Production -> Medical Records',
      'group_feed_logs': 'Production -> Group Feed Logs',
      'milk_records': 'Production -> Milk Yield Records',
      'vap_production_logs': 'Processing -> VAP Runs',
      'vap_sales': 'Processing -> VAP Sales'
    };
    return map[item.target_collection] || `System Database -> ${item.target_collection}`;
  };

  const formatRecordDetails = (item) => {
    if (!item) return 'Empty Record';

    // Live App Formats
    if (item.type === 'DELIVERY_LOG') return `${item.customer_name} -> ${item.liters}L (${(item.status || '').toUpperCase()})`;
    if (item.type === 'SPOILAGE_LOG') return `${item.source || item.item || 'Item'} -> Lost ${item.liters || item.qty}L (${item.loss_type || item.mistakeType || ''})`;
    if (item.type === 'INTERNAL_TRANSFER') return `Transfer -> ${item.liters}L to ${item.category}`;
    if (item.type === 'CUSTOMER_PAYMENT') return `${item.customer_name} -> Paid ₹${item.amount} via ${item.method}`;
    if (item.type === 'NEW_CUSTOMER') return `Lead: ${item.name || item.payload?.name} (${item.phone || item.payload?.phone || 'No Phone'}) - ${item.areaCircle || item.payload?.areaCircle || 'Unassigned'}`;
    if (item.type === 'MILK_YIELD') return `Tag: ${item.cow_id} -> Yielded ${item.yield_liters}L`;
    if (item.type === 'MEDICAL_LOG') return `Tag: ${item.cow_id} -> Treated for ${item.diagnosis} (₹${item.cost_incurred})`;
    if (item.type === 'FEED_LOG') return `${item.feed_type || 'Feed'} -> ${item.qty} units consumed`;

    const colKey = item.target_collection;
    const record = item.payload;
    if (!record) return 'Empty Payload';

    if (colKey === 'milk_deliveries') return `${record.customer_name || 'Unknown'} -> ${record.liters_delivered || 0} Liters (${record.shift || 'N/A'})`;
    if (colKey === 'customer_payments') return `${record.customer_name || 'Unknown'} -> Claims to have paid INR ${record.amount || 0} via ${record.method || 'Unknown Method'}`;
    if (colKey === 'inventory') return `${record.item_name || 'Item'} from ${record.vendor || 'Vendor'} -> ${record.total_quantity || 0} ${record.unit || ''} (INR ${record.total_cost || 0})`;
    if (colKey === 'spoilage_logs') return `${record.item || 'Item'} -> Lost ${record.qty || 0} units due to ${record.mistakeType || 'Unknown'}`;
    if (colKey === 'milk_records') return `Cow ${record.cow_id || 'Tag'} -> Yielded ${record.yield_liters || 0}L on ${record.date || 'N/A'}`;
    if (colKey === 'vendor_payments') return `Paid ${record.vendor || 'Vendor'} -> INR ${record.amount || 0} via ${record.method || 'Cash'}`;
    
    return `ID: ${record.customer_display_id || record.name || record.item || 'System Record'}`;
  };

  const handleDownloadBackup = async () => {
    setLoading(true);
    try {
      const collectionsToBackup = [
        "customers", "milk_deliveries", "customer_payments", "waitlist",
        "inventory", "vendor_payments", "vendors", "invoices",
        "employees", "employee_transactions", "cows", "herd", "livestock",
        "medical_records", "group_feed_logs", "spoilage_logs", "utility_logs"
      ];

      const backupData = {};

      for (const colName of collectionsToBackup) {
        const snap = await getDocs(collection(db, colName)).catch(() => ({docs: []}));
        backupData[colName] = snap.docs.map(doc => {
          const data = doc.data();
          Object.keys(data).forEach(key => {
            if (data[key] && typeof data[key] === 'object' && data[key].seconds) {
              data[key] = new Date(data[key].seconds * 1000).toISOString();
            }
          });
          return { _id: doc.id, ...data };
        });
      }

      backupData._metadata = {
        exported_at: new Date().toISOString(),
        system: "FMS Mainframe v1.0",
        total_collections: collectionsToBackup.length
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const sizeKB = (blob.size / 1024).toFixed(2);
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `FMS_MAINFRAME_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const nowStr = new Date().toLocaleString();
      setLastBackupDate(nowStr);
      setLastBackupSize(`${sizeKB} KB`);
      localStorage.setItem('fms_last_backup_date', nowStr);
      localStorage.setItem('fms_last_backup_size', `${sizeKB} KB`);

      alert("Hard backup successfully generated and downloaded!");
    } catch (error) {
      console.error("Backup failed:", error);
      alert("Critical Error: Failed to generate system backup.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSync = async (e) => {
    e.preventDefault();
    if (!uploadFile) return alert("Please select a JSON file to upload.");

    if (uploadFile.type !== "application/json" && !uploadFile.name.endsWith('.json')) {
      return alert("Invalid file format. Ensure the file is strictly saved as a .json file.");
    }

    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const fileContent = event.target.result;
        const parsedData = JSON.parse(fileContent);
        
        let recordsProcessed = 0;
        let collectionsTouched = 0;
        const reportLog = {}; 

        for (const [collectionName, recordsArray] of Object.entries(parsedData)) {
          if (collectionName.startsWith('_')) continue; 
          
          if (Array.isArray(recordsArray) && recordsArray.length > 0) {
            collectionsTouched++;
            reportLog[collectionName] = []; 
            
            for (const record of recordsArray) {
              const { _id, ...cleanRecord } = record; 
              
              await addDoc(collection(db, "quarantine_inbox"), {
                target_collection: collectionName,
                payload: cleanRecord,
                source: "Offline JSON Sync",
                status: "Pending",
                timestamp: serverTimestamp() 
              });

              reportLog[collectionName].push(formatRecordDetails({target_collection: collectionName, payload: cleanRecord}));
              recordsProcessed++;
            }
          }
        }

        setSyncReport({
          totalRecords: recordsProcessed,
          totalDatabases: collectionsTouched,
          details: reportLog
        });

        setUploadFile(null);
        document.getElementById('offline-sync-input').value = '';
        fetchPendingData();

      } catch (error) {
        console.error("Sync Parse Error:", error);
        alert("Failed to parse or upload the backup file. Ensure it is a valid JSON file generated by the App.");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(uploadFile);
  };

  // =========================================================================
  // UNIVERSAL APPROVAL & ACCOUNTING ENGINE
  // =========================================================================
  const processApproval = async (item) => {
    let targetCol = item.target_collection;
    let finalPayload = item.payload ? { ...item.payload } : {};
    let customerIdToAttach = null;
    let customerDisplayIdToAttach = null;

    // --- PHASE 1: ROUTE LIVE APP TYPES ---
    if (item.type === 'DELIVERY_LOG') {
      targetCol = 'milk_deliveries';
      finalPayload = { ...item };
    } else if (item.type === 'CUSTOMER_PAYMENT') {
      targetCol = 'customer_payments';
      finalPayload = { ...item };
    } else if (item.type === 'SPOILAGE_LOG') {
      targetCol = 'spoilage_logs';
      finalPayload = { ...item };
    } else if (item.type === 'INTERNAL_TRANSFER') {
      targetCol = 'internal_transfers';
      finalPayload = { ...item };
    } else if (item.type === 'NEW_CUSTOMER') {
      targetCol = 'customers'; 
      finalPayload = item.payload ? { ...item.payload } : { ...item };
      finalPayload.status = 'Active';
      finalPayload.deliveryFrequency = 'Daily';
      finalPayload.type = 'Residential';
      finalPayload.pricePerLiter = 60; // Standard default price (Admin can edit later)
      finalPayload.isStaff = false;
    } else if (item.type === 'MILK_YIELD') {
      targetCol = 'milk_records';
      finalPayload = { ...item };
    } else if (item.type === 'MEDICAL_LOG') {
      targetCol = 'medical_records';
      finalPayload = { ...item };
    } else if (item.type === 'FEED_LOG') {
      targetCol = 'group_feed_logs';
      finalPayload = { ...item };
    }

    if (!targetCol) {
      await deleteDoc(doc(db, 'quarantine_inbox', item.id));
      return;
    }

    // --- PHASE 2: DATA NORMALIZATION ---
    if (targetCol === 'milk_deliveries') {
      // 1. Ensure Customer ID and Pricing
      if (finalPayload.customer_id) {
         customerIdToAttach = finalPayload.customer_id;
         customerDisplayIdToAttach = finalPayload.customer_display_id || '--';
      } 
      else if (finalPayload.customer_name) {
        // 1st Check: Is this a regular Customer?
        const custSnap = await getDocs(query(collection(db, 'customers'), where('name', '==', finalPayload.customer_name)));
        
        if (!custSnap.empty) {
          const custData = custSnap.docs[0].data();
          customerIdToAttach = custSnap.docs[0].id;
          customerDisplayIdToAttach = custData.displayId || '--';
          finalPayload.price_per_liter = parseFloat(custData.pricePerLiter) || 60;
          finalPayload.area_circle = custData.areaCircle || 'Unassigned';
          finalPayload.is_staff = custData.isStaff || false;
        } else {
          // 2nd Check (THE FIX): Search the Employees database!
          const empSnap = await getDocs(query(collection(db, 'employees'), where('name', '==', finalPayload.customer_name)));
          if (!empSnap.empty) {
            const empData = empSnap.docs[0].data();
            customerIdToAttach = empSnap.docs[0].id;
            customerDisplayIdToAttach = empData.emp_id || '--';
            finalPayload.price_per_liter = 60; // Standard Farm Staff rate
            finalPayload.area_circle = empData.areaCircle || 'Farm / Staff';
            finalPayload.is_staff = true;
          }
        }
      }

      // 2. Ensure Date exists
      if (!finalPayload.date) {
        finalPayload.date = new Date().toISOString().split('T')[0];
      }

      // 3. Ensure Math / Total Value exists
      const liters = parseFloat(finalPayload.liters_delivered || finalPayload.liters || 0);
      const price = parseFloat(finalPayload.price_per_liter || 60);
      const broken = parseInt(finalPayload.bottles_broken || 0);

      finalPayload.liters_delivered = liters;
      finalPayload.total_value = (liters * price) + (broken * 50);
      
      // Distinguish status for staff vs residential
      finalPayload.status = finalPayload.is_staff ? 'Staff_Incentive' : 'Billed';
      finalPayload.shift = finalPayload.shift || 'Route Delivery';
      
    } else if (targetCol === 'customer_payments') {
      if (!finalPayload.date) finalPayload.date = new Date().toISOString().split('T')[0];
      if (!finalPayload.method) finalPayload.method = 'App / Offline Sync';
      if (finalPayload.customer_name) {
        const custSnap = await getDocs(query(collection(db, 'customers'), where('name', '==', finalPayload.customer_name)));
        if (!custSnap.empty) customerIdToAttach = custSnap.docs[0].id;
      }
    } else if (targetCol === 'customers') {
      // THE FIX: Generate the Invariant UID for the new customer
      const custSnap = await getDocs(collection(db, 'customers'));
      const count = custSnap.size;
      const areaName = finalPayload.areaCircle || finalPayload.area_circle || 'Unassigned';
      const d = new Date();
      const MM = String(d.getMonth() + 1).padStart(2, '0');
      const YY = String(d.getFullYear()).slice(-2);
      const ac = areaName ? String((areaName.charCodeAt(0) + areaName.charCodeAt(areaName.length-1)) % 90 + 10) : '99';
      finalPayload.displayId = `${ac}${MM}${YY}00${String(count + 1).padStart(2, '0')}`;
    }

    // --- PHASE 3: SAVE TO PRIMARY LEDGER ---
    const recordToSave = {
      ...finalPayload,
      verified_by: 'Admin',
      verified_at: serverTimestamp()
    };

    if (customerIdToAttach) recordToSave.customer_id = customerIdToAttach;
    if (customerDisplayIdToAttach) recordToSave.customer_display_id = customerDisplayIdToAttach;

    delete recordToSave.type;
    delete recordToSave.payload;
    delete recordToSave.target_collection;
    delete recordToSave.id;

    // If it's a customer, save using their new displayId as the Document ID
    if (targetCol === 'customers' && recordToSave.displayId) {
      await setDoc(doc(db, targetCol, recordToSave.displayId), recordToSave);
    } else {
      await addDoc(collection(db, targetCol), recordToSave);
    }

    // --- PHASE 3.5: THE STAFF INCENTIVE FORWARDING ENGINE ---
    if (targetCol === 'milk_deliveries' && recordToSave.is_staff) {
      const milkValue = (parseFloat(recordToSave.liters_delivered) || 0) * parseFloat(recordToSave.price_per_liter || 60);
      
      await addDoc(collection(db, "employee_transactions"), {
        emp_id: recordToSave.customer_id,
        emp_name: recordToSave.customer_name,
        type: 'Milk_Incentive',
        amount: milkValue,
        liters: parseFloat(recordToSave.liters_delivered) || 0,
        date: recordToSave.date,
        notes: `Auto-logged from Route Delivery (${recordToSave.shift}) - Sync Hub Verification`,
        recorded_at: serverTimestamp()
      });
    }

    // --- PHASE 4: CLEAR FROM INBOX ---
    await deleteDoc(doc(db, 'quarantine_inbox', item.id));
  };

  const handleApprove = async (item) => {
    setLoading(true);
    try {
      await processApproval(item);
      fetchPendingData();
    } catch (e) {
      alert("Error approving record.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Reject and permanently delete this incoming record?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "quarantine_inbox", id));
      fetchPendingData();
    } catch (e) {
      alert("Error rejecting record.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAll = async () => {
    if (!window.confirm(`Are you sure you want to bulk approve all ${pendingItems.length} pending records into the live system?`)) return;
    setLoading(true);
    try {
      for (const item of pendingItems) {
        await processApproval(item);
      }
      alert("All records successfully approved and merged into live databases.");
      fetchPendingData();
    } catch(e) {
      alert("Error during bulk approval.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 relative">
      
      {syncReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-amber-500 p-5 text-amber-950 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black flex items-center gap-2 tracking-wide"><ShieldCheck size={22}/> Data Quarantined Successfully</h3>
                <p className="text-amber-900 text-xs font-bold mt-1 uppercase tracking-widest">
                  {syncReport.totalRecords} records sent to the Verification Inbox.
                </p>
              </div>
              <button onClick={() => setSyncReport(null)} className="hover:bg-amber-400 p-2 rounded-full transition"><X size={24}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1 space-y-6">
              <p className="text-sm text-slate-600 font-medium mb-4">
                The offline data package has been parsed. For security, these records have NOT been added to your live ledger yet. They are waiting for your approval in the Verification Inbox.
              </p>

              {Object.entries(syncReport.details).map(([collectionKey, records]) => (
                <div key={collectionKey} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                    <Database size={16} className="text-amber-600"/>
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">{getModuleName({target_collection: collectionKey})}</h4>
                    <span className="ml-auto bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">{records.length} Entries</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {records.map((recStr, idx) => (
                      <li key={idx} className="px-4 py-3 text-sm text-slate-700 flex items-start gap-3 hover:bg-slate-50 transition">
                        <ArrowRight size={14} className="text-amber-500 shrink-0 mt-0.5"/>
                        <span className="font-medium">{recStr}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <button onClick={() => { setSyncReport(null); setActiveTab('inbox'); }} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg shadow transition">
                Go to Verification Inbox
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 p-8 rounded-xl shadow-xl text-white relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
        <Database className="absolute -left-10 -bottom-10 w-48 h-48 text-slate-800 opacity-50 z-0" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
            <ShieldCheck size={32} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Data Security & Sync Hub</h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Verify incoming app data, manage local hard backups, and manually merge offline `.json` data packages securely.
            </p>
          </div>
        </div>
        <div className="relative z-10">
          <div className="bg-emerald-900/30 border border-emerald-500/30 px-4 py-2 rounded-lg flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-emerald-400 font-bold text-sm tracking-widest uppercase">System Protected</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto bg-white p-2 rounded-xl shadow-sm px-4">
        <button onClick={() => setActiveTab('inbox')} className={`py-3 px-4 font-bold transition flex items-center gap-2 ${activeTab === 'inbox' ? 'border-b-2 border-amber-500 text-amber-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>
          <Inbox size={18}/> Verification Inbox {pendingItems.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{pendingItems.length}</span>}
        </button>
        <button onClick={() => setActiveTab('sync')} className={`py-3 px-4 font-bold transition flex items-center gap-2 ${activeTab === 'sync' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>
          <RefreshCw size={18}/> Offline Sync (Upload)
        </button>
        <button onClick={() => setActiveTab('backup')} className={`py-3 px-4 font-bold transition flex items-center gap-2 ${activeTab === 'backup' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>
          <HardDrive size={18}/> Mainframe Hard Backup
        </button>
      </div>

      {activeTab === 'inbox' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ListChecks className="text-amber-500"/> Verification Quarantine</h2>
                <p className="text-sm text-slate-500 mt-1">Data from Live Apps and Offline Syncs land here. Approve them to inject them into the live financial ledger.</p>
              </div>
              {pendingItems.length > 0 && (
                <button onClick={handleApproveAll} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow transition disabled:bg-slate-400">
                  <CheckSquare size={18}/> Bulk Approve All
                </button>
              )}
            </div>

            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 sticky top-0 shadow-sm border-b-2 border-slate-200 z-10">
                  <tr className="text-slate-500 text-[10px] uppercase tracking-wider">
                    <th className="py-3 px-4 font-bold">Time Received</th>
                    <th className="py-3 px-4 font-bold">Source / App</th>
                    <th className="py-3 px-4 font-bold">Target Ledger</th>
                    <th className="py-3 px-4 font-bold">Record Details</th>
                    <th className="py-3 px-4 font-bold text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const newLeads = pendingItems.filter(i => i.type === 'NEW_CUSTOMER');
                    const deliveryData = pendingItems.filter(i => ['DELIVERY_LOG', 'SPOILAGE_LOG', 'CUSTOMER_PAYMENT', 'INTERNAL_TRANSFER'].includes(i.type));
                    const farmData = pendingItems.filter(i => ['MILK_YIELD', 'MEDICAL_LOG', 'FEED_LOG'].includes(i.type));
                    const otherData = pendingItems.filter(i => !['NEW_CUSTOMER', 'DELIVERY_LOG', 'SPOILAGE_LOG', 'CUSTOMER_PAYMENT', 'INTERNAL_TRANSFER', 'MILK_YIELD', 'MEDICAL_LOG', 'FEED_LOG'].includes(i.type));

                    const renderRows = (items, bgColorClass) => items.map(item => (
                      <tr key={item.id} className={`${bgColorClass} transition`}>
                        <td className="py-3 px-4 text-xs font-bold text-slate-500">
                          {(item.timestamp || item.recorded_at) ? new Date((item.timestamp || item.recorded_at).seconds * 1000).toLocaleString() : 'Just Now'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-white text-slate-700 shadow-sm border border-slate-200 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
                            {item.type ? 'Live App' : (item.source || 'Offline Sync')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {getModuleName(item)}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-600">
                          {formatRecordDetails(item)}
                          {item.has_proof && item.proof_url && (
                            <a 
                              href={item.proof_url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded ml-2 hover:bg-blue-100 transition"
                            >
                              View Receipt
                            </a>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleApprove(item)} disabled={loading} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300 font-bold px-3 py-1.5 rounded flex items-center gap-1 text-xs transition disabled:opacity-50">
                              <CheckSquare size={14}/> Approve
                            </button>
                            <button onClick={() => handleReject(item.id)} disabled={loading} className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-bold px-3 py-1.5 rounded flex items-center gap-1 text-xs transition disabled:opacity-50">
                              <XSquare size={14}/> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ));

                    return (
                      <>
                        {newLeads.length > 0 && (
                          <>
                            <tr><td colSpan="5" className="bg-amber-100 text-amber-900 font-black px-4 py-2 uppercase tracking-widest text-[10px]">Customer Management</td></tr>
                            {renderRows(newLeads, 'hover:bg-amber-50')}
                          </>
                        )}
                        {deliveryData.length > 0 && (
                          <>
                            <tr><td colSpan="5" className="bg-blue-100 text-blue-900 font-black px-4 py-2 uppercase tracking-widest text-[10px]">Delivery App Data</td></tr>
                            {renderRows(deliveryData, 'hover:bg-blue-50')}
                          </>
                        )}
                        {farmData.length > 0 && (
                          <>
                            <tr><td colSpan="5" className="bg-emerald-100 text-emerald-900 font-black px-4 py-2 uppercase tracking-widest text-[10px]">Farm / Vet App Data</td></tr>
                            {renderRows(farmData, 'hover:bg-emerald-50')}
                          </>
                        )}
                        {otherData.length > 0 && (
                          <>
                            <tr><td colSpan="5" className="bg-slate-200 text-slate-700 font-black px-4 py-2 uppercase tracking-widest text-[10px]">System Syncs / Other</td></tr>
                            {renderRows(otherData, 'hover:bg-slate-100')}
                          </>
                        )}
                        {pendingItems.length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-16 text-center">
                              <CheckCircle className="text-emerald-300 mx-auto mb-3" size={48} />
                              <p className="text-slate-500 font-bold text-lg">Inbox Zero</p>
                              <p className="text-slate-400 text-sm">No pending app submissions to verify.</p>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4 shrink-0">
              <RefreshCw className="text-indigo-600" size={24} />
              <div>
                <h2 className="text-lg font-bold text-slate-800">Upload Offline App Data</h2>
                <p className="text-xs text-slate-500 mt-1">Upload `.json` routing packages extracted from the Delivery or Vet App during offline operations.</p>
              </div>
            </div>

            <form onSubmit={handleUploadSync} className="space-y-6 flex-1 flex flex-col">
              <div className="flex-1 p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-center hover:bg-slate-100 transition cursor-pointer relative min-h-[200px] flex items-center justify-center">
                <input 
                  id="offline-sync-input"
                  type="file" 
                  accept=".json" 
                  required 
                  onChange={(e) => setUploadFile(e.target.files[0])} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                />
                <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <FileJson size={48} className={uploadFile ? "text-indigo-500" : "text-slate-400"} />
                  {uploadFile ? (
                    <p className="font-bold text-indigo-700 text-lg">{uploadFile.name}</p>
                  ) : (
                    <>
                      <p className="font-bold text-slate-600 text-lg">Click to browse or drag JSON here</p>
                      <p className="text-sm text-slate-400">Strictly accepts valid .json files</p>
                    </>
                  )}
                </div>
              </div>

              <button 
                disabled={loading || !uploadFile} 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed shrink-0 text-lg"
              >
                <UploadCloud size={24}/> {loading ? 'Processing Upload...' : 'UPLOAD TO QUARANTINE INBOX'}
              </button>
            </form>

            <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-start gap-3 shrink-0">
              <ShieldCheck className="text-blue-600 shrink-0" size={20} />
              <p className="text-xs text-blue-800 font-medium leading-relaxed">
                <strong>Protected Architecture:</strong> Uploaded data will NOT immediately enter the live databases. It will be routed to the <strong>Verification Inbox</strong> so you can approve the entries first.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4 shrink-0">
              <HardDrive className="text-emerald-600" size={24} />
              <div>
                <h2 className="text-lg font-bold text-slate-800">Mainframe Hard Backup</h2>
                <p className="text-xs text-slate-500 mt-1">Download a complete snapshot of all customers, inventory, and cattle records to your local drive.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-xl border border-slate-200 flex-1 flex flex-col justify-center text-center">
              
              <Database size={64} className="text-emerald-300 mx-auto mb-6" />

              <div className="grid grid-cols-2 gap-4 mb-8 text-left">
                <div className="bg-white p-5 rounded-lg border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">LAST BACKUP CREATED</p>
                  <p className="text-lg font-black text-slate-800">{lastBackupDate}</p>
                </div>
                <div className="bg-white p-5 rounded-lg border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">LATEST EXPORT SIZE</p>
                  <p className="text-lg font-black text-blue-600">{lastBackupSize}</p>
                </div>
              </div>

              <button 
                onClick={handleDownloadBackup} 
                disabled={loading} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 mt-auto disabled:bg-slate-400 text-lg"
              >
                <DownloadCloud size={24}/> {loading ? 'Compiling Full System Backup...' : 'DOWNLOAD SECURE JSON BACKUP'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}