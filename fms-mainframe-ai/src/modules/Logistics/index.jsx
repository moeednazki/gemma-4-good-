import { useState, useEffect, useRef } from 'react';
import { 
  Truck, Users, FileText, Plus, Save, Search, MapPin, Phone, 
  UserCheck, Calendar, Banknote, Edit, Trash2, X, CheckCircle, 
  AlertCircle, Clock, Milk, Map as MapIcon, Activity, Layers, Coins,
  MessageCircle, Send, Bell, FileSpreadsheet, Download, Printer, Settings,
  ListPlus, Beaker, PackageMinus, IndianRupee, AlertOctagon, History as HistoryIcon, UploadCloud, ArrowRightLeft,
  Brain, Sparkles
} from 'lucide-react';
import { collection, addDoc, getDocs, getDoc, serverTimestamp, query, orderBy, doc, updateDoc, deleteDoc, where, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import * as XLSX from 'xlsx'; 
import { askGemma } from "../../services/AIEngine";

const getIsEvenCycle = (dateString) => {
  const epoch = new Date('2020-01-01T12:00:00Z'); 
  const target = new Date(dateString + 'T12:00:00Z');
  const diffDays = Math.floor((target - epoch) / (1000 * 60 * 60 * 24));
  return diffDays % 2 === 0;
};

export default function Logistics() {
  const [activeTab, setActiveTab] = useState('route'); 
  const [loading, setLoading] = useState(false);
  
  // Core Databases
  const [customers, setCustomers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [payments, setPayments] = useState([]); 
  const [areaSettings, setAreaSettings] = useState({}); 
  const [waitlist, setWaitlist] = useState([]);
  const [bottleLogs, setBottleLogs] = useState([]);
  const [spoilageLogs, setSpoilageLogs] = useState([]); 
  const [livestock, setLivestock] = useState([]); 
  const [invoices, setInvoices] = useState([]);
  const [dispatchLogs, setDispatchLogs] = useState([]); 

  // Document & Print States
  const [documentTemplates, setDocumentTemplates] = useState([]);
  const [printingDoc, setPrintingDoc] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Routing States
  const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('Morning');
  const [routeFilterArea, setRouteFilterArea] = useState(''); 
  const [routeLogs, setRouteLogs] = useState({}); 
  const [dispatchVolume, setDispatchVolume] = useState(''); 
  const [spotSale, setSpotSale] = useState({ qty: '', amount: '', broken: '', wasFilled: false, spoiled: '' }); 
  const [internalUse, setInternalUse] = useState({ qty: '', purpose: 'Transfer to Processing', notes: '' });

  // History & Ledger States
  const [selectedHistoryCustomer, setSelectedHistoryCustomer] = useState('');
  const [historyMonth, setHistoryMonth] = useState(''); 
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyRoute, setHistoryRoute] = useState('');
  
  // Customer Management States
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [newCustomer, setNewCustomer] = useState({
    name: '', phone: '', address: '', areaCircle: '', deliveryFrequency: 'Daily', type: 'Residential', pricePerLiter: '', status: 'Active', openingBalance: ''
  });

  const [newWaitlist, setNewWaitlist] = useState({ name: '', phone: '', address: '', notes: '' });
  const [bottleForm, setBottleForm] = useState({ type: 'Purchase', qty: '', cost: '', notes: '' });
  const [manualSpoilage, setManualSpoilage] = useState({ date: new Date().toISOString().split('T')[0], item: 'Raw Milk', qty: '', mistakeType: 'Storage / Souring', financialLoss: '', explanation: '' });

  const [billingMonth, setBillingMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showDefaulters, setShowDefaulters] = useState(false);
  const [paymentModal, setPaymentModal] = useState({ show: false, customer: null, amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0], notes: '' });
  const [adjustmentModal, setAdjustmentModal] = useState({ show: false, customer: null, amount: '', type: 'Charge', date: new Date().toISOString().split('T')[0], notes: '' });

  // === AI LOGISTICS STATE ===
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState(null);

  const fileInputRef = useRef(null);

  const uniqueAreaCircles = [...new Set(customers.map(c => c.areaCircle).filter(Boolean))];

  const fetchData = async () => {
    setLoading(true);
    try {
      const custSnap = await getDocs(query(collection(db, "customers"), orderBy("name", "asc"))).catch(() => ({docs: []}));
      const regularCustomers = custSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const empSnap = await getDocs(collection(db, "employees")).catch(() => ({docs: []}));
      
      const staffCustomers = empSnap.docs.map(d => {
        const emp = d.data();
        return {
          id: d.id, 
          displayId: `EMP-${(emp.name || 'UNK').substring(0,3).toUpperCase()}`,
          name: emp.name || 'Unknown', 
          phone: emp.phone || '', 
          address: emp.address || 'Farm Staff', 
          areaCircle: emp.areaCircle || 'Farm / Staff',
          deliveryFrequency: emp.deliveryFrequency || 'Daily', 
          type: 'Staff', 
          pricePerLiter: 60, 
          isStaff: true, 
          status: 'Active'
        };
      });

      const filteredRegular = regularCustomers.filter(c => !c.isStaff);
      setCustomers([...filteredRegular, ...staffCustomers].sort((a,b) => (a.name || '').localeCompare(b.name || '')));

      const dispatchSnap = await getDocs(query(collection(db, "dispatch_logs"), orderBy("timestamp", "desc"))).catch(() => ({docs: []}));
      setDispatchLogs(dispatchSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      setDeliveries((await getDocs(query(collection(db, "milk_deliveries"), orderBy("date", "desc"))).catch(() => ({docs: []}))).docs.map(d => ({ id: d.id, ...d.data() })));
      setPayments((await getDocs(query(collection(db, "customer_payments"), orderBy("date", "desc"))).catch(() => ({docs: []}))).docs.map(d => ({ id: d.id, ...d.data() })));
      setWaitlist((await getDocs(query(collection(db, "waitlist"), orderBy("recorded_at", "desc"))).catch(() => ({docs: []}))).docs.map(d => ({ id: d.id, ...d.data() })));
      setBottleLogs((await getDocs(query(collection(db, "bottle_inventory"), orderBy("recorded_at", "desc"))).catch(() => ({docs: []}))).docs.map(d => ({ id: d.id, ...d.data() })));
      setSpoilageLogs((await getDocs(query(collection(db, "spoilage_logs"), orderBy("recorded_at", "desc"))).catch(() => ({docs: []}))).docs.map(d => ({ id: d.id, ...d.data() })));
      
      const tempSnap = await getDocs(query(collection(db, "document_templates"), orderBy("name", "asc"))).catch(() => ({docs: []}));
      setDocumentTemplates(tempSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const invSnap = await getDocs(collection(db, "invoices")).catch(() => ({docs: []}));
      setInvoices(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const cSnap = await getDocs(collection(db, "cows")).catch(() => ({docs: []}));
      const hSnap = await getDocs(collection(db, "herd")).catch(() => ({docs: []}));
      const lSnap = await getDocs(collection(db, "livestock")).catch(() => ({docs: []}));
      
      const combinedAnimals = [...cSnap.docs, ...hSnap.docs, ...lSnap.docs].map(d => ({ docId: d.id, ...d.data() }));
      
      const uniqueObj = {};
      combinedAnimals.forEach(animal => {
        const key = animal.id || animal.tag || animal.docId;
        if (key) uniqueObj[key] = animal;
      });
      setLivestock(Object.values(uniqueObj).sort((a,b) => String(a.tag || a.id || '').localeCompare(String(b.tag || b.id || ''))));

      const areaSnap = await getDocs(query(collection(db, "area_settings"))).catch(() => ({docs: []}));
      const settingsMap = {};
      areaSnap.docs.forEach(d => { settingsMap[d.data().areaName] = d.data().scheduleType; });
      setAreaSettings(settingsMap);
    } catch (e) { console.error("Error fetching logistics data:", e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  useEffect(() => {
    const activeAreas = uniqueAreaCircles.filter(a => a !== 'Unassigned' && a !== '');
    if (activeAreas.length > 0 && routeDate) {
      const isEvenDay = getIsEvenCycle(routeDate);
      const scheduledArea = Object.keys(areaSettings).find(area => 
        (isEvenDay && areaSettings[area] === 'Even Days') || 
        (!isEvenDay && areaSettings[area] === 'Odd Days')
      );
      if (scheduledArea) setRouteFilterArea(scheduledArea);
    }
  }, [routeDate, areaSettings, customers.length]);

  const generateInvariantID = (areaName, offset = 0) => {
    const d = new Date();
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const YY = String(d.getFullYear()).slice(-2);
    const ac = areaName ? String((areaName.charCodeAt(0) + areaName.charCodeAt(areaName.length-1)) % 90 + 10) : '99';
    const sn = String(customers.length + offset + 1).padStart(2, '0'); 
    return `${ac}${MM}${YY}00${sn}`;
  };

  const getCustomerLedgerData = (customerId) => {
    const custDeliveries = deliveries.filter(d => d.customer_id === customerId);
    const custPayments = payments.filter(p => p.customer_id === customerId);
    
    const allTimeBilled = custDeliveries.reduce((sum, d) => sum + (parseFloat(d.total_value) || 0), 0);
    const allTimePaid = custPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const netBalance = allTimeBilled - allTimePaid; 

    return { allTimeBilled, allTimePaid, netBalance, custDeliveries, custPayments };
  };

  const billingData = customers.map(cust => {
    const { allTimeBilled, allTimePaid, netBalance, custDeliveries } = getCustomerLedgerData(cust.id);
    
    const currentMonthDeliveries = custDeliveries.filter(d => (d.date||'').startsWith(billingMonth));
    const totalLiters = currentMonthDeliveries.reduce((sum, d) => sum + (parseFloat(d.liters_delivered)||0), 0);
    const brokenBottles = currentMonthDeliveries.reduce((sum, d) => sum + (parseInt(d.bottles_broken) || 0), 0);
    const currentMonthBilled = currentMonthDeliveries.reduce((sum, d) => sum + (parseFloat(d.total_value)||0), 0);

    return { 
      ...cust, totalLiters, brokenBottles, currentMonthBilled, 
      allTimeBilled, allTimePaid, netBalance, deliveryCount: currentMonthDeliveries.length 
    };
  }).filter(c => c.deliveryCount > 0 || c.netBalance !== 0); 

  const defaulters = billingData.filter(c => c.netBalance > 0 && !c.isStaff);

  // HYBRID LOGIC: Auto-fetch driver dispatches for this shift
  const todaysDispatches = dispatchLogs.filter(log => {
    if (!log.timestamp) return false;
    const logDate = new Date(log.timestamp.seconds * 1000).toISOString().split('T')[0];
    return logDate === routeDate && log.shift === shift;
  });
  const totalAutoDispatched = todaysDispatches.reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);

  const totalLoggedLiters = Object.values(routeLogs).reduce((acc, curr) => acc + (parseFloat(curr.qty) || 0), 0) 
                            + (parseFloat(spotSale.qty) || 0)
                            + (parseFloat(internalUse.qty) || 0);

  const totalDispatched = parseFloat(dispatchVolume) || 0;
  const unaccountedMilk = totalDispatched > 0 ? (totalDispatched - totalLoggedLiters).toFixed(1) : 0;

  // === AI FULFILLMENT & LOGISTICS EVALUATOR ===
  const handleLogisticsAnalysis = async () => {
    setIsAiLoading(true);
    setAiReport(null);
    try {
      const payload = {
        active_customers: customers.length,
        waitlist_leads: waitlist.length,
        todays_dispatched_volume: totalAutoDispatched,
        todays_successfully_delivered: totalLoggedLiters,
        unaccounted_milk: unaccountedMilk,
        total_arrears: defaulters.reduce((sum, c) => sum + c.netBalance, 0),
        number_of_defaulters: defaulters.length,
        spoilage_events: spoilageLogs.length
      };

      const sysCtx = `You are the NooRganic Logistics AI, an expert supply chain and fulfillment manager for a dairy farm.
      Analyze the provided logistics JSON data.
      1. Evaluate the supply vs. demand efficiency (unaccounted milk vs delivered).
      2. Identify operational bottlenecks (spoilage, waitlist conversion opportunities, or high arrears).
      3. Provide 3 concrete, actionable recommendations to optimize route profitability and customer onboarding.
      CRITICAL INSTRUCTION: Keep the response concise, professional, and actionable. Do not use generic filler. Format currency as INR (₹).`;

      const response = await askGemma(JSON.stringify(payload, null, 2), sysCtx);
      setAiReport(response);
    } catch (e) {
      setAiReport("Connection Error: Unable to reach the AI Engine.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleDualSync = async () => {
    if (dispatchVolume !== '' && parseFloat(dispatchVolume) !== totalAutoDispatched) {
      if (window.confirm(`DUAL-SYNC ACTIVATED:\n\nYou manually typed ${dispatchVolume}L, but the app logged ${totalAutoDispatched}L.\n\nClick OK to PUSH your correction to the cloud.\nClick Cancel to PULL the app's total and overwrite your typing.`)) {
        setLoading(true);
        try {
          await addDoc(collection(db, "dispatch_logs"), {
            qty: parseFloat(dispatchVolume) - totalAutoDispatched,
            shift: shift,
            timestamp: serverTimestamp(),
            notes: 'Mainframe Admin Correction'
          });
          fetchData();
          alert("Correction synced to the cloud!");
        } catch (e) { alert("Error pushing correction."); }
        setLoading(false);
        return;
      }
    }
    setDispatchVolume(totalAutoDispatched.toString());
  };

  const handleDeleteDispatchLog = async (id) => {
    if(window.confirm("Delete this dispatch entry? This will instantly correct the 'Total Auto-Dispatched' amount.")) {
      try { 
        await deleteDoc(doc(db, "dispatch_logs", id)); 
        fetchData(); 
      } catch(e) { alert("Error deleting dispatch log."); }
    }
  };

  const handleBlastDefaulters = async () => {
    if(!window.confirm(`Send a push notification reminder to ALL ${defaulters.length} defaulters?`)) return;
    setLoading(true);
    let successCount = 0;
    try {
      for (const cust of defaulters) {
         const userSnap = await getDoc(doc(db, "customers", cust.id));
         if (userSnap.exists() && userSnap.data().pushToken) {
           await fetch("https://exp.host/--/api/v2/push/send", {
             method: "POST",
             headers: { "Accept": "application/json", "Accept-encoding": "application/json", "Content-Type": "application/json" },
             body: JSON.stringify({
               to: userSnap.data().pushToken,
               sound: "default",
               title: "Payment Reminder ⚠️",
               body: `You have an outstanding balance of ₹${cust.netBalance.toLocaleString()}. Please clear your dues at your earliest convenience.`
             }),
           });
           successCount++;
         }
      }
      alert(`Push notifications successfully sent to ${successCount} defaulters with the app installed!`);
    } catch(e) { console.log(e); alert("Error sending bulk notifications."); }
    setLoading(false);
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').map(row => row.split(','));
        if (rows.length < 2) throw new Error("CSV appears empty or lacks headers.");

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const idxName = headers.findIndex(h => h.includes('name'));
        const idxPhone = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
        const idxAddress = headers.findIndex(h => h.includes('address') || h.includes('house'));
        const idxArea = headers.findIndex(h => h.includes('area') || h.includes('route') || h.includes('zone') || h.includes('circle'));
        const idxPrice = headers.findIndex(h => h.includes('price') || h.includes('rate'));
        const idxBalance = headers.findIndex(h => h.includes('balance') || h.includes('opening') || h.includes('due') || h.includes('arrears'));

        if (idxName === -1 || idxPrice === -1) {
          alert("CSV Upload Failed: The first row MUST contain column headers for at least 'Name' and 'Price'.");
          setLoading(false);
          return;
        }

        let successCount = 0;
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < 2 || !row[idxName]) continue;

          const areaToSave = idxArea !== -1 && row[idxArea] ? row[idxArea].trim() : 'Unassigned';
          const newCust = {
            name: row[idxName].trim() || 'Unknown',
            phone: idxPhone !== -1 && row[idxPhone] ? row[idxPhone].trim() : '',
            address: idxAddress !== -1 && row[idxAddress] ? row[idxAddress].trim() : '',
            areaCircle: areaToSave,
            deliveryFrequency: 'Daily',
            type: 'Residential',
            pricePerLiter: parseFloat(row[idxPrice]) || 60,
            status: 'Active',
            isStaff: false,
            displayId: generateInvariantID(areaToSave, successCount)
          };

          const docRef = await addDoc(collection(db, "customers"), {
            ...newCust, registered_at: serverTimestamp()
          });

          if (idxBalance !== -1 && row[idxBalance]) {
            const balance = parseFloat(row[idxBalance]);
            if (balance > 0) {
              await addDoc(collection(db, "milk_deliveries"), {
                customer_id: docRef.id, customer_display_id: newCust.displayId,
                customer_name: newCust.name, area_circle: newCust.areaCircle, 
                is_staff: false, date: new Date().toISOString().split('T')[0], shift: 'Opening Balance', 
                liters_delivered: 0, bottles_broken: 0, price_per_liter: 0,
                total_value: balance, status: 'Billed', notes: 'Legacy / Opening Balance Due',
                recorded_at: serverTimestamp()
              });
            } else if (balance < 0) {
              await addDoc(collection(db, "customer_payments"), {
                customer_id: docRef.id, customer_name: newCust.name,
                amount: Math.abs(balance), method: 'Advance/Opening', 
                date: new Date().toISOString().split('T')[0], notes: 'Opening Balance / Advance Carryover',
                recorded_at: serverTimestamp()
              });
            }
          }
          successCount++;
        }
        alert(`Bulk Import Complete: Successfully imported ${successCount} customers!`);
        setShowImportModal(false);
        fetchData();
      } catch (err) {
        alert("Error parsing CSV.");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const areaToSave = newCustomer.areaCircle || 'Unassigned';
      const invariantID = generateInvariantID(areaToSave);
      
      await setDoc(doc(db, "customers", invariantID), {
        ...newCustomer, displayId: invariantID, areaCircle: areaToSave, isStaff: false,
        pricePerLiter: parseFloat(newCustomer.pricePerLiter) || 0, registered_at: serverTimestamp()
      });

      const bal = parseFloat(newCustomer.openingBalance) || 0;
      if (bal > 0) {
        await addDoc(collection(db, "milk_deliveries"), {
          customer_id: invariantID, customer_display_id: invariantID, customer_name: newCustomer.name,
          area_circle: areaToSave, is_staff: false, date: new Date().toISOString().split('T')[0], shift: 'Opening Balance',
          liters_delivered: 0, bottles_broken: 0, price_per_liter: 0, total_value: bal, status: 'Billed',
          notes: 'Legacy / Opening Balance Due', recorded_at: serverTimestamp()
        });
      } else if (bal < 0) {
        await addDoc(collection(db, "customer_payments"), {
          customer_id: invariantID, customer_name: newCustomer.name, amount: Math.abs(bal), method: 'Advance/Opening',
          date: new Date().toISOString().split('T')[0], notes: 'Opening Balance / Advance Carryover', recorded_at: serverTimestamp()
        });
      }

      alert(`Customer registered! ID: ${invariantID}`);
      setShowAddCustomer(false);
      setNewCustomer({ name: '', phone: '', address: '', areaCircle: '', deliveryFrequency: 'Daily', type: 'Residential', pricePerLiter: '', status: 'Active', openingBalance: '' });
      fetchData();
    } catch (error) { alert("Error registering customer."); } finally { setLoading(false); }
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (editingCustomer.isStaff) {
        await updateDoc(doc(db, "employees", editingCustomer.id), {
          areaCircle: editingCustomer.areaCircle || 'Farm / Staff', 
          deliveryFrequency: editingCustomer.deliveryFrequency || 'Daily',
          address: editingCustomer.address || 'Farm Staff'
        });
      } else {
        await updateDoc(doc(db, "customers", editingCustomer.id), {
          name: editingCustomer.name || 'Unknown', 
          phone: editingCustomer.phone || '', 
          address: editingCustomer.address || '', 
          areaCircle: editingCustomer.areaCircle || 'Unassigned', 
          deliveryFrequency: editingCustomer.deliveryFrequency || 'Daily',
          type: editingCustomer.type || 'Residential', 
          pricePerLiter: parseFloat(editingCustomer.pricePerLiter) || 0,
          status: editingCustomer.status || 'Active'
        });
      }
      alert("Profile updated successfully."); 
      setEditingCustomer(null); 
      fetchData();
    } catch(e) { 
      console.error("Firebase Update Error:", e);
      alert(`Error updating profile: ${e.message}`); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDeleteCustomer = async (id) => {
    if(window.confirm("WARNING: Delete this customer?")) {
      try { await deleteDoc(doc(db, "customers", id)); fetchData(); } catch(e) { alert("Error deleting."); }
    }
  };

  const handleLogPayment = async (e) => {
    e.preventDefault();
    if (!paymentModal.amount || parseFloat(paymentModal.amount) <= 0) return alert("Enter a valid payment amount.");
    
    setLoading(true);
    try {
      await addDoc(collection(db, "customer_payments"), {
        customer_id: paymentModal.customer.id, customer_name: paymentModal.customer.name,
        amount: parseFloat(paymentModal.amount), method: paymentModal.method, 
        date: paymentModal.date, notes: paymentModal.notes || `Payment received via ${paymentModal.method}`,
        recorded_at: serverTimestamp()
      });
      alert(`Payment of ₹${paymentModal.amount} logged and verified for ${paymentModal.customer.name}.`);
      setPaymentModal({ show: false, customer: null, amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (e) { alert("Error saving payment."); } finally { setLoading(false); }
  };

  const handleAddWaitlist = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await addDoc(collection(db, "waitlist"), { ...newWaitlist, status: 'Pending', recorded_at: serverTimestamp() });
      alert("Potential customer added to Waitlist!");
      setNewWaitlist({ name: '', phone: '', address: '', notes: '' }); fetchData();
    } catch (error) { alert("Error adding to waitlist."); } finally { setLoading(false); }
  };

  const handlePromoteWaitlist = async (lead) => {
    if(window.confirm(`Promote ${lead.name} to active customer?`)) {
      setNewCustomer({ name: lead.name, phone: lead.phone, address: lead.address, areaCircle: '', deliveryFrequency: 'Daily', type: 'Residential', pricePerLiter: '', status: 'Active', openingBalance: '' });
      await deleteDoc(doc(db, "waitlist", lead.id));
      setActiveTab('customers'); setShowAddCustomer(true); fetchData();
    }
  };

  const handleLogBottleAction = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await addDoc(collection(db, "bottle_inventory"), {
        type: bottleForm.type, qty: parseInt(bottleForm.qty), cost: parseFloat(bottleForm.cost) || 0,
        notes: bottleForm.notes, recorded_at: serverTimestamp()
      });
      alert(`Bottle ${bottleForm.type} logged!`);
      setBottleForm({ type: 'Purchase', qty: '', cost: '', notes: '' }); fetchData();
    } catch (error) { alert("Error logging bottles."); } finally { setLoading(false); }
  };

  const handleLogManualSpoilage = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await addDoc(collection(db, "spoilage_logs"), {
        date: manualSpoilage.date, item: manualSpoilage.item, qty: parseFloat(manualSpoilage.qty) || 0,
        financialLoss: parseFloat(manualSpoilage.financialLoss) || 0, mistakeType: manualSpoilage.mistakeType,
        explanation: manualSpoilage.explanation, recorded_at: serverTimestamp()
      });
      alert("Spoilage/Loss event officially logged.");
      setManualSpoilage({ date: new Date().toISOString().split('T')[0], item: 'Raw Milk', qty: '', mistakeType: 'Storage / Souring', financialLoss: '', explanation: '' });
      fetchData();
    } catch (error) { alert("Error logging spoilage."); } finally { setLoading(false); }
  };

  const bottleStats = {
    purchased: bottleLogs.filter(b => b.type === 'Purchase').reduce((sum, b) => sum + b.qty, 0),
    farmBroken: bottleLogs.filter(b => b.type === 'Staff_Breakage').reduce((sum, b) => sum + b.qty, 0),
    customerBroken: deliveries.reduce((sum, d) => sum + (d.bottles_broken || 0), 0)
  };
  const activeBottles = bottleStats.purchased - bottleStats.farmBroken - bottleStats.customerBroken;

  const handleSaveAreaSchedule = async (areaName, type) => {
    setAreaSettings(prev => ({ ...prev, [areaName]: type }));
    try {
      const q = query(collection(db, "area_settings"), where("areaName", "==", areaName));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, "area_settings", snap.docs[0].id), { scheduleType: type });
      } else {
        await addDoc(collection(db, "area_settings"), { areaName: areaName, scheduleType: type });
      }
    } catch (error) { alert("Error updating area schedule."); fetchData(); }
  };

  const handleRouteLogChange = (customerId, field, value) => {
    setRouteLogs(prev => ({
      ...prev,
      [customerId]: { ...(prev[customerId] || { qty: '', broken: '', wasFilled: false, spoiled: '' }), [field]: field === 'wasFilled' ? value : value }
    }));
  };

  const handleSaveDailyRoute = async () => {
    const entriesToSave = Object.entries(routeLogs).filter(([_, data]) => parseFloat(data.qty) > 0 || parseFloat(data.broken) > 0 || parseFloat(data.spoiled) > 0);
    const hasSpotSale = parseFloat(spotSale.qty) > 0 || parseFloat(spotSale.broken) > 0 || parseFloat(spotSale.spoiled) > 0;
    const hasInternalUse = parseFloat(internalUse.qty) > 0;
    
    if (entriesToSave.length === 0 && !hasSpotSale && !hasInternalUse) return alert("No deliveries, returns, R&D, or spot sales entered.");
    if (hasInternalUse && internalUse.purpose === 'Calf Feeding' && !internalUse.notes) return alert("Please select a specific Tag from the dropdown for Calf Feeding so it applies to the Animal's P&L.");
    if (!window.confirm(`Lock route sheet for ${routeDate} (${shift})?`)) return;

    setLoading(true);
    try {
      for (const [customerId, data] of entriesToSave) {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) continue;

        const liters = parseFloat(data.qty) || 0; 
        const broken = parseInt(data.broken) || 0;
        const spoiledLiters = parseFloat(data.spoiled) || 0;
        const wasFilled = data.wasFilled || false;
        
        const milkValue = liters * customer.pricePerLiter;
        const breakageValue = broken * 50; 
        const totalValue = milkValue + breakageValue;

        if (liters > 0 || broken > 0) {
          await addDoc(collection(db, "milk_deliveries"), {
            customer_id: customer.id, customer_display_id: customer.displayId || '--',
            customer_name: customer.name, area_circle: customer.areaCircle || 'Unassigned', 
            is_staff: customer.isStaff || false, date: routeDate, shift: shift, 
            liters_delivered: liters, bottles_broken: broken,
            price_per_liter: customer.pricePerLiter, total_value: totalValue, 
            status: customer.isStaff ? 'Staff_Incentive' : 'Billed', recorded_at: serverTimestamp()
          });

          if (customer.isStaff && liters > 0) {
            await addDoc(collection(db, "employee_transactions"), {
              emp_id: customer.id, emp_name: customer.name, type: 'Milk_Incentive',
              amount: milkValue, liters: liters, date: routeDate,
              notes: `Auto-logged from Route Delivery (${shift})`, recorded_at: serverTimestamp()
            });
          }

          try {
            const userSnap = await getDoc(doc(db, customer.isStaff ? "employees" : "customers", customer.id));
            let pushToken = null;
            if (userSnap.exists()) pushToken = userSnap.data().pushToken;

            if (pushToken) {
              let title = customer.isStaff ? "🥛 Daily Milk Drop!" : "New Milk Delivery! 🥛";
              let body = customer.isStaff ? `You received ${liters}L of milk (Value: ₹${milkValue}).` : `You just received ${liters}L of fresh milk.`;

              await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Accept": "application/json", "Accept-encoding": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ to: pushToken, sound: "default", title, body }),
              });
            }
          } catch (err) { console.log("Push Error:", err); }
        } 

        if (broken > 0 && wasFilled) {
          await addDoc(collection(db, "spoilage_logs"), {
            date: routeDate, item: 'Milk (Filled Bottle Broken)', qty: broken,
            financialLoss: broken * customer.pricePerLiter, mistakeType: 'Transit / Delivery Breakage',
            explanation: `Dropped/Broken at ${customer.name}'s location`, recorded_at: serverTimestamp()
          });
        }

        if (spoiledLiters > 0) {
          await addDoc(collection(db, "spoilage_logs"), {
            date: routeDate, item: 'Milk (Customer Return / Sour)', qty: spoiledLiters,
            financialLoss: spoiledLiters * customer.pricePerLiter, mistakeType: 'Quality / Souring',
            explanation: `Rejected/Returned by ${customer.name} on route.`, recorded_at: serverTimestamp()
          });
        }
      } 

      if (hasSpotSale) {
        const sLiters = parseFloat(spotSale.qty) || 0;
        const sAmount = parseFloat(spotSale.amount) || 0;
        const sBroken = parseInt(spotSale.broken) || 0;
        const sSpoiled = parseFloat(spotSale.spoiled) || 0;
        const sFilled = spotSale.wasFilled || false;

        if (sLiters > 0 || sBroken > 0) {
          await addDoc(collection(db, "milk_deliveries"), {
            customer_id: 'SPOT_SALE', customer_display_id: 'N/A', customer_name: 'Cash / Spot Sale', 
            area_circle: routeFilterArea || 'Mixed Route', is_staff: false, date: routeDate, shift: shift, 
            liters_delivered: sLiters, bottles_broken: sBroken, price_per_liter: sLiters > 0 ? (sAmount / sLiters).toFixed(2) : 0,
            total_value: sAmount + (sBroken * 50), status: 'Paid', recorded_at: serverTimestamp()
          });
        }

        if (sBroken > 0 && sFilled) {
          await addDoc(collection(db, "spoilage_logs"), {
            date: routeDate, item: 'Milk (Spot Sale Breakage)', qty: sBroken, financialLoss: sBroken * 60, 
            mistakeType: 'Transit Breakage', explanation: `Broken during random spot sale`, recorded_at: serverTimestamp()
          });
        }

        if (sSpoiled > 0) {
          await addDoc(collection(db, "spoilage_logs"), {
            date: routeDate, item: 'Milk (Spot Sale Returned)', qty: sSpoiled, financialLoss: sSpoiled * 60, 
            mistakeType: 'Quality / Souring', explanation: `Returned during random spot sale`, recorded_at: serverTimestamp()
          });
        }
      }

      if (hasInternalUse) {
        const iQty = parseFloat(internalUse.qty) || 0;
        await addDoc(collection(db, "internal_milk_logs"), {
          date: routeDate, shift: shift, qty: iQty, purpose: internalUse.purpose, notes: internalUse.notes, recorded_at: serverTimestamp()
        });
      }

      alert("Route Sheet, Internal Usage, & Penalties Saved Successfully!");
      setRouteLogs({}); 
      setSpotSale({ qty: '', amount: '', broken: '', wasFilled: false, spoiled: '' }); 
      setInternalUse({ qty: '', purpose: 'Transfer to Processing', notes: '' });
      setDispatchVolume(''); 
      fetchData();
    } catch (error) { 
      alert("Error saving route sheet."); 
      console.error(error); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleUpdateHistoricalDelivery = async (delId, currentDel) => {
    const newLiters = prompt("Update 1L Bottles Delivered to:", currentDel.liters_delivered);
    if (newLiters === null || newLiters === "") return;

    setLoading(true);
    try {
      const liters = parseFloat(newLiters) || 0;
      const finalValue = liters * parseFloat(currentDel.price_per_liter) + ((currentDel.bottles_broken || 0) * 50);
      await updateDoc(doc(db, "milk_deliveries", delId), { liters_delivered: liters, total_value: finalValue });
      alert("Delivery record updated! Ledger has auto-corrected."); fetchData();
    } catch(e) { alert("Error updating record."); } finally { setLoading(false); }
  };

  const handleDeleteDeliveryRecord = async (id) => {
    if(window.confirm("Delete this delivery record permanently? Ledger will automatically adjust.")) {
      try { await deleteDoc(doc(db, "milk_deliveries", id)); fetchData(); } catch(e) { alert("Error deleting."); }
    }
  };

  const handleDeletePaymentRecord = async (id) => {
    if(window.confirm("Delete this Payment record permanently? Customer Balance will auto-adjust.")) {
      try { await deleteDoc(doc(db, "customer_payments", id)); fetchData(); } catch(e) { alert("Error deleting."); }
    }
  };

  // EXCEL EXPORT GENERATOR 
  const handleExportDeliveryGrid = () => {
    if (!historyMonth) return alert("Please select a Month Filter above to generate the Excel sheet.");
    
    const monthDeliveries = deliveries.filter(d => (d.date || '').startsWith(historyMonth));
    const uniqueDates = [...new Set(monthDeliveries.map(d => d.date))].sort();
    
    if (uniqueDates.length === 0) return alert("No deliveries found for this month.");

    const exportData = customers.map(cust => {
      const row = { 'Customer ID': cust.displayId, 'Name': cust.name, 'Area Route': cust.areaCircle };
      let totalMonthVolume = 0;

      uniqueDates.forEach(date => {
        const delOnDate = monthDeliveries.filter(d => d.customer_id === cust.id && d.date === date);
        const dailyVol = delOnDate.reduce((sum, d) => sum + parseFloat(d.liters_delivered || 0), 0);
        row[date] = dailyVol > 0 ? dailyVol : ''; 
        totalMonthVolume += dailyVol;
      });

      row['Total Month Volume (L)'] = totalMonthVolume;
      return row;
    }).filter(row => row['Total Month Volume (L)'] > 0); 

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Delivery Audit");
    XLSX.writeFile(wb, `Delivery_Audit_Grid_${historyMonth}.xlsx`);
  };

  const areaAnalytics = uniqueAreaCircles.filter(a => a !== 'Unassigned').map(area => {
    const areaDeliveries = deliveries.filter(d => d.area_circle === area);
    const totalVolume = areaDeliveries.reduce((sum, d) => sum + (parseFloat(d.liters_delivered)||0), 0);
    const totalRevenue = areaDeliveries.reduce((sum, d) => sum + (parseFloat(d.total_value)||0), 0);
    const activeCustomers = customers.filter(c => c.areaCircle === area && c.status === 'Active').length;
    return { area, totalVolume, totalRevenue, activeCustomers };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  // LOGIC: Daily Master Ledger vs Single Customer PDF mode
  const activeCustomerRecord = customers.find(c => c.id === selectedHistoryCustomer);
  const activeLedgerData = activeCustomerRecord ? getCustomerLedgerData(selectedHistoryCustomer) : null;
  
  let rawLedgerData = [];
  if (selectedHistoryCustomer) {
    rawLedgerData = [
      ...deliveries.filter(d => d.customer_id === selectedHistoryCustomer).map(d => ({ ...d, isPayment: false })),
      ...payments.filter(p => p.customer_id === selectedHistoryCustomer).map(p => ({ ...p, isPayment: true }))
    ];
    if (historyMonth) rawLedgerData = rawLedgerData.filter(item => (item.date||'').startsWith(historyMonth));
  } else {
    rawLedgerData = [
      ...deliveries.filter(d => d.date === historyDate).map(d => ({ ...d, isPayment: false })),
      ...payments.filter(p => p.date === historyDate).map(p => ({ ...p, isPayment: true }))
    ];
    if (historyRoute) {
      rawLedgerData = rawLedgerData.filter(item => {
        if (!item.isPayment) return item.area_circle === historyRoute || item.areaCircle === historyRoute;
        const cust = customers.find(c => c.id === item.customer_id);
        return cust && (cust.areaCircle === historyRoute || cust.route === historyRoute);
      });
    }
  }

  const sortedLedgerData = rawLedgerData.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Calculating Daily Totals for Footer
  const dailyTotalLiters = sortedLedgerData.filter(d => !d.isPayment).reduce((sum, d) => sum + (parseFloat(d.liters_delivered) || 0), 0);
  const dailyTotalValue = sortedLedgerData.filter(d => !d.isPayment).reduce((sum, d) => sum + (parseFloat(d.total_value) || 0), 0);
  const dailyTotalPayments = sortedLedgerData.filter(d => d.isPayment).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);


  const validCalves = livestock.filter(a => {
    if (a.status === 'Sold' || a.status === 'Dead') return false;
    const statusStr = String(a.status || '').toLowerCase();
    const stageStr = String(a.stage || '').toLowerCase();
    return statusStr.includes('calf') || stageStr.includes('calf') || statusStr.includes('heifer') || stageStr.includes('heifer');
  });

  const triggerPrintEngine = (docPayload, type) => {
    if (documentTemplates.length === 0) return alert("You must create at least one Document Template in the 'Documents & Invoice Hub' first.");
    let bestMatch = documentTemplates.find(t => t.type.toLowerCase().includes(type.toLowerCase()));
    if (!bestMatch) bestMatch = documentTemplates[0]; 
    setSelectedTemplate(bestMatch);
    setPrintingDoc({ docType: type, raw: docPayload });
  };

  const handlePrintStatementFromBilling = (customerRecord, ledgerData, targetMonth) => {
    const currentMonthDeliveries = ledgerData.custDeliveries.filter(d => (d.date||'').startsWith(targetMonth));
    const currentMonthPayments = ledgerData.custPayments.filter(p => (p.date||'').startsWith(targetMonth));

    const totalLiters = currentMonthDeliveries.reduce((sum, d) => sum + (parseFloat(d.liters_delivered)||0), 0);
    const brokenCount = currentMonthDeliveries.reduce((sum, d) => sum + (parseInt(d.bottles_broken) || 0), 0);
    const brokenPenalty = brokenCount * 50;
    const totalPaidThisMonth = currentMonthPayments.reduce((sum, p) => sum + (parseFloat(p.amount)||0), 0);

    const lineItems = [
      ...currentMonthDeliveries.map(d => ({ date: d.date, isPayment: false, qty: d.liters_delivered, broken: d.bottles_broken, amount: d.total_value })),
      ...currentMonthPayments.map(p => ({ date: p.date, isPayment: true, method: p.method, amount: p.amount }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    const payload = {
      customer_id: customerRecord.id,
      customerName: customerRecord.name,
      month: targetMonth,
      totalLiters,
      brokenPenalty,
      totalPaid: totalPaidThisMonth,
      rate: customerRecord.pricePerLiter,
      netBalance: ledgerData.netBalance,
      lineItems
    };

    triggerPrintEngine(payload, 'Customer Statement');
  };

  const handlePrintStatement = () => {
    if (!historyMonth) return alert("Please select a specific 'Month Filter' above to generate a statement.");
    if (!activeCustomerRecord) return alert("Please select a customer first.");
    handlePrintStatementFromBilling(activeCustomerRecord, activeLedgerData, historyMonth);
  };

  const handleSendIndividualReminder = (customer) => {
    if (!customer.phone) return alert(`No phone number saved for ${customer.name}.`);
    
    const hasOfficialInvoice = invoices.some(i => i.customerName === customer.name && (i.notes || '').includes(billingMonth));
    if (!hasOfficialInvoice) {
      const proceed = window.confirm(`WARNING: An official invoice for ${customer.name} (${billingMonth}) has NOT been saved to the Master Ledger yet.\n\nWould you like to automatically generate their PDF statement now so you can officially save and share it?`);
      if (!proceed) return;
    }

    const phone = customer.phone.replace(/\D/g, ''); 
    const ledgerData = getCustomerLedgerData(customer.id);
    const currentMonthDeliveries = ledgerData.custDeliveries.filter(d => (d.date||'').startsWith(billingMonth));
    const totalLiters = currentMonthDeliveries.reduce((sum, d) => sum + (parseFloat(d.liters_delivered)||0), 0);
    const currentBilled = currentMonthDeliveries.reduce((sum, d) => sum + (parseFloat(d.total_value)||0), 0);
    const arrears = customer.netBalance - currentBilled;

    const message = `*INVOICE: ${billingMonth}*\n\nHello ${customer.name},\nHere is your dairy farm statement for this month:\n\n` +
                    `*Total Milk Delivered:* ${totalLiters} Liters\n` +
                    `*Current Month Bill:* Rs. ${currentBilled.toLocaleString()}\n` +
                    `${arrears > 0 ? `*Previous Arrears:* Rs. ${arrears.toLocaleString()}\n` : ''}` +
                    `------------------------\n` +
                    `*TOTAL AMOUNT DUE:* Rs. ${customer.netBalance.toLocaleString()}\n` +
                    `------------------------\n\n` +
                    `Kindly clear your dues at your earliest convenience. Thank you!`;
                    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    handlePrintStatementFromBilling(customer, ledgerData, billingMonth);
  };

  const handleSaveAsOfficialInvoice = async () => {
    if(!printingDoc) return;
    setLoading(true);
    try {
      const pDoc = printingDoc.raw;
      const invNumber = `INV-${Date.now().toString().slice(-6)}`;
      await addDoc(collection(db, "invoices"), {
        invoiceNumber: invNumber,
        type: 'Monthly Milk Statement',
        customerName: pDoc.customerName || printingDoc.entity || 'Unknown',
        amount: pDoc.netBalance || printingDoc.amount || 0,
        date: new Date().toISOString().split('T')[0],
        notes: `Billing Period: ${pDoc.month || new Date().toISOString().slice(0,7)}`,
        recorded_at: serverTimestamp()
      });

      await addDoc(collection(db, "invoices"), {
        invoiceNumber: invNumber,
        type: 'Monthly Milk Statement',
        customerName: pDoc.customerName || printingDoc.entity || 'Unknown',
        amount: pDoc.netBalance || printingDoc.amount || 0,
        date: new Date().toISOString().split('T')[0],
        notes: `Billing Period: ${pDoc.month || new Date().toISOString().slice(0,7)}`,
        recorded_at: serverTimestamp()
      });

      if (pDoc.customer_id) {
         const userSnap = await getDoc(doc(db, "customers", pDoc.customer_id));
         if (userSnap.exists() && userSnap.data().pushToken) {
            await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Accept": "application/json", "Accept-encoding": "application/json", "Content-Type": "application/json" },
              body: JSON.stringify({
                to: userSnap.data().pushToken,
                sound: "default",
                title: "New Invoice Generated 💳",
                body: `Your official bill for ₹${pDoc.netBalance || 0} has been created for ${pDoc.month}.`
              }),
            });
         }
      }

      alert(`Invoice ${invNumber} saved to Master Invoices Ledger successfully!`);
      fetchData(); 
    } catch(e) {
      alert("Error saving official invoice.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustmentModal.amount || parseFloat(adjustmentModal.amount) <= 0) {
      return alert("Enter a valid adjustment amount.");
    }

    setLoading(true);
    try {
      const amount = parseFloat(adjustmentModal.amount);
      const isCharge = adjustmentModal.type === 'Charge';

      if (isCharge) {
        await addDoc(collection(db, "milk_deliveries"), {
          customer_id: adjustmentModal.customer.id,
          customer_display_id: adjustmentModal.customer.displayId || '--',
          customer_name: adjustmentModal.customer.name,
          area_circle: adjustmentModal.customer.areaCircle || 'Unassigned',
          is_staff: adjustmentModal.customer.isStaff || false,
          date: adjustmentModal.date,
          shift: 'Ledger Adjustment',
          liters_delivered: 0,
          bottles_broken: 0,
          price_per_liter: 0,
          total_value: amount,
          status: 'Billed',
          notes: adjustmentModal.notes || 'Manual Ledger Charge',
          recorded_at: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "customer_payments"), {
          customer_id: adjustmentModal.customer.id,
          customer_name: adjustmentModal.customer.name,
          amount: amount,
          method: 'Ledger Credit',
          date: adjustmentModal.date,
          notes: adjustmentModal.notes || 'Manual Ledger Credit',
          recorded_at: serverTimestamp()
        });
      }

      alert(`Ledger adjusted successfully for ${adjustmentModal.customer.name}.`);
      setAdjustmentModal({ show: false, customer: null, amount: '', type: 'Charge', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (e) {
      alert("Error saving adjustment.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (printingDoc && selectedTemplate) {
    const isPayment = printingDoc.docType === 'Payment Voucher';
    const isStatement = printingDoc.docType === 'Customer Statement'; 
    const pDoc = printingDoc.raw;

    return (
      <div className="bg-slate-100 min-h-screen p-10 print:p-0 absolute inset-0 z-[100]">
        <div className="print:hidden max-w-4xl mx-auto mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow border border-slate-200">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-500 text-sm">Select Template:</span>
            <select 
              value={selectedTemplate.id} 
              onChange={(e) => setSelectedTemplate(documentTemplates.find(t => t.id === e.target.value))}
              className="p-2 border border-slate-300 rounded font-bold text-slate-800 outline-none w-64"
            >
              {documentTemplates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            {isStatement && (
              <button onClick={handleSaveAsOfficialInvoice} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow flex items-center gap-2 transition disabled:bg-slate-400">
                <Save size={18}/> Save to Official Invoices
              </button>
            )}
            <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded shadow flex items-center gap-2 transition"><Printer size={18}/> Print / Save PDF</button>
            <button onClick={() => { setPrintingDoc(null); setSelectedTemplate(null); }} className="bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold py-2 px-6 rounded shadow transition">Close</button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto bg-white p-12 shadow-2xl print:shadow-none print:p-0 relative overflow-hidden min-h-[1122px] flex flex-col">
          <div className="absolute top-0 left-0 w-full h-3 print:hidden" style={{ backgroundColor: selectedTemplate.accentColor }}></div>
          
          <div className="flex justify-between items-start border-b-2 pb-6 pt-2" style={{ borderColor: selectedTemplate.accentColor }}>
            <div className="flex gap-6 items-center">
              {selectedTemplate.logoData ? (
                <img src={selectedTemplate.logoData} alt="Logo" className="w-24 h-24 object-contain rounded" />
              ) : (
                <div className="w-24 h-24 bg-slate-100 border-2 border-dashed border-slate-300 text-slate-400 font-bold flex items-center justify-center text-xs text-center p-2 rounded">LOGO</div>
              )}
              <div>
                <h1 className="text-3xl font-black tracking-tight" style={{ color: selectedTemplate.accentColor }}>{selectedTemplate.headerText}</h1>
                <p className="text-slate-600 font-medium whitespace-pre-wrap leading-tight mt-1">{selectedTemplate.subHeader}</p>
                <p className="text-slate-500 text-sm whitespace-pre-wrap mt-1">{selectedTemplate.contactInfo}</p>
                {selectedTemplate.fssai && <p className="text-slate-500 text-xs font-bold mt-1">FSSAI: {selectedTemplate.fssai}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-black uppercase tracking-widest opacity-80" style={{ color: selectedTemplate.accentColor }}>
                {isStatement ? 'Monthly Statement' : printingDoc.docType}
              </h2>
              <p className="font-bold text-slate-800 mt-2">Ref #: {printingDoc.ref || `DOC-${Date.now().toString().slice(-6)}`}</p>
              <p className="text-slate-600 font-medium">Date: {printingDoc.date || new Date().toISOString().split('T')[0]}</p>
            </div>
          </div>

          <div className="mt-6 mb-6">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">{isPayment ? 'Paid To:' : 'Billed To:'}</p>
            <p className="text-xl font-black text-slate-800">{printingDoc.entity || pDoc.customerName}</p>
            {isStatement && pDoc.month && <p className="text-sm font-bold text-slate-500 mt-1">Billing Period: {pDoc.month}</p>}
          </div>

          {isStatement ? (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-8 grid grid-cols-5 gap-4 text-center divide-x divide-slate-200">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Qty</p>
                  <p className="text-lg font-black text-blue-700 mt-1">{pDoc.totalLiters} L</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Breakage</p>
                  <p className="text-lg font-black text-red-600 mt-1">₹{pDoc.brokenPenalty || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Advances / Paid</p>
                  <p className="text-lg font-black text-emerald-600 mt-1">₹{pDoc.totalPaid || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rate / L</p>
                  <p className="text-lg font-black text-slate-700 mt-1">₹{pDoc.rate}</p>
                </div>
                <div className="bg-slate-100 -m-4 p-4 rounded-r-lg border-l-2 border-slate-300">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Final Balance</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">₹{pDoc.netBalance}</p>
                </div>
              </div>

              <table className="w-full text-left border-collapse mb-8 text-sm">
                <thead>
                  <tr className="bg-slate-100 uppercase text-[10px] tracking-wider border-y-2 border-slate-800 text-slate-600">
                    <th className="py-2 px-3 font-bold">Date</th>
                    <th className="py-2 px-3 font-bold">Particulars</th>
                    <th className="py-2 px-3 font-bold text-center">Qty (L)</th>
                    <th className="py-2 px-3 font-bold text-center text-red-600">Breakage</th>
                    <th className="py-2 px-3 font-bold text-right">Daily Amt (₹)</th>
                  </tr>
                </thead>
                <tbody className="border-b-2 border-slate-800 divide-y divide-slate-100">
                  {pDoc.lineItems && pDoc.lineItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-bold text-slate-700">{item.date}</td>
                      <td className="py-2 px-3 text-slate-600">{item.isPayment ? `Payment Recvd (${item.method})` : 'Milk Delivery'}</td>
                      <td className="py-2 px-3 text-center font-bold text-blue-600">{item.isPayment ? '--' : item.qty}</td>
                      <td className="py-2 px-3 text-center text-red-500 text-xs">{item.broken > 0 ? `${item.broken} Bot` : '--'}</td>
                      <td className={`py-2 px-3 text-right font-bold ${item.isPayment ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {item.isPayment ? `-₹${item.amount}` : `+₹${item.amount}`}
                      </td>
                    </tr>
                  ))}
                  {(!pDoc.lineItems || pDoc.lineItems.length === 0) && <tr><td colSpan="5" className="py-4 text-center text-slate-400">No delivery data found for this period.</td></tr>}
                </tbody>
              </table>
            </>
          ) : (
            <table className="w-full text-left border-collapse mb-10">
              <thead>
                <tr className="bg-slate-50 uppercase text-xs tracking-wider border-y-2 border-slate-800">
                  <th className="py-4 px-4 font-bold">Particulars / Description</th>
                  {!selectedTemplate.hideFinancials && (
                    <>
                      <th className="py-4 px-4 font-bold text-center">Qty / Ref</th>
                      <th className="py-4 px-4 font-bold text-right">Amount</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="border-b-2 border-slate-800">
                <tr>
                  <td className="py-6 px-4">
                    <span className="font-black text-slate-800 text-lg">
                      {isPayment ? `Payment / Settlement via ${pDoc.method}` : 
                       pDoc.product_name ? pDoc.product_name : 
                       (pDoc.type || 'Farm Goods & Services')}
                    </span>
                    <div className="text-sm text-slate-600 font-medium mt-1">{pDoc.notes || 'N/A'}</div>
                  </td>
                  
                  {!selectedTemplate.hideFinancials && (
                    <>
                      <td className="py-6 px-4 text-center font-bold text-slate-600">
                        {pDoc.qty ? `${pDoc.qty} ${pDoc.unit || ''}` : (pDoc.method || '--')}
                      </td>
                      <td className="py-6 px-4 text-right font-black text-slate-900 text-lg">
                        ₹{(Number(printingDoc.amount)||Number(pDoc.amount)||0).toLocaleString()}
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          )}

          {!isStatement && !selectedTemplate.hideFinancials && (
            <div className="flex justify-end mb-16">
              <div className="w-1/2 space-y-3 border-t-2 border-slate-200 pt-4">
                <div className="flex justify-between text-slate-900 font-black text-2xl pt-2">
                  <p>{isPayment ? 'Total Paid:' : 'Total Value:'}</p><p>₹{(Number(printingDoc.amount)||Number(pDoc.amount)||0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-auto border-t-2 border-slate-800 pt-6 flex justify-between items-start text-sm">
            <div className="w-2/3 pr-8 space-y-4">
              {(selectedTemplate.bankAccount || selectedTemplate.upi) && (
                <div className="bg-slate-50 p-4 rounded border border-slate-200 text-xs">
                  <p className="font-black text-slate-800 mb-2 uppercase tracking-widest border-b border-slate-200 pb-1">Bank & Payment Details</p>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 font-medium">
                    {selectedTemplate.bankName && <p>Bank: <span className="font-bold text-slate-800">{selectedTemplate.bankName}</span></p>}
                    {selectedTemplate.bankAccount && <p>A/C No: <span className="font-bold text-slate-800">{selectedTemplate.bankAccount}</span></p>}
                    {selectedTemplate.ifsc && <p>IFSC: <span className="font-bold text-slate-800">{selectedTemplate.ifsc}</span></p>}
                    {selectedTemplate.upi && <p>UPI ID: <span className="font-bold text-slate-800">{selectedTemplate.upi}</span></p>}
                  </div>
                </div>
              )}
              <div>
                <p className="font-bold text-slate-700 mb-1 uppercase text-[10px] tracking-wider">Terms & Conditions:</p>
                <p className="whitespace-pre-wrap leading-relaxed text-slate-500 text-xs">{selectedTemplate.terms}</p>
              </div>
            </div>

            <div className="text-center w-1/3 pt-12">
              <div className="w-full border-b-2 border-slate-800 mb-2"></div>
              <p className="font-bold text-slate-800 uppercase tracking-wider text-xs">{selectedTemplate.footerText}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      <datalist id="area-options">{uniqueAreaCircles.map(area => <option key={area} value={area} />)}</datalist>

      {/* BULK IMPORT INSTRUCTIONAL MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><UploadCloud size={18}/> Bulk Import Customers</h3>
              <button onClick={() => setShowImportModal(false)} className="hover:text-slate-300"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800">
                <p className="font-bold mb-2">Required CSV Format (Top row must have these headers):</p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li><strong>Name</strong> (Mandatory)</li>
                  <li><strong>Price</strong> (Mandatory - ₹ per Liter)</li>
                  <li><strong>Phone</strong> (Optional)</li>
                  <li><strong>Address</strong> (Optional)</li>
                  <li><strong>Area</strong> (Optional)</li>
                  <li><strong>Opening Balance</strong> (Optional) - <span className="font-bold text-red-600">Positive value</span> = they owe you money. <span className="font-bold text-emerald-600">Negative value</span> = you owe them (Advance).</li>
                </ul>
              </div>
              <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg text-center bg-slate-50 hover:bg-slate-100 transition cursor-pointer">
                <label className="cursor-pointer flex flex-col items-center gap-2 w-full h-full">
                  <FileSpreadsheet size={32} className="text-slate-400" />
                  <span className="font-bold text-blue-600">Click here to select your CSV file</span>
                  <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL OVERLAY */}
      {paymentModal.show && paymentModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Banknote size={18}/> Log Admin Payment Verification</h3>
              <button onClick={() => setPaymentModal({show: false, customer: null, amount: '', method: 'Cash', date: '', notes: ''})} className="hover:text-emerald-200"><X size={20}/></button>
            </div>
            <form onSubmit={handleLogPayment} className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Customer</p>
                <p className="text-lg font-black text-slate-800">{paymentModal.customer.name}</p>
                <p className="text-sm font-bold text-amber-600 mt-1">Current Ledger Balance: ₹{paymentModal.customer.netBalance > 0 ? paymentModal.customer.netBalance.toLocaleString() + ' Due' : Math.abs(paymentModal.customer.netBalance).toLocaleString() + ' Advance'}</p>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-emerald-700 mb-1">AMOUNT RECEIVED (₹)</label>
                <input type="number" step="any" required value={paymentModal.amount} onChange={(e) => setPaymentModal({...paymentModal, amount: e.target.value})} className="w-full text-2xl font-black p-3 border border-emerald-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50 text-emerald-900" placeholder="0.00" />
                <p className="text-[10px] text-slate-400 mt-1">To log a partial payment, simply delete the auto-filled amount and type the exact cash paid.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">PAYMENT METHOD</label>
                  <select value={paymentModal.method} onChange={(e) => setPaymentModal({...paymentModal, method: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none bg-white font-bold text-slate-700">
                    <option value="Cash (Driver Collected)">Cash (Driver Collected)</option>
                    <option value="App / Online Verified">App / Online Verified</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">DATE RECEIVED</label>
                  <input type="date" required value={paymentModal.date} onChange={(e) => setPaymentModal({...paymentModal, date: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold text-slate-700" />
                </div>
              </div>
              <button disabled={loading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow-lg transition mt-2">
                {loading ? 'Processing...' : 'Verify & Log Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {adjustmentModal.show && adjustmentModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><ArrowRightLeft size={18}/> Adjust Ledger Balance</h3>
              <button onClick={() => setAdjustmentModal({show: false, customer: null, amount: '', type: 'Charge', date: new Date().toISOString().split('T')[0], notes: ''})} className="hover:text-slate-300"><X size={20}/></button>
            </div>
            <form onSubmit={handleLogAdjustment} className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Customer</p>
                <p className="text-lg font-black text-slate-800">{adjustmentModal.customer.name}</p>
                <p className="text-sm font-bold text-amber-600 mt-1">Current Ledger Balance: ₹{adjustmentModal.customer.netBalance > 0 ? adjustmentModal.customer.netBalance.toLocaleString() + ' Due' : Math.abs(adjustmentModal.customer.netBalance).toLocaleString() + ' Advance'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ADJUSTMENT TYPE</label>
                  <select value={adjustmentModal.type} onChange={(e) => setAdjustmentModal({...adjustmentModal, type: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold text-slate-700">
                    <option value="Charge">Charge (Increase Balance Due)</option>
                    <option value="Credit">Credit (Decrease Balance Due)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">AMOUNT (₹)</label>
                  <input type="number" step="any" required value={adjustmentModal.amount} onChange={(e) => setAdjustmentModal({...adjustmentModal, amount: e.target.value})} className="w-full p-2 text-lg font-black border border-slate-300 rounded outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">DATE OF ADJUSTMENT</label>
                <input type="date" required value={adjustmentModal.date} onChange={(e) => setAdjustmentModal({...adjustmentModal, date: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold text-slate-700" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">REASON / NOTES</label>
                <input type="text" required value={adjustmentModal.notes} onChange={(e) => setAdjustmentModal({...adjustmentModal, notes: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none text-sm" placeholder="e.g. Correcting opening balance error" />
              </div>
              <button disabled={loading} type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg shadow-lg transition mt-2">
                {loading ? 'Processing...' : 'Apply Ledger Adjustment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* HEADER & NAVIGATION */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Truck className="text-blue-600 w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Logistics & Route Hub</h1>
            <p className="text-sm text-slate-500">Routing, billing, waitlists, and bottle inventory tracking.</p>
          </div>
        </div>
        
        <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
          <button onClick={() => {setActiveTab('route'); setShowDefaulters(false);}} className={`pb-2 px-4 font-semibold transition ${activeTab === 'route' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Daily Route</button>
          <button onClick={() => {setActiveTab('history'); setShowDefaulters(false);}} className={`pb-2 px-4 font-semibold transition ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Customer Ledger</button>
          <button onClick={() => setActiveTab('billing')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'billing' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Billing & True Ledger</button>
          <button onClick={() => {setActiveTab('customers'); setShowDefaulters(false);}} className={`pb-2 px-4 font-semibold transition ${activeTab === 'customers' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Master Directory</button>
          <button onClick={() => {setActiveTab('areas'); setShowDefaulters(false);}} className={`pb-2 px-4 font-semibold transition ${activeTab === 'areas' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Routing Settings</button>
          <button onClick={() => {setActiveTab('waitlist'); setShowDefaulters(false);}} className={`pb-2 px-4 font-semibold transition ${activeTab === 'waitlist' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Waitlist</button>
          <button onClick={() => {setActiveTab('bottles'); setShowDefaulters(false);}} className={`pb-2 px-4 font-semibold transition ${activeTab === 'bottles' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Bottle Inventory</button>
          <button onClick={() => {setActiveTab('spoilage'); setShowDefaulters(false);}} className={`pb-2 px-4 font-semibold transition ${activeTab === 'spoilage' ? 'border-b-2 border-red-600 text-red-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Spoilage & Loss</button>
        </div>
      </div>

      {/* TAB 1: DAILY ROUTE SHEET WITH RECONCILIATION, BOTTLES & SPOT SALES */}
      {activeTab === 'route' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">

          {/* --- NEW: AI LOGISTICS MANAGER --- */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl text-white mb-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><Brain className="text-blue-400"/> NooRganic Route & Fulfillment AI</h2>
                <p className="text-sm text-slate-400 mt-1">Evaluates supply vs demand, route efficiency, and waitlist opportunities.</p>
              </div>
              <button 
                type="button"
                onClick={handleLogisticsAnalysis}
                disabled={isAiLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 text-sm rounded-lg transition flex items-center gap-2 disabled:bg-slate-600"
              >
                <Sparkles size={16}/> {isAiLoading ? 'Analyzing Fulfillment...' : 'Generate AI Strategy'}
              </button>
            </div>
            {aiReport && (
              <div className="bg-slate-800 border-2 border-blue-700 rounded-xl p-6 shadow-sm">
                <h4 className="text-lg font-bold text-blue-400 mb-4">AI Logistics & Supply Assessment</h4>
                <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-medium">
                  {aiReport.replace(/\*/g, '')}
                </div>
              </div>
            )}
          </div>
          {/* -------------------------------------- */}

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-end">
            <div><label className="block text-xs font-bold text-blue-900 mb-1 flex items-center gap-1"><Calendar size={14}/> ROUTE DATE</label><input type="date" value={routeDate} onChange={(e)=>setRouteDate(e.target.value)} className="w-40 p-2 rounded outline-none border border-blue-300 font-bold text-slate-700" /></div>
            <div><label className="block text-xs font-bold text-blue-900 mb-1">SHIFT</label><select value={shift} onChange={(e)=>setShift(e.target.value)} className="w-40 p-2 rounded outline-none border border-blue-300 font-bold text-slate-700 bg-white"><option value="Morning">Morning</option><option value="Evening">Evening</option></select></div>
            
            <div className="bg-blue-100 p-2 rounded-lg border border-blue-300 relative">
              <label className="block text-xs font-black text-blue-900 mb-1 uppercase tracking-wider flex items-center gap-1"><MapIcon size={14}/> ROUTE SELECTION</label>
              <select value={routeFilterArea} onChange={(e)=>setRouteFilterArea(e.target.value)} className="w-48 p-1.5 rounded outline-none border border-blue-300 font-bold text-blue-800 bg-white">
                <option value="">Show All Areas</option>
                {uniqueAreaCircles.map(area => <option key={area} value={area}>{area}</option>)}
              </select>
              <p className="absolute -top-3 -right-3 text-[8px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded-full shadow">Auto-Scheduled</p>
            </div>

            <div className="ml-auto bg-emerald-50 p-2 rounded-lg border border-emerald-300">
               <label className="block text-xs font-black text-emerald-900 mb-1 uppercase tracking-wider">Total Taken to Market (Liters)</label>
               <div className="flex items-center gap-2">
                 <input type="number" step="0.5" value={dispatchVolume} onChange={(e)=>setDispatchVolume(e.target.value)} className="w-32 p-1.5 rounded outline-none border border-emerald-300 font-black text-emerald-700 bg-white text-right" placeholder="e.g. 100" />
                 <button onClick={handleDualSync} className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-1.5 rounded hover:bg-emerald-700">Sync</button>
               </div>
            </div>
          </div>

          {dispatchVolume && (
            <div className="flex bg-slate-900 text-white rounded-xl shadow-lg overflow-hidden border border-slate-700">
              <div className="flex-1 p-4 text-center border-r border-slate-700"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dispatched</p><p className="text-2xl font-black">{dispatchVolume} L</p></div>
              <div className="flex-1 p-4 text-center border-r border-slate-700"><p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Logged (Deliveries + R&D + Spot)</p><p className="text-2xl font-black text-blue-300">{totalLoggedLiters} L</p></div>
              <div className={`flex-1 p-4 text-center ${unaccountedMilk > 0 ? 'bg-amber-900/50' : unaccountedMilk < 0 ? 'bg-red-900/50' : 'bg-emerald-900/50'}`}>
                <p className={`text-xs font-bold uppercase tracking-widest ${unaccountedMilk > 0 ? 'text-amber-400' : unaccountedMilk < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {unaccountedMilk > 0 ? 'Remaining / Unaccounted' : unaccountedMilk < 0 ? 'Oversold Error!' : 'Perfect Match'}
                </p>
                <p className="text-2xl font-black">{unaccountedMilk} L</p>
              </div>
            </div>
          )}

          {/* Fleet Dispatch History View */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
            <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Truck size={16} className="text-blue-600"/> Fleet Dispatches Log (Sent to Market)</h3>
            {todaysDispatches.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr><th className="p-2 text-slate-500 uppercase tracking-widest text-[10px]">Time Dispatched</th><th className="p-2 text-right text-slate-500 uppercase tracking-widest text-[10px]">Payload (Liters)</th><th className="p-2 text-center text-slate-500 uppercase tracking-widest text-[10px]">Action</th></tr>
                  </thead>
                  <tbody>
                    {todaysDispatches.map(d => (
                      <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-700">{new Date(d.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        <td className="p-2 text-right font-black text-emerald-600">+{d.qty} L</td>
                        <td className="p-2 text-center"><button onClick={() => handleDeleteDispatchLog(d.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded">No milk has been dispatched by the drivers for this shift yet.</p>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><MapPin size={20} className="text-blue-600"/> Delivery Quick-Entry</h2>
                <p className="text-sm text-slate-500">Showing <span className="font-bold text-slate-700">{routeFilterArea || 'All Areas'}</span> + all <span className="font-bold text-emerald-600">Daily</span> customers.</p>
              </div>
              <div className="text-right">
                 <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded mb-1">Broken Bottles incur ₹50 penalty auto-added to bill. If filled, auto-logs to Spoilage.</p>
                 <p className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Returned/Spoiled milk deducts from your farm profitability logic.</p>
              </div>
            </div>
            
            <div className="overflow-x-auto pb-12">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-500 text-xs uppercase tracking-wider bg-slate-50">
                    <th className="py-3 px-4 font-bold rounded-tl-lg">Customer ID & Name</th>
                    <th className="py-3 px-4 font-bold">Route Info</th>
                    <th className="py-3 px-4 font-bold text-center border-l border-slate-200">Qty Del. (L)</th>
                    <th className="py-3 px-4 font-bold text-center border-l border-slate-200 text-amber-700 bg-amber-50/50">Spoiled / Ret. (L)</th>
                    <th className="py-3 px-4 font-bold text-center text-red-700 bg-red-50/50 rounded-tr-lg border-l border-red-100" colSpan="2">Broken Bottles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers
                    .filter(c => c.status === 'Active')
                    .filter(c => routeFilterArea === '' || c.areaCircle === routeFilterArea || c.deliveryFrequency === 'Daily')
                    .map(customer => {
                      const cData = routeLogs[customer.id] || {};
                      return (
                      <tr key={customer.id} className={`hover:bg-blue-50/30 transition ${customer.isStaff ? 'bg-amber-50/30' : ''}`}>
                        <td className="py-3 px-4">
                          <p className="text-[10px] font-black text-blue-500 tracking-widest uppercase">{customer.displayId}</p>
                          <p className="font-bold text-slate-800">{customer.name || 'Unknown'} {customer.isStaff && <span className="text-[10px] bg-amber-200 text-amber-800 px-1 rounded ml-1">STAFF</span>}</p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2 mb-1">
                            <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-widest">{customer.areaCircle || 'Unassigned'}</span>
                            {customer.deliveryFrequency === 'Daily' && <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-widest">Daily</span>}
                          </div>
                          <p className="text-[10px] text-slate-500 max-w-[150px] truncate">{customer.address || '--'}</p>
                        </td>
                        
                        <td className="py-3 px-4 text-center border-l border-slate-100 bg-white">
                          <input 
                            type="number" step="0.5" placeholder="0.0"
                            value={cData.qty || ''}
                            onChange={(e) => handleRouteLogChange(customer.id, 'qty', e.target.value)}
                            className={`w-20 p-2 text-center font-bold rounded outline-none border focus:ring-2 focus:ring-blue-500 ${
                              cData.qty ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-slate-300 text-slate-700'
                            }`} 
                          />
                        </td>

                        <td className="py-3 px-4 text-center border-l border-amber-100 bg-amber-50/30">
                          <input 
                            type="number" step="0.5" placeholder="0.0"
                            value={cData.spoiled || ''}
                            onChange={(e) => handleRouteLogChange(customer.id, 'spoiled', e.target.value)}
                            className={`w-20 p-2 text-center font-bold rounded outline-none border focus:ring-2 focus:ring-amber-500 ${
                              cData.spoiled ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-white border-amber-200 text-amber-700'
                            }`} 
                          />
                        </td>

                        <td className="py-3 px-2 text-right bg-red-50/30 border-l border-red-100">
                          <input 
                            type="number" placeholder="0"
                            value={cData.broken || ''}
                            onChange={(e) => handleRouteLogChange(customer.id, 'broken', e.target.value)}
                            className="w-16 p-2 text-center font-bold rounded outline-none border border-red-200 text-red-700 bg-white focus:ring-2 focus:ring-red-500"
                          />
                        </td>
                        <td className="py-3 px-2 bg-red-50/30 w-24">
                           {parseInt(cData.broken) > 0 && (
                             <label className="flex items-center gap-1 text-[10px] font-bold text-red-800 cursor-pointer animate-in fade-in">
                               <input type="checkbox" checked={cData.wasFilled || false} onChange={(e) => handleRouteLogChange(customer.id, 'wasFilled', e.target.checked)} className="w-3 h-3 accent-red-600" />
                               Filled w/ Milk?
                             </label>
                           )}
                        </td>
                      </tr>
                    )})}
                  
                  <tr className="bg-emerald-50/50 border-t-2 border-emerald-200">
                    <td className="py-4 px-4 font-black text-emerald-800 flex items-center gap-2"><Coins size={18}/> Random Spot Sales</td>
                    <td className="py-4 px-4"><input type="number" value={spotSale.amount} onChange={(e)=>setSpotSale({...spotSale, amount: e.target.value})} placeholder="Total ₹" className="w-24 p-2 font-bold rounded outline-none border border-emerald-300 focus:ring-2 focus:ring-emerald-500" /></td>
                    
                    <td className="py-4 px-4 text-center border-l border-emerald-200 bg-white"><input type="number" step="0.5" value={spotSale.qty} onChange={(e)=>setSpotSale({...spotSale, qty: e.target.value})} placeholder="Del (L)" className="w-20 p-2 text-center font-bold rounded outline-none border border-emerald-300 focus:ring-2 focus:ring-emerald-500" /></td>
                    
                    <td className="py-4 px-4 text-center border-l border-amber-200 bg-amber-50/50"><input type="number" step="0.5" value={spotSale.spoiled} onChange={(e)=>setSpotSale({...spotSale, spoiled: e.target.value})} placeholder="Ret (L)" className="w-20 p-2 text-center font-bold rounded outline-none border border-amber-300 text-amber-800 focus:ring-2 focus:ring-amber-500" /></td>
                    
                    <td className="py-4 px-2 text-right bg-red-50/50 border-l border-red-200"><input type="number" value={spotSale.broken} onChange={(e)=>setSpotSale({...spotSale, broken: e.target.value})} placeholder="0" className="w-16 p-2 text-center font-bold rounded outline-none border border-red-200 text-red-700 bg-white" /></td>
                    <td className="py-4 px-2 bg-red-50/50">
                       {parseInt(spotSale.broken) > 0 && (
                         <label className="flex items-center gap-1 text-[10px] font-bold text-red-800 cursor-pointer animate-in fade-in">
                           <input type="checkbox" checked={spotSale.wasFilled || false} onChange={(e) => setSpotSale({...spotSale, wasFilled: e.target.checked})} className="w-3 h-3 accent-red-600" /> Filled?
                         </label>
                       )}
                    </td>
                  </tr>

                  <tr className="bg-purple-50/50 border-t-2 border-purple-200">
                    <td className="py-4 px-4 font-black text-purple-800 flex items-center gap-2"><Beaker size={18}/> R&D / Internal Farm Use</td>
                    <td className="py-4 px-4">
                      <select value={internalUse.purpose} onChange={(e)=>setInternalUse({...internalUse, purpose: e.target.value, notes: ''})} className="w-full p-2 font-bold rounded outline-none border border-purple-300 focus:ring-2 focus:ring-purple-500 text-purple-900 bg-white">
                        <option value="Transfer to Processing">Transfer to Processing</option>
                        <option value="R&D">R&D / Product Dev</option>
                        <option value="Calf Feeding">Calf Feeding</option>
                      </select>
                    </td>
                    <td className="py-4 px-4 text-center border-l border-purple-200 bg-white">
                      <input type="number" step="0.5" value={internalUse.qty} onChange={(e)=>setInternalUse({...internalUse, qty: e.target.value})} placeholder="Qty (L)" className="w-20 p-2 text-center font-bold rounded outline-none border border-purple-300 focus:ring-2 focus:ring-purple-500" />
                    </td>
                    <td className="py-4 px-2 text-right bg-purple-50 border-l border-purple-200" colSpan="2">
                      {internalUse.purpose === 'Calf Feeding' ? (
                        <select value={internalUse.notes} onChange={(e)=>setInternalUse({...internalUse, notes: e.target.value})} className="w-full p-2 text-xs font-bold rounded outline-none border border-purple-200 bg-white focus:ring-2 focus:ring-purple-500">
                          <option value="">-- Select Calf Tag --</option>
                          {validCalves.map(animal => {
                            const tagId = animal.id || animal.tag || animal.docId;
                            return <option key={animal.docId || tagId} value={tagId}>Tag: {tagId} {animal.name ? `- ${animal.name}` : ''}</option>
                          })}
                          {validCalves.length === 0 && <option disabled>No calves found in Database</option>}
                        </select>
                      ) : (
                        <input type="text" value={internalUse.notes} onChange={(e)=>setInternalUse({...internalUse, notes: e.target.value})} placeholder="Project / Details..." className="w-full p-2 text-xs font-bold rounded outline-none border border-purple-200 bg-white focus:ring-2 focus:ring-purple-500" />
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
               <button onClick={handleSaveDailyRoute} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-12 rounded-xl shadow-lg flex items-center gap-2 transition text-lg">
                 <Save size={20}/> Save & Complete Route
               </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMER LEDGER & HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
             <div>
               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="text-blue-600"/> Master Delivery Ledger</h2>
               <p className="text-sm text-slate-500">View daily route deliveries or select a specific customer to generate PDF bills.</p>
             </div>
             <div className="flex flex-col gap-3 items-end">
               <button onClick={handleExportDeliveryGrid} className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold py-1.5 px-3 rounded flex items-center gap-2 transition text-xs shadow-sm">
                 <Download size={14}/> Download Monthly Audit Grid (Excel)
               </button>
               <div className="flex gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200 items-end">
                
                {!selectedHistoryCustomer && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">DATE</label>
                      <input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="border border-slate-300 p-2 rounded outline-none font-bold text-slate-700 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">ROUTE FILTER</label>
                      <select value={historyRoute} onChange={(e) => setHistoryRoute(e.target.value)} className="border border-slate-300 p-2 rounded outline-none font-bold text-slate-700 bg-white w-40">
                        <option value="">All Routes</option>
                        {uniqueAreaCircles.map(area => <option key={area} value={area}>{area}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {selectedHistoryCustomer && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">MONTH FILTER (For PDF)</label>
                    <div className="flex items-center gap-2">
                      <input type="month" value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)} className="border border-slate-300 p-2 rounded outline-none font-bold text-slate-700 bg-white" />
                      <button onClick={() => setHistoryMonth('')} className="text-xs font-bold text-slate-500 hover:text-blue-600 underline">All Time</button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">CUSTOMER</label>
                  <select value={selectedHistoryCustomer} onChange={(e) => setSelectedHistoryCustomer(e.target.value)} className="border border-slate-300 p-2 rounded outline-none font-bold text-blue-700 bg-blue-50 w-64">
                    <option value="">-- All Customers (Daily View) --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.displayId} : {c.name}</option>)}
                  </select>
                </div>

               </div>
            </div>
          </div>

          {/* CUSTOMER INFO BLOCK (Only shows if single customer is selected) */}
          {activeCustomerRecord && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
               <div className="p-6 flex justify-between items-end bg-slate-50/50">
                  <div>
                    <h3 className="font-black text-2xl text-slate-800">{activeCustomerRecord.name}</h3>
                    <p className="text-sm font-bold text-slate-500 mt-1">ID: <span className="text-blue-600">{activeCustomerRecord.displayId}</span> • Area: {activeCustomerRecord.areaCircle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Account Balance</p>
                    <p className={`text-3xl font-black ${activeLedgerData?.netBalance > 0 ? 'text-amber-600' : activeLedgerData?.netBalance < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {activeLedgerData?.netBalance > 0 ? `₹${activeLedgerData.netBalance.toLocaleString()} Due` : activeLedgerData?.netBalance < 0 ? `₹${Math.abs(activeLedgerData.netBalance).toLocaleString()} Advance` : 'Settled'}
                    </p>
                  </div>
               </div>
               
               <div className="p-4 flex justify-between items-center bg-blue-50 border-t border-blue-100">
                  <p className="text-xs text-blue-800 font-bold flex items-center gap-2">
                    Generate an official PDF statement based on your selected month filter.
                  </p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setAdjustmentModal({show: true, customer: activeCustomerRecord, amount: '', type: 'Charge', date: new Date().toISOString().split('T')[0], notes: ''})} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded flex items-center gap-2 shadow transition text-sm">
                      <ArrowRightLeft size={16}/> Adjust Balance
                    </button>
                    <button onClick={handlePrintStatement} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded flex items-center gap-2 shadow transition">
                      <Printer size={16}/> View & Print PDF Statement
                    </button>
                  </div>
               </div>
            </div>
          )}

          {/* LEDGER TABLE */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative pb-[70px]"> 
             <div className="overflow-x-auto max-h-[600px]">
               <table className="w-full text-left border-collapse">
                 <thead className="bg-white border-b-2 border-slate-200 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                   <tr>
                     <th className="py-3 px-6 font-bold">Date</th>
                     {!selectedHistoryCustomer && <th className="py-3 px-6 font-bold">Customer Name</th>}
                     <th className="py-3 px-6 font-bold">Action / Type</th>
                     <th className="py-3 px-6 font-bold text-center">Qty / Breakage</th>
                     <th className="py-3 px-6 font-bold text-right border-l border-slate-100">Net Impact (₹)</th>
                     <th className="py-3 px-6 font-bold text-right">Edit / Delete</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 text-sm">
                   {sortedLedgerData.map(record => (
                     <tr key={record.id} className={record.isPayment ? "bg-emerald-50/50 hover:bg-emerald-50" : "hover:bg-slate-50"}>
                       <td className={`py-3 px-6 font-bold ${record.isPayment ? 'text-emerald-800' : 'text-slate-700'}`}>
                         {record.date} {record.shift && <span className="text-[10px] font-normal text-slate-500 ml-2 bg-slate-200 px-1.5 py-0.5 rounded">{record.shift}</span>}
                       </td>
                       
                       {!selectedHistoryCustomer && (
                         <td className="py-3 px-6 font-bold text-slate-800">
                           {record.customer_name}
                         </td>
                       )}

                       <td className="py-3 px-6">
                         {record.isPayment ? (
                           <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-emerald-200 text-emerald-800 border border-emerald-300">Payment Recvd via {record.method}</span>
                         ) : (
                           <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-blue-100 text-blue-700 border border-blue-200">Milk Delivery</span>
                         )}
                       </td>
                       
                       <td className="py-3 px-6 text-center">
                         {record.isPayment ? (
                           <span className="text-xs text-emerald-600 font-bold">--</span>
                         ) : (
                           <div>
                             <span className="font-bold text-blue-600">{record.liters_delivered} L</span>
                             {record.bottles_broken > 0 && <span className="text-xs text-red-600 font-bold ml-2">({record.bottles_broken} Broken)</span>}
                           </div>
                         )}
                       </td>

                       <td className={`py-3 px-6 text-right font-black border-l border-slate-100 ${record.isPayment ? 'text-emerald-600' : 'text-amber-600'}`}>
                         {record.isPayment ? `-₹${Number(record.amount||0).toLocaleString()}` : `+₹${Number(record.total_value||0).toLocaleString()}`}
                       </td>
                       
                       <td className="py-3 px-6 text-right">
                         <div className="flex justify-end gap-2">
                           {!record.isPayment && (
                              <button onClick={() => handleUpdateHistoricalDelivery(record.id, record)} className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 rounded"><Edit size={14}/></button>
                           )}
                           <button onClick={() => record.isPayment ? handleDeletePaymentRecord(record.id) : handleDeleteDeliveryRecord(record.id)} className="text-red-400 hover:text-red-600 p-1 bg-red-50 rounded"><Trash2 size={14}/></button>
                         </div>
                       </td>
                     </tr>
                   ))}
                   {sortedLedgerData.length === 0 && <tr><td colSpan={selectedHistoryCustomer ? "5" : "6"} className="py-12 text-center text-slate-400 font-medium">No activity found.</td></tr>}
                 </tbody>
               </table>
             </div>

             {/* TOTALS FOOTER (Only for Daily View) */}
             {!selectedHistoryCustomer && sortedLedgerData.length > 0 && (
               <div className="bg-slate-800 p-4 border-t border-slate-700 flex justify-between items-center text-white absolute bottom-0 left-0 right-0 w-full">
                  <div className="flex gap-6">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Delivered</p>
                      <p className="text-xl font-black text-blue-400">{dailyTotalLiters} L</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Billing Value</p>
                      <p className="text-xl font-black text-amber-400">₹{dailyTotalValue.toLocaleString()}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Payments Recvd</p>
                    <p className="text-xl font-black text-emerald-400">₹{dailyTotalPayments.toLocaleString()}</p>
                  </div>
               </div>
             )}
          </div>
        </div>
      )}

      {/* TAB 3: BILLING & COLLECTIONS (TRUE ACCRUAL MODEL + WHATSAPP WORKFLOW) */}
      {activeTab === 'billing' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
             <div>
               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Banknote className="text-emerald-600"/> Monthly Billing & Collections</h2>
               <p className="text-sm text-slate-500">Track true accrued balances, log payments, and trigger push notifications.</p>
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">BILLING CYCLE (MONTH)</label>
                <input type="month" value={billingMonth} onChange={(e) => {setBillingMonth(e.target.value); setShowDefaulters(false);}} className="border border-slate-300 p-2 rounded outline-none font-bold text-slate-700" />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl shadow-sm text-center">
               <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1">Current Month Billed</p>
               <p className="text-3xl font-black text-emerald-900">₹{billingData.reduce((sum, c) => sum + c.currentMonthBilled, 0).toLocaleString()}</p>
             </div>
             <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl shadow-sm text-center">
               <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">All-Time Realized (Paid)</p>
               <p className="text-3xl font-black text-blue-900">₹{billingData.reduce((sum, c) => sum + c.allTimePaid, 0).toLocaleString()}</p>
             </div>
             <div onClick={() => setShowDefaulters(!showDefaulters)} className={`border p-6 rounded-xl shadow-sm text-center cursor-pointer transition relative group ${showDefaulters ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'}`}>
               <div className="absolute top-3 right-3 text-amber-500 group-hover:animate-bounce"><Bell size={20}/></div>
               <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1">All-Time Outstanding Arrears</p>
               <p className="text-3xl font-black text-amber-900">₹{defaulters.reduce((sum, c) => sum + c.netBalance, 0).toLocaleString()}</p>
               <p className="text-[10px] text-amber-600 mt-2 font-bold uppercase tracking-widest bg-amber-200/50 inline-block px-2 py-0.5 rounded">Click to View Defaulters</p>
             </div>
          </div>

          {showDefaulters && (
            <div className="bg-white p-6 rounded-xl border-2 border-amber-300 shadow-lg animate-in slide-in-from-top-4 relative">
              <button onClick={() => setShowDefaulters(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800"><X size={20}/></button>
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <div>
                  <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2"><AlertCircle className="text-amber-600"/> Pending Collections List</h2>
                  <p className="text-sm text-slate-500 mt-1">There are {defaulters.length} customers with outstanding balances.</p>
                </div>
                <button onClick={handleBlastDefaulters} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold px-6 py-2 rounded-lg flex items-center gap-2 shadow-sm transition disabled:opacity-50">
                  <Send size={16}/> Blast Push Notifications
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                      <th className="py-3 px-4 font-bold">Client ID & Name</th>
                      <th className="py-3 px-4 font-bold">Phone Number</th>
                      <th className="py-3 px-4 font-bold text-right text-amber-600">Ledger Balance (Due)</th>
                      <th className="py-3 px-4 font-bold text-right">Send Reminder & Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {defaulters.map(cust => (
                      <tr key={cust.id} className="hover:bg-amber-50/30">
                        <td className="py-3 px-4 font-bold text-slate-800"><span className="text-[10px] text-blue-500 mr-2">{cust.displayId}</span>{cust.name}</td>
                        <td className="py-3 px-4 font-bold text-slate-600">{cust.phone || 'No Phone'}</td>
                        <td className="py-3 px-4 text-right font-black text-amber-600 text-lg">₹{cust.netBalance.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => handleSendIndividualReminder(cust)} className="text-green-600 hover:text-green-800 font-bold bg-green-50 px-3 py-1.5 rounded flex items-center gap-2 ml-auto transition border border-green-200 shadow-sm">
                            <MessageCircle size={14}/> WhatsApp + PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                    {defaulters.length === 0 && <tr><td colSpan="4" className="py-8 text-center text-slate-400 font-medium">All accounts settled!</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-800">Complete True Accrual Roster</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                    <th className="py-4 px-6 font-bold">Client Account</th>
                    <th className="py-4 px-6 font-bold text-center border-l border-slate-200">Month Vol.</th>
                    <th className="py-4 px-6 font-bold text-center text-red-600">Broken</th>
                    <th className="py-4 px-6 font-bold text-right border-l border-slate-200">All-Time Billed</th>
                    <th className="py-4 px-6 font-bold text-right">All-Time Paid</th>
                    <th className="py-4 px-6 font-bold text-right">Current Balance</th>
                    <th className="py-4 px-6 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {billingData.map(cust => (
                    <tr key={cust.id} className="hover:bg-slate-50 transition">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-800 flex items-center gap-2"><span className="text-[10px] text-blue-500 font-black">{cust.displayId}</span> {cust.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{cust.isStaff ? 'Staff Ledger' : cust.type} • ₹{cust.pricePerLiter}/L</div>
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-blue-600 border-l border-slate-100">{cust.totalLiters} L</td>
                      <td className="py-4 px-6 text-center font-bold text-red-600">{cust.brokenBottles > 0 ? cust.brokenBottles : '--'}</td>
                      
                      <td className="py-4 px-6 text-right font-medium text-slate-500 border-l border-slate-100">₹{cust.allTimeBilled.toLocaleString()}</td>
                      <td className="py-4 px-6 text-right font-medium text-emerald-600">₹{cust.allTimePaid.toLocaleString()}</td>
                      
                      <td className="py-4 px-6 text-right">
                        {cust.isStaff ? (
                          <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded text-[10px] uppercase tracking-widest border border-emerald-200">Staff Account</span>
                        ) : cust.netBalance > 0 ? (
                          <span className="text-amber-600 font-black text-lg">₹{cust.netBalance.toLocaleString()} <span className="text-[10px] font-bold">DUE</span></span>
                        ) : cust.netBalance < 0 ? (
                          <span className="text-emerald-600 font-black text-lg">₹{Math.abs(cust.netBalance).toLocaleString()} <span className="text-[10px] font-bold">ADV</span></span>
                        ) : (
                          <span className="text-slate-400 font-bold flex items-center justify-end gap-1"><CheckCircle size={14}/> Settled</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {!cust.isStaff && (
                          <button onClick={() => setPaymentModal({show: true, customer: cust, amount: cust.netBalance > 0 ? cust.netBalance : '', method: 'Cash', date: new Date().toISOString().split('T')[0], notes: ''})} className="bg-emerald-600 text-white font-bold px-4 py-2 rounded shadow-sm hover:bg-emerald-700 transition flex items-center gap-2 ml-auto">
                            <IndianRupee size={16}/> Log Payment
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {billingData.length === 0 && <tr><td colSpan="7" className="py-8 text-center text-slate-400 font-medium">No deliveries found for this month.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AREA SETUP & ANALYTICS */}
      {activeTab === 'areas' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-center mb-6 border-b pb-4">
               <div>
                 <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Settings className="text-blue-600"/> Route Scheduling Engine</h2>
                 <p className="text-sm text-slate-500">Assign Area Circles to Odd/Even days. The Daily Route Sheet will auto-load them continuously based on the calendar date, regardless of month changes.</p>
               </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {uniqueAreaCircles.filter(a => a !== 'Unassigned').map(area => (
                  <div key={area} className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex flex-col gap-2">
                    <h3 className="font-bold text-slate-800">{area}</h3>
                    <select 
                      value={areaSettings[area] || 'Manual'} 
                      onChange={(e) => handleSaveAreaSchedule(area, e.target.value)}
                      className="border p-2 rounded outline-none font-bold text-blue-700 text-sm"
                    >
                      <option value="Manual">Manual Selection Only</option>
                      <option value="Odd Days">Odd Delivery Days</option>
                      <option value="Even Days">Even Delivery Days</option>
                    </select>
                  </div>
                ))}
                {uniqueAreaCircles.filter(a => a !== 'Unassigned').length === 0 && <p className="text-sm text-slate-400">No area circles to schedule. Add them in the Customer Directory.</p>}
             </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
             <div>
               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><MapIcon className="text-blue-600"/> Area Circle Lifetime Analytics</h2>
               <p className="text-sm text-slate-500">Compare historical revenue and volume across different geographic delivery zones.</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {areaAnalytics.filter(a => a.area !== 'Unassigned').map(area => (
              <div key={area.area} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">{area.area}</h3>
                    <p className="text-xs font-bold text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded mt-1">{area.activeCustomers} Active Customers</p>
                  </div>
                  <Layers className="text-slate-200" size={32} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">All-Time Volume</p><p className="text-2xl font-black text-slate-700">{area.totalVolume} L</p></div>
                  <div><p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">All-Time Revenue</p><p className="text-2xl font-black text-emerald-700">₹{area.totalRevenue.toLocaleString()}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: WAITLIST */}
      {activeTab === 'waitlist' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
               <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><ListPlus className="text-blue-600"/> Log Potential Lead</h2>
               <form onSubmit={handleAddWaitlist} className="space-y-4">
                 <div><label className="block text-xs font-bold text-slate-500 mb-1">FULL NAME *</label><input type="text" required value={newWaitlist.name} onChange={(e)=>setNewWaitlist({...newWaitlist, name: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
                 <div><label className="block text-xs font-bold text-slate-500 mb-1">PHONE NUMBER *</label><input type="text" required value={newWaitlist.phone} onChange={(e)=>setNewWaitlist({...newWaitlist, phone: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
                 <div><label className="block text-xs font-bold text-slate-500 mb-1">AREA / ADDRESS</label><input type="text" value={newWaitlist.address} onChange={(e)=>setNewWaitlist({...newWaitlist, address: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
                 <div><label className="block text-xs font-bold text-slate-500 mb-1">NOTES (Required Qty)</label><input type="text" value={newWaitlist.notes} onChange={(e)=>setNewWaitlist({...newWaitlist, notes: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="e.g. Wants 2L Daily..." /></div>
                 <button disabled={loading} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded hover:bg-blue-700 shadow">Save to Waitlist</button>
               </form>
             </div>
             
             <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Clock className="text-blue-600"/> Current Waitlist Directory</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider"><th className="py-3 px-4 font-bold">Contact Info</th><th className="py-3 px-4 font-bold">Location & Notes</th><th className="py-3 px-4 font-bold text-right">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {waitlist.map(lead => (
                        <tr key={lead.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-bold text-slate-800">{lead.name}<br/><span className="text-xs text-slate-500 font-normal">{lead.phone}</span></td>
                          <td className="py-3 px-4 text-xs text-slate-600 font-bold">{lead.address}<br/><span className="font-normal italic text-slate-400">{lead.notes}</span></td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={()=>handlePromoteWaitlist(lead)} className="bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold px-3 py-1.5 rounded text-xs hover:bg-emerald-200 transition">Convert to Customer</button>
                          </td>
                        </tr>
                      ))}
                      {waitlist.length === 0 && <tr><td colSpan="3" className="py-8 text-center text-slate-400 font-medium">Waitlist is currently empty.</td></tr>}
                    </tbody>
                  </table>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* TAB 6: BOTTLE INVENTORY */}
      {activeTab === 'bottles' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl shadow-sm text-center">
               <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">Total Bottles Purchased</p>
               <p className="text-3xl font-black text-blue-900">{bottleStats.purchased}</p>
             </div>
             <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl shadow-sm text-center">
               <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1">Active Circulation</p>
               <p className="text-3xl font-black text-emerald-900">{activeBottles}</p>
             </div>
             <div className="bg-red-50 border border-red-200 p-6 rounded-xl shadow-sm text-center">
               <p className="text-xs font-bold text-red-700 uppercase tracking-widest mb-1">Total Broken / Lost</p>
               <p className="text-3xl font-black text-red-900">{bottleStats.farmBroken + bottleStats.customerBroken}</p>
               <p className="text-[10px] text-red-600 font-bold mt-1 uppercase tracking-widest">({bottleStats.farmBroken} Farm / {bottleStats.customerBroken} Cust)</p>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Beaker className="text-blue-600"/> Manage Bottle Inventory</h2>
              <form onSubmit={handleLogBottleAction} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ACTION TYPE</label>
                  <select value={bottleForm.type} onChange={(e)=>setBottleForm({...bottleForm, type: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold">
                    <option value="Purchase">Add New Bottles (Purchase)</option>
                    <option value="Staff_Breakage">Log Farm/Staff Breakage</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">QUANTITY</label><input type="number" required value={bottleForm.qty} onChange={(e)=>setBottleForm({...bottleForm, qty: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none" /></div>
                  {bottleForm.type === 'Purchase' && (
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">TOTAL COST (₹)</label><input type="number" required value={bottleForm.cost} onChange={(e)=>setBottleForm({...bottleForm, cost: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none" /></div>
                  )}
                </div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">NOTES</label><input type="text" value={bottleForm.notes} onChange={(e)=>setBottleForm({...bottleForm, notes: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none" placeholder={bottleForm.type === 'Staff_Breakage' ? "Who broke it? How?" : "Vendor name..."} /></div>
                <button disabled={loading} type="submit" className={`w-full text-white font-bold py-2.5 rounded shadow transition ${bottleForm.type === 'Purchase' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>Log Action</button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><PackageMinus className="text-blue-600"/> Bottle Tracking History</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider"><th className="py-3 px-4 font-bold">Date</th><th className="py-3 px-4 font-bold">Action</th><th className="py-3 px-4 font-bold text-center">Qty</th><th className="py-3 px-4 font-bold text-right">Details</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {bottleLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-700">{new Date(log.recorded_at?.seconds * 1000).toLocaleDateString() || '--'}</td>
                        <td className="py-3 px-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${log.type === 'Purchase' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{log.type.replace('_', ' ')}</span></td>
                        <td className={`py-3 px-4 text-center font-black ${log.type === 'Purchase' ? 'text-emerald-600' : 'text-red-600'}`}>{log.type === 'Purchase' ? '+' : '-'}{log.qty}</td>
                        <td className="py-3 px-4 text-right text-xs text-slate-500">{log.type === 'Purchase' ? `Cost: ₹${log.cost}` : log.notes}</td>
                      </tr>
                    ))}
                    {bottleLogs.length === 0 && <tr><td colSpan="4" className="py-8 text-center text-slate-400 font-medium">No bottle inventory logs found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: SPOILAGE & LOSS TRACKER */}
      {activeTab === 'spoilage' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
           
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex items-center justify-between mb-4 border-b pb-4">
               <h2 className="text-lg font-bold text-red-900 flex items-center gap-2"><AlertOctagon size={20}/> Log Manual Spoilage / Farm Loss</h2>
               <span className="bg-red-50 text-red-700 text-xs font-bold px-3 py-1 rounded-full border border-red-200">Manual Entry</span>
             </div>
             <form onSubmit={handleLogManualSpoilage} className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-600 mb-1">DATE OF INCIDENT</label>
                   <input type="date" required value={manualSpoilage.date} onChange={(e)=>setManualSpoilage({...manualSpoilage, date: e.target.value})} className="w-full p-2 border rounded outline-none" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-600 mb-1">ITEM LOST</label>
                   <input type="text" required value={manualSpoilage.item} onChange={(e)=>setManualSpoilage({...manualSpoilage, item: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="e.g. Raw Milk" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-red-700 mb-1">QUANTITY LOST (Liters/Kg)</label>
                   <input type="number" step="0.1" required value={manualSpoilage.qty} onChange={(e)=>setManualSpoilage({...manualSpoilage, qty: e.target.value})} className="w-full p-2 border border-red-300 bg-red-50 text-red-800 font-bold rounded outline-none" placeholder="e.g. 5" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-600 mb-1">MISTAKE TYPE</label>
                   <select required value={manualSpoilage.mistakeType} onChange={(e)=>setManualSpoilage({...manualSpoilage, mistakeType: e.target.value})} className="w-full p-2 border rounded outline-none">
                     <option value="Storage / Souring">Storage / Souring</option>
                     <option value="Farm Breakage / Spill">Farm Breakage / Spill</option>
                     <option value="Transit Breakage">Transit Breakage</option>
                   </select>
                 </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                 <div className="md:col-span-2">
                   <label className="block text-xs font-bold text-slate-600 mb-1">EXPLANATION / ROOT CAUSE</label>
                   <input type="text" required value={manualSpoilage.explanation} onChange={(e)=>setManualSpoilage({...manualSpoilage, explanation: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="How did this happen?" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-600 mb-1">ESTIMATED FINANCIAL LOSS (₹)</label>
                   <input type="number" required value={manualSpoilage.financialLoss} onChange={(e)=>setManualSpoilage({...manualSpoilage, financialLoss: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="₹" />
                 </div>
               </div>
               <div className="flex justify-end pt-2 border-t border-slate-100">
                 <button disabled={loading} type="submit" className="bg-red-600 text-white font-bold py-2.5 px-8 rounded hover:bg-red-700 shadow transition">{loading ? 'Logging...' : 'Log Loss Event'}</button>
               </div>
             </form>
           </div>

           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><HistoryIcon size={20}/> Official Spoilage Ledger</h2>
             </div>
             <p className="text-sm text-slate-500 mb-6">This ledger contains both manual entries and automatic logs generated from the Daily Route sheet.</p>
             <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-500 text-xs uppercase tracking-wider bg-slate-50">
                    <th className="py-3 px-4 font-bold">Date</th>
                    <th className="py-3 px-4 font-bold">Lost Item</th>
                    <th className="py-3 px-4 font-bold">Mistake Type</th>
                    <th className="py-3 px-4 font-bold">Explanation / Root Cause</th>
                    <th className="py-3 px-4 font-bold text-right text-red-600">Financial Hit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {spoilageLogs.map(log => (
                    <tr key={log.id} className="hover:bg-red-50/50 transition">
                      <td className="py-3 px-4 font-bold text-slate-700">{log.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{log.item} <span className="text-xs text-slate-500 font-normal">({log.qty} L/Units)</span></td>
                      <td className="py-3 px-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-slate-200">{log.mistakeType}</span></td>
                      <td className="py-3 px-4 text-slate-600 italic">"{log.explanation}"</td>
                      <td className="py-3 px-4 text-right font-black text-red-600">-₹{(parseFloat(log.financialLoss)||0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {spoilageLogs.length === 0 && <tr><td colSpan="5" className="py-12 text-center text-slate-400 font-medium">No spoilage events logged yet. Great job!</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: CUSTOMER DIRECTORY (WITH BULK IMPORT AND OPENING BALANCE) */}
      {activeTab === 'customers' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">Master Customer Directory</h2>
            <div className="flex items-center gap-3">
              <input 
                 type="file" 
                 accept=".csv" 
                 ref={fileInputRef} 
                 onChange={handleCSVImport} 
                 className="hidden" 
                 id="csv-upload"
              />
              <button onClick={() => setShowImportModal(true)} className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded flex items-center gap-2 transition text-sm">
                <UploadCloud size={16}/> Bulk Import (CSV)
              </button>
              
              <button onClick={() => {setShowAddCustomer(!showAddCustomer); setEditingCustomer(null);}} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center gap-2 transition text-sm">
                <Plus size={16}/> {showAddCustomer ? 'Cancel' : 'Register New Customer'}
              </button>
            </div>
          </div>

          {(showAddCustomer || editingCustomer) && (
            <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-md animate-in fade-in">
              <div className="flex justify-between items-center border-b border-blue-100 pb-2 mb-4">
                <h3 className="font-bold text-blue-900">{editingCustomer ? `Editing: ${editingCustomer.name}` : 'Customer Registration Profile'}</h3>
                {editingCustomer && <button onClick={() => setEditingCustomer(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>}
              </div>

              {editingCustomer?.isStaff && (
                 <div className="bg-amber-50 p-3 rounded border border-amber-200 mb-4">
                    <p className="text-xs font-bold text-amber-800">You are editing a Staff Member. Name, Phone, and Price are locked to the HR/Economics ledger. You can only update their Route/Area and Delivery Frequency here.</p>
                 </div>
              )}

              <form onSubmit={editingCustomer ? handleUpdateCustomer : handleAddCustomer} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">FULL NAME *</label>
                    <input type="text" required disabled={editingCustomer?.isStaff} value={editingCustomer ? editingCustomer.name : newCustomer.name} onChange={(e)=> editingCustomer ? setEditingCustomer({...editingCustomer, name: e.target.value}) : setNewCustomer({...newCustomer, name: e.target.value})} className="w-full p-2 border rounded outline-none focus:border-blue-500 bg-blue-50/30 disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">PHONE NUMBER</label>
                    <input type="text" disabled={editingCustomer?.isStaff} value={editingCustomer ? editingCustomer.phone : newCustomer.phone} onChange={(e)=> editingCustomer ? setEditingCustomer({...editingCustomer, phone: e.target.value}) : setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full p-2 border rounded outline-none bg-blue-50/30 disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1 flex items-center gap-1"><MapIcon size={12}/> AREA CIRCLE / ROUTE</label>
                    <input type="text" list="area-options" required value={editingCustomer ? editingCustomer.areaCircle : newCustomer.areaCircle} onChange={(e)=> editingCustomer ? setEditingCustomer({...editingCustomer, areaCircle: e.target.value}) : setNewCustomer({...newCustomer, areaCircle: e.target.value})} className="w-full p-2 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-900" placeholder="e.g. Route A" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1"><Activity size={12}/> FREQUENCY</label>
                    <select value={editingCustomer ? editingCustomer.deliveryFrequency : newCustomer.deliveryFrequency} onChange={(e)=> editingCustomer ? setEditingCustomer({...editingCustomer, deliveryFrequency: e.target.value}) : setNewCustomer({...newCustomer, deliveryFrequency: e.target.value})} className="w-full p-2 border rounded outline-none bg-blue-50/30 font-bold">
                      <option value="Daily">Daily</option><option value="Alternate / By Area">Alternate / Route Day Only</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">CUSTOMER TYPE</label>
                    <select disabled={editingCustomer?.isStaff} value={editingCustomer ? editingCustomer.type : newCustomer.type} onChange={(e)=> editingCustomer ? setEditingCustomer({...editingCustomer, type: e.target.value}) : setNewCustomer({...newCustomer, type: e.target.value})} className="w-full p-2 border rounded outline-none bg-blue-50/30 disabled:opacity-50">
                      <option value="Residential">Residential (Home Delivery)</option><option value="Commercial">Commercial (Cafe / Shop)</option><option value="Wholesale">Wholesale / Bulk</option>
                      {editingCustomer?.isStaff && <option value="Staff">Staff</option>}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">EXACT DELIVERY ADDRESS / NOTE</label>
                    <input type="text" value={editingCustomer ? editingCustomer.address : newCustomer.address} onChange={(e)=> editingCustomer ? setEditingCustomer({...editingCustomer, address: e.target.value}) : setNewCustomer({...newCustomer, address: e.target.value})} className="w-full p-2 border rounded outline-none bg-blue-50/30" placeholder="House no, street, landmark..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-emerald-600 mb-1">PRICE (₹ per L) *</label>
                    <input type="number" step="0.5" required disabled={editingCustomer?.isStaff} value={editingCustomer ? editingCustomer.pricePerLiter : newCustomer.pricePerLiter} onChange={(e)=> editingCustomer ? setEditingCustomer({...editingCustomer, pricePerLiter: e.target.value}) : setNewCustomer({...newCustomer, pricePerLiter: e.target.value})} className="w-full p-2 border border-emerald-300 bg-emerald-50 rounded outline-none font-bold text-emerald-800 disabled:opacity-50" placeholder="60.00" />
                  </div>
                </div>
                
                {!editingCustomer && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <label className="block text-xs font-bold text-amber-800 mb-1">OPENING BALANCE (₹) [OPTIONAL]</label>
                    <div className="flex gap-4 items-center">
                      <input type="number" value={newCustomer.openingBalance} onChange={(e)=> setNewCustomer({...newCustomer, openingBalance: e.target.value})} className="w-48 p-2 border border-amber-300 rounded outline-none font-bold text-amber-900" placeholder="e.g. 1500 or -500" />
                      <p className="text-[10px] text-amber-700 leading-tight">
                        <strong>Positive (+) Number:</strong> Customer owes the farm this amount.<br/>
                        <strong>Negative (-) Number:</strong> Farm owes the customer (Advance Payment).
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button disabled={loading} type="submit" className="bg-blue-600 text-white font-bold py-2.5 px-8 rounded hover:bg-blue-700 shadow">{editingCustomer ? 'Update Profile' : 'Save Customer Profile'}</button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="py-4 px-6 font-bold">Client ID & Profile</th>
                    <th className="py-4 px-6 font-bold">Area Circle & Contact</th>
                    <th className="py-4 px-6 font-bold">Frequency</th>
                    <th className="py-4 px-6 font-bold">Pricing Setup</th>
                    <th className="py-4 px-6 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {customers.map(cust => (
                    <tr key={cust.id} className={`hover:bg-slate-50 transition ${cust.status === 'Inactive' ? 'opacity-50' : ''}`}>
                      <td className="py-3 px-6">
                        <div className="text-[10px] font-black text-blue-500 tracking-widest uppercase mb-0.5">{cust.displayId}</div>
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          <UserCheck size={16} className={cust.isStaff ? "text-amber-500" : "text-blue-500"}/> {cust.name}
                        </div>
                        {cust.status === 'Inactive' && <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase mt-1 inline-block">Inactive</span>}
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-2 text-slate-800 font-bold mb-1">
                           <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-widest">{cust.areaCircle || 'Unassigned'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-xs"><Phone size={10}/> {cust.phone || '--'}</div>
                      </td>
                      <td className="py-3 px-6">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${
                          cust.deliveryFrequency === 'Daily' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {cust.deliveryFrequency || 'Daily'}
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        {cust.isStaff ? (
                           <span className="text-amber-600 font-bold text-xs bg-amber-50 px-2 py-1 rounded border border-amber-200">Staff Acct (₹{cust.pricePerLiter})</span>
                        ) : (
                           <span className="font-black text-emerald-600">₹{cust.pricePerLiter} <span className="text-xs font-normal text-slate-500">/ L</span></span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-right">
                         <button onClick={() => { setEditingCustomer(cust); setShowAddCustomer(false); window.scrollTo(0,0); }} className="text-blue-500 hover:text-blue-700 p-1"><Edit size={18}/></button>
                         {!cust.isStaff && (
                            <button onClick={() => handleDeleteCustomer(cust.id)} className="text-red-400 hover:text-red-600 p-1 ml-2"><Trash2 size={18}/></button>
                         )}
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && <tr><td colSpan="5" className="py-8 text-center text-slate-400 font-medium">No customers registered.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}