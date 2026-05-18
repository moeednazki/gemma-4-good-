import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Wallet, PackagePlus, Database, Search, Users, Banknote, History, TrendingDown, TrendingUp, Building2, Tag, ArrowLeft, Gift, Milk, UserCircle, AlertOctagon, Landmark, FileSpreadsheet, PiggyBank, Receipt, Printer, Calculator, Check, CheckCircle, Clock, Trash2, FileText, Edit, IdCard, X, Download, FileBarChart, Percent, Scale, UserPlus, Zap, Truck, TrendingUp as IncrementIcon, Activity, Baby, Stethoscope, Factory, Box, LineChart as ChartIcon, Filter, Settings, Image as ImageIcon, PieChart as PieChartIcon, ArrowRightLeft, Sparkles, Brain 
} from 'lucide-react';
import { collection, addDoc, getDocs, serverTimestamp, query, doc, updateDoc, where, deleteDoc, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { askGemma } from "../../services/AIEngine";

export default function Economics() {
  const [activeTab, setActiveTab] = useState('costing'); 
  const [loading, setLoading] = useState(false);
  
  // Core Databases
  const [inventory, setInventory] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]); 
  const [vendors, setVendors] = useState([]); 
  const [spoilageLogs, setSpoilageLogs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [customerPayments, setCustomerPayments] = useState([]); 
  const [revenueLogs, setRevenueLogs] = useState([]);
  const [livestock, setLivestock] = useState([]); 
  
  // Costing Engine specific databases
  const [milkRecords, setMilkRecords] = useState([]);
  const [groupFeedLogs, setGroupFeedLogs] = useState([]);
  const [topDressLogs, setTopDressLogs] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [utilityLogs, setUtilityLogs] = useState([]);
  const [internalMilkLogs, setInternalMilkLogs] = useState([]);

  // Processing Data Integration
  const [vapSales, setVapSales] = useState([]);
  const [vapProductionLogs, setVapProductionLogs] = useState([]);
  const [vapInventory, setVapInventory] = useState([]);

  // Costing Parameter & Farm Profile State
  const [transportBudget, setTransportBudget] = useState(localStorage.getItem('fms_transport_budget') || '15000');
  const [milkSalePrice, setMilkSalePrice] = useState(localStorage.getItem('fms_milk_sale_price') || '60');
  const [utilityForm, setUtilityForm] = useState({ category: 'Electricity', amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
  
  // Farm Details & Tax State
  const [vapTaxRate, setVapTaxRate] = useState(localStorage.getItem('fms_vap_tax_rate') || '0');
  const [farmDetails, setFarmDetails] = useState({
    name: localStorage.getItem('fms_farm_name') || 'YOUR DAIRY FARM',
    address: localStorage.getItem('fms_farm_address') || '123 Agriculture Way, Farming District',
    gstin: localStorage.getItem('fms_farm_gstin') || 'XXXXXXXXXXXXXXX',
    logoData: localStorage.getItem('fms_farm_logo') || null
  });

  // Detailed Employee View State
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeTransactions, setEmployeeTransactions] = useState([]);
  const [showIdCard, setShowIdCard] = useState(false);

  // Inventory & Vendor State
  const [editingInventoryItem, setEditingInventoryItem] = useState(null);
  const [paymentModal, setPaymentModal] = useState({ show: false, vendor: '', amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0], notes: '', proofFile: null });
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: '', phone: '', category: 'Feed Supplier', legacyDebt: '' });

  // === UNIVERSAL ADJUSTMENT STATES ===
  const [stockAdjustModal, setStockAdjustModal] = useState({ show: false, item: null, amount: '', type: 'Add', notes: '' });
  const [capitalAdjustModal, setCapitalAdjustModal] = useState({ show: false, amount: '', type: 'Deposit', notes: '' });
  const [yieldAdjustModal, setYieldAdjustModal] = useState({ show: false, cow: null, amount: '', type: 'Subtract', notes: '' });

  // Active Report State for Dynamic KPIs & Filter
  const [activeReport, setActiveReport] = useState(null);
  const [globalReportPeriod, setGlobalReportPeriod] = useState('This Month');
  const [printingItr, setPrintingItr] = useState(false);
  const [itrYear, setItrYear] = useState('2025-2026');

  // Legacy & Capital States
  const [historicalData, setHistoricalData] = useState([]);
  const [capitalData, setCapitalData] = useState([]);

  // === AI CFO STATE ===
  const [isCfoLoading, setIsCfoLoading] = useState(false);
  const [cfoReport, setCfoReport] = useState(null);

  // Forms
  const [purchase, setPurchase] = useState({ itemName: '', category: 'Medicine', brand: '', vendor: '', totalQuantity: '', unit: 'ml', totalCost: '', paymentStatus: 'Paid in Full' });
  const [receiptFile, setReceiptFile] = useState(null); 
  const [newEmployee, setNewEmployee] = useState({ name: '', role: '', phone: '', aadhar: '', idProof: null, baseSalary: '', joinDate: new Date().toISOString().split('T')[0] });
  const [transactionForm, setTransactionForm] = useState({ type: 'Salary_Earned', amount: '', liters: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [historyForm, setHistoryForm] = useState({ month: 'January', year: new Date().getFullYear(), revenue: '', expenditure: '' });
  const [capitalForm, setCapitalForm] = useState({ type: 'Infrastructure', source: '', item: '', qty: '', amount: '', interestRate: '', date: new Date().toISOString().split('T')[0] });

  const uniqueBrands = [...new Set(inventory.map(i => i.brand).filter(Boolean))];
  const uniqueRoles = [...new Set(['Farm Hand / Milker', 'Veterinarian', 'Manager / Supervisor', ...employees.map(e => e.role).filter(Boolean)])];

  const safeFetch = async (collectionName) => {
    try {
      const snap = await getDocs(collection(db, collectionName));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return [];
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const [inv, emp, hist, cap, spoil, vp, invc, cust, dels, cPays, vend, revs, milk, gFeed, tDress, meds, utils, animals, intMilk, vSales, vProd, vInv] = await Promise.all([
      safeFetch("inventory"), safeFetch("employees"), safeFetch("historical_finances"),
      safeFetch("capital_loans"), safeFetch("spoilage_logs"), safeFetch("vendor_payments"),
      safeFetch("invoices"), safeFetch("customers"), safeFetch("milk_deliveries"), 
      safeFetch("customer_payments"), safeFetch("vendors"), safeFetch("revenue_logs"),
      safeFetch("milk_records"), safeFetch("group_feed_logs"), safeFetch("top_dress_logs"), 
      safeFetch("medical_records"), safeFetch("utility_logs"), safeFetch("livestock"),
      safeFetch("internal_milk_logs"), safeFetch("vap_sales"), safeFetch("vap_production_logs"), 
      safeFetch("vap_inventory")
    ]);

    setInventory(inv.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    setEmployees(emp.sort((a, b) => {
       const nameA = a.name || 'Unnamed Staff';
       const nameB = b.name || 'Unnamed Staff';
       return nameA.localeCompare(nameB);
    }));
    setHistoricalData(hist.sort((a, b) => b.year - a.year || (b.month || '').localeCompare(a.month || '')));
    setCapitalData(cap.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
    setSpoilageLogs(spoil.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
    setVendorPayments(vp.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
    setInvoices(invc.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
    setCustomers(cust.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    setDeliveries(dels.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
    setCustomerPayments(cPays.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
    setVendors(vend.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    setRevenueLogs(revs);
    setMilkRecords(milk);
    setGroupFeedLogs(gFeed);
    setTopDressLogs(tDress);
    setMedicalRecords(meds);
    setUtilityLogs(utils.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
    setLivestock(animals);
    setInternalMilkLogs(intMilk);
    setVapSales(vSales);
    setVapProductionLogs(vProd);
    setVapInventory(vInv);
    setLoading(false);
  };

  const fetchEmployeeTransactions = async (empId) => {
    try {
      const snap = await getDocs(query(collection(db, "employee_transactions"), where("emp_id", "==", empId)));
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setEmployeeTransactions(txs);
    } catch (e) { console.error("Error fetching transactions:", e); }
  };

  useEffect(() => { fetchData(); }, [activeTab]);
  useEffect(() => { if (selectedEmployee) fetchEmployeeTransactions(selectedEmployee.id); }, [selectedEmployee]);

  // =========================================================================
  // UNIVERSAL ADJUSTMENT HANDLERS
  // =========================================================================

  const handleStockAdjustment = async (e) => {
    e.preventDefault();
    if (!stockAdjustModal.amount || parseFloat(stockAdjustModal.amount) <= 0) return alert("Enter a valid amount.");
    setLoading(true);
    try {
      const amount = parseFloat(stockAdjustModal.amount);
      const currentStock = parseFloat(stockAdjustModal.item.current_stock || 0);
      const isAdding = stockAdjustModal.type === 'Add';
      const newTotal = isAdding ? currentStock + amount : Math.max(0, currentStock - amount);

      await updateDoc(doc(db, "inventory", stockAdjustModal.item.id), {
        current_stock: newTotal,
        last_updated: serverTimestamp()
      });

      await addDoc(collection(db, "internal_transfers"), {
        category: "Manual Stock Audit",
        item_name: stockAdjustModal.item.item_name,
        action: isAdding ? 'Added' : 'Removed',
        qty_changed: amount,
        resulting_stock: newTotal,
        notes: stockAdjustModal.notes || 'Routine manual audit count',
        recorded_at: serverTimestamp()
      });

      alert(`${stockAdjustModal.item.item_name} stock updated successfully.`);
      setStockAdjustModal({ show: false, item: null, amount: '', type: 'Add', notes: '' });
      fetchData();
    } catch (error) { alert("Error adjusting stock."); } finally { setLoading(false); }
  };

  const handleCapitalAdjustment = async (e) => {
    e.preventDefault();
    if (!capitalAdjustModal.amount || parseFloat(capitalAdjustModal.amount) <= 0) return alert("Enter a valid amount.");
    setLoading(true);
    try {
      const amount = parseFloat(capitalAdjustModal.amount);
      const isDeposit = capitalAdjustModal.type === 'Deposit';

      await addDoc(collection(db, "capital_loans"), {
        type: 'Capital',
        source: 'Manual Ledger Audit',
        item: isDeposit ? 'Capital Injection' : 'Capital Withdrawal',
        qty: '1',
        amount: isDeposit ? amount : -amount,
        interestRate: 0,
        date: new Date().toISOString().split('T')[0],
        notes: capitalAdjustModal.notes || 'Reconciliation',
        recorded_at: serverTimestamp()
      });

      alert("Master Capital has been reconciled.");
      setCapitalAdjustModal({ show: false, amount: '', type: 'Deposit', notes: '' });
      fetchData();
    } catch (error) { alert("Error adjusting capital."); } finally { setLoading(false); }
  };

  const handleYieldAdjustment = async (e) => {
    e.preventDefault();
    if (!yieldAdjustModal.amount || parseFloat(yieldAdjustModal.amount) <= 0) return alert("Enter a valid amount.");
    setLoading(true);
    try {
      const amount = parseFloat(yieldAdjustModal.amount);
      const isAdding = yieldAdjustModal.type === 'Add';

      await addDoc(collection(db, "milk_records"), {
        cow_id: yieldAdjustModal.cow.tag || yieldAdjustModal.cow.id,
        date: new Date().toISOString().split('T')[0],
        shift: 'Ledger Correction',
        yield_liters: isAdding ? amount : -amount, 
        notes: yieldAdjustModal.notes || 'Manual yield correction',
        recorded_at: serverTimestamp()
      });

      alert(`Yield correction applied to Tag ${yieldAdjustModal.cow.tag || 'UNK'}.`);
      setYieldAdjustModal({ show: false, cow: null, amount: '', type: 'Subtract', notes: '' });
      fetchData();
    } catch (error) { alert("Error correcting yield."); } finally { setLoading(false); }
  };

  const handleDeleteRecord = async (collectionName, id) => {
    if(window.confirm("Permanently delete this record? This action cannot be undone.")) {
      try { 
        await deleteDoc(doc(db, collectionName, id)); 
        fetchData(); 
        if (selectedEmployee && collectionName === 'employee_transactions') fetchEmployeeTransactions(selectedEmployee.id);
      } catch(e) { alert("Error deleting record."); }
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500000) return alert("Please select a logo smaller than 500KB to ensure fast database saving.");
      const reader = new FileReader();
      reader.onloadend = () => setFarmDetails({ ...farmDetails, logoData: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleSaveFarmSettings = () => {
    localStorage.setItem('fms_transport_budget', transportBudget);
    localStorage.setItem('fms_milk_sale_price', milkSalePrice);
    localStorage.setItem('fms_vap_tax_rate', vapTaxRate);
    localStorage.setItem('fms_farm_name', farmDetails.name);
    localStorage.setItem('fms_farm_address', farmDetails.address);
    localStorage.setItem('fms_farm_gstin', farmDetails.gstin);
    if(farmDetails.logoData) localStorage.setItem('fms_farm_logo', farmDetails.logoData);
    alert("Economic & Farm Parameters Updated Successfully!");
  };

  const handleSaveTransportBudget = () => {
    localStorage.setItem('fms_transport_budget', transportBudget);
    localStorage.setItem('fms_milk_sale_price', milkSalePrice);
    alert("Economic Logistics Parameters Updated Successfully!");
  };

  const handleLogUtility = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await addDoc(collection(db, "utility_logs"), {
        category: utilityForm.category, amount: parseFloat(utilityForm.amount) || 0, date: utilityForm.date, notes: utilityForm.notes, recorded_at: serverTimestamp()
      });
      alert(`${utilityForm.category} expense logged successfully!`);
      setUtilityForm({ category: 'Electricity', amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (error) { alert("Error logging utility expense."); } finally { setLoading(false); }
  };

  const handleAddVendor = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const safeVendorId = `vnd_${newVendor.name.replace(/\s+/g, '_').toLowerCase()}`;
      await setDoc(doc(db, "vendors", safeVendorId), { 
        name: newVendor.name, 
        vendor_id: safeVendorId,
        phone: newVendor.phone, 
        category: newVendor.category, 
        legacyDebt: parseFloat(newVendor.legacyDebt) || 0, 
        registered_at: serverTimestamp() 
      });
      alert("Supplier/Vendor Registered Successfully!");
      setNewVendor({ name: '', phone: '', category: 'Feed Supplier', legacyDebt: '' });
      setShowAddVendor(false); fetchData();
    } catch (error) { alert("Error registering vendor."); } finally { setLoading(false); }
  };

  const handleLogPurchase = async (e) => {
    e.preventDefault(); setLoading(true);
    const qty = parseFloat(purchase.totalQuantity); 
    const cost = parseFloat(purchase.totalCost); 
    const unitCost = (cost / qty).toFixed(2); 
    const receiptFileName = receiptFile ? receiptFile.name : 'No receipt attached';

    try {
      await addDoc(collection(db, "inventory"), { 
        item_name: purchase.itemName, category: purchase.category, brand: purchase.brand, vendor: purchase.vendor, 
        total_quantity: qty, current_stock: qty, unit: purchase.unit, total_cost: cost, unit_cost: parseFloat(unitCost), 
        receipt_file: receiptFileName, timestamp: serverTimestamp() 
      });

      if (purchase.paymentStatus === 'Paid in Full') {
        await addDoc(collection(db, "vendor_payments"), {
          vendor: purchase.vendor, amount: cost, date: new Date().toISOString().split('T')[0], 
          method: 'Cash', notes: `Auto-Paid for ${purchase.itemName}`, proof_file: 'N/A', recorded_at: serverTimestamp()
        });
      }
      alert(`Purchase Logged! Added ₹${cost} to ${purchase.vendor}'s ledger.`);
      setPurchase({ itemName: '', category: 'Medicine', brand: '', vendor: '', totalQuantity: '', unit: 'ml', totalCost: '', paymentStatus: 'Paid in Full' });
      setReceiptFile(null); fetchData();
    } catch (error) { alert("Error logging purchase."); } finally { setLoading(false); }
  };

  const handleLogVendorPayment = async (e) => {
    e.preventDefault(); setLoading(true);
    const proofFileName = paymentModal.proofFile ? paymentModal.proofFile.name : 'No proof attached';
    try {
      await addDoc(collection(db, "vendor_payments"), {
        vendor: paymentModal.vendor, amount: parseFloat(paymentModal.amount), date: paymentModal.date, 
        method: paymentModal.method, proof_file: proofFileName, notes: paymentModal.notes || 'Vendor Installment Payment', recorded_at: serverTimestamp()
      });
      alert(`Payment of ₹${paymentModal.amount} logged to ${paymentModal.vendor}.`);
      setPaymentModal({ show: false, vendor: '', amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0], notes: '', proofFile: null });
      fetchData();
    } catch (error) { alert("Error logging payment."); } finally { setLoading(false); }
  };

  const handleUpdateInventoryItem = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const qty = parseFloat(editingInventoryItem.total_quantity);
      const cost = parseFloat(editingInventoryItem.total_cost);
      const unitCost = (cost / qty).toFixed(2);
      await updateDoc(doc(db, "inventory", editingInventoryItem.id), {
        item_name: editingInventoryItem.item_name, brand: editingInventoryItem.brand, vendor: editingInventoryItem.vendor,
        total_quantity: qty, current_stock: parseFloat(editingInventoryItem.current_stock), unit: editingInventoryItem.unit,
        total_cost: cost, unit_cost: parseFloat(unitCost)
      });
      alert("Inventory item updated successfully.");
      setEditingInventoryItem(null); fetchData();
    } catch(e) { alert("Error updating item."); } finally { setLoading(false); }
  };

  const allVendorNames = [...new Set([...inventory.map(i => i.vendor), ...vendorPayments.map(p => p.vendor), ...vendors.map(v => v.name)])].filter(Boolean);
  const vendorLedger = allVendorNames.map(vName => {
    const regVendor = vendors.find(v => v.name === vName) || { legacyDebt: 0, category: 'Unregistered', phone: '--' };
    const legacy = parseFloat(regVendor.legacyDebt) || 0;
    const totalBilled = inventory.filter(i => i.vendor === vName).reduce((sum, i) => sum + (parseFloat(i.total_cost) || 0), 0);
    const totalPaid = vendorPayments.filter(p => p.vendor === vName).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    return { 
      id: regVendor.id, vendor: vName, category: regVendor.category, phone: regVendor.phone, 
      legacyDebt: legacy, totalBilled, totalPaid, outstandingDue: legacy + totalBilled - totalPaid, isRegistered: !!regVendor.id 
    };
  }).filter(v => (Number(v.outstandingDue) || 0) !== 0 || (Number(v.totalBilled) || 0) > 0 || (Number(v.totalPaid) || 0) > 0 || v.isRegistered).sort((a, b) => b.outstandingDue - a.outstandingDue);

  const handleAddEmployee = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const idProofName = newEmployee.idProof ? newEmployee.idProof.name : 'Not provided';
      await addDoc(collection(db, "employees"), { 
        ...newEmployee, idProof: idProofName, baseSalary: parseFloat(newEmployee.baseSalary) || 0, 
        totalBonus: 0, cumulativeMilkLiters: 0, cumulativeMilkValue: 0, registered_at: serverTimestamp() 
      });
      alert("Employee registered."); 
      setNewEmployee({ name: '', role: '', phone: '', aadhar: '', idProof: null, baseSalary: '', joinDate: new Date().toISOString().split('T')[0] }); 
      fetchData();
    } catch (error) { alert("Error registering employee."); } finally { setLoading(false); }
  };

  const handleLogTransaction = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const amount = parseFloat(transactionForm.amount) || 0; 
      const liters = parseFloat(transactionForm.liters) || 0;
      
      if (transactionForm.type === 'Salary_Revision') {
        const oldSalary = selectedEmployee.baseSalary || 0;
        const percentIncrease = oldSalary > 0 ? (((amount - oldSalary) / oldSalary) * 100).toFixed(1) : 100;
        await updateDoc(doc(db, "employees", selectedEmployee.id), { baseSalary: amount });
        await addDoc(collection(db, "employee_transactions"), { 
          emp_id: selectedEmployee.id, emp_name: selectedEmployee.name, type: 'Salary_Revision', amount: amount, liters: 0, date: transactionForm.date, 
          notes: `Increment of ${percentIncrease}%. Old: ₹${oldSalary} -> New: ₹${amount}. ${transactionForm.notes}`, recorded_at: serverTimestamp() 
        });
        alert(`Salary incremented by ${percentIncrease}%!`);
        setSelectedEmployee({ ...selectedEmployee, baseSalary: amount });
      } else {
        await addDoc(collection(db, "employee_transactions"), { 
          emp_id: selectedEmployee.id, emp_name: selectedEmployee.name, type: transactionForm.type, amount: amount, liters: liters, date: transactionForm.date, notes: transactionForm.notes, recorded_at: serverTimestamp() 
        });
        let updates = {};
        if (transactionForm.type === 'Bonus') updates.totalBonus = (selectedEmployee.totalBonus || 0) + amount;
        else if (transactionForm.type === 'Milk_Incentive') { 
          updates.cumulativeMilkLiters = (selectedEmployee.cumulativeMilkLiters || 0) + liters; 
          updates.cumulativeMilkValue = (selectedEmployee.cumulativeMilkValue || 0) + amount; 
        }
        if (Object.keys(updates).length > 0) { 
          await updateDoc(doc(db, "employees", selectedEmployee.id), updates); 
          setSelectedEmployee({ ...selectedEmployee, ...updates }); 
        }
        alert("Transaction successfully saved to employee ledger!");
      }

      // Free-Tier Push Notification Engine
      try {
        const empDocRef = doc(db, "employees", selectedEmployee.id);
        const empSnap = await getDoc(empDocRef);
        let pushToken = null;
        if (empSnap.exists()) { pushToken = empSnap.data().pushToken; }
        
        if (pushToken) {
          let title = "Ledger Updated";
          let body = `A new transaction was logged on your profile.`;

          if (transactionForm.type === "Milk_Incentive") {
            title = "Daily Milk Drop!";
            body = `You received ${liters}L of milk (Value: ₹${amount}).`;
          } else if (transactionForm.type === "Salary_Paid" || transactionForm.type === "Bonus") {
            title = "Payroll Processed";
            body = `An amount of ₹${amount} has been credited to your account.`;
          } else if (transactionForm.type === "Advance") {
            title = "Advance Issued";
            body = `A deduction of ₹${amount} was logged on your profile.`;
          } else if (transactionForm.type === "Salary_Earned") {
            title = "Salary Accrued";
            body = `Your monthly salary of ₹${amount} has been added to your ledger.`;
          } else if (transactionForm.type === "Advance_Repayment") {
            title = "Advance Repaid";
            body = `A cash repayment of ₹${amount} was successfully recorded.`;
          } else if (transactionForm.type === "Salary_Revision") {
            title = "Salary Revision";
            body = `Your base salary has been updated to ₹${amount}.`;
          }

          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Accept": "application/json", "Accept-encoding": "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ to: pushToken, sound: "default", title: title, body: body }),
          });
        }
      } catch (err) { console.log("Silent Notification Error:", err); }

      setTransactionForm({ type: 'Salary_Earned', amount: '', liters: '', date: new Date().toISOString().split('T')[0], notes: '' }); 
      fetchEmployeeTransactions(selectedEmployee.id); fetchData(); 
    } catch (error) { alert("Error saving transaction."); } finally { setLoading(false); }
  };

  const handleLogHistoricalData = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await addDoc(collection(db, "historical_finances"), { month: historyForm.month, year: parseInt(historyForm.year), revenue: parseFloat(historyForm.revenue) || 0, expenditure: parseFloat(historyForm.expenditure) || 0, recorded_at: serverTimestamp() });
      alert("Historical Data Saved."); setHistoryForm({ ...historyForm, revenue: '', expenditure: '' }); fetchData();
    } catch (error) { alert("Error saving history."); } finally { setLoading(false); }
  };

  const handleLogCapital = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await addDoc(collection(db, "capital_loans"), { 
        type: capitalForm.type, source: capitalForm.source, item: capitalForm.item, qty: capitalForm.qty,
        amount: parseFloat(capitalForm.amount) || 0, interestRate: parseFloat(capitalForm.interestRate) || 0, 
        date: capitalForm.date, recorded_at: serverTimestamp() 
      });
      alert(`${capitalForm.type} Successfully Logged.`); 
      setCapitalForm({ type: 'Infrastructure', source: '', item: '', qty: '', amount: '', interestRate: '', date: new Date().toISOString().split('T')[0] }); 
      fetchData();
    } catch (error) { alert("Error saving capital record."); } finally { setLoading(false); }
  };

  // --- AI CFO REPORT GENERATOR WITH FIX ---
  const handleCfoAnalysis = async () => {
    setIsCfoLoading(true);
    setCfoReport(null);
    try {
      const payload = {
        period: globalReportPeriod,
        revenue: allTimeRevenue,
        expenditure: allTimeTrueExpenditure,
        net_profit: netOperatingProfitAfterTax,
        total_vendor_debt: totalLegacyDebt + trueInventoryExpense - realCashPaidToVendors,
        labor_cost: totalEmployeeCost,
        operating_margin: operatingMargin,
        cost_benefit_ratio: costBenefitRatio
      };

      // BUG FIX: Injecting strict instructions to force INR/Rupee output
      const sysCtx = `You are NooRganicCFO, an expert agricultural Chief Financial Officer AI.
      Analyze the provided farm financial JSON data.
      1. Evaluate the operating margin and cost-benefit ratio.
      2. Identify any financial risks (e.g., high labor costs, vendor debt).
      3. Provide 3 concrete, actionable recommendations to improve profitability and cash flow.
      CRITICAL INSTRUCTION: All financial figures must be formatted in Indian Rupees (INR / ₹). Absolutely never use the dollar sign ($).
      Keep your response concise, professional, and directly actionable.`;

      const response = await askGemma(JSON.stringify(payload, null, 2), sysCtx);
      setCfoReport(response);
    } catch (e) {
      setCfoReport("Connection Error: Unable to reach the CFO AI Engine.");
    } finally {
      setIsCfoLoading(false);
    }
  };

  const currentMonthStr = new Date().toISOString().slice(0, 7); 
  const isCurrentMonth = (dateField, timestamp) => {
    if (dateField && dateField.startsWith(currentMonthStr)) return true;
    if (timestamp?.seconds) { return new Date(timestamp.seconds * 1000).toISOString().startsWith(currentMonthStr); }
    return false;
  };

  const filterByPeriod = (dataArray, dateField) => {
    if (globalReportPeriod === 'All-Time') return dataArray;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return dataArray.filter(item => {
      let dateStr = '';
      if (item[dateField]) dateStr = item[dateField];
      else if (item.recorded_at?.seconds) dateStr = new Date(item.recorded_at.seconds * 1000).toISOString();
      else if (item.timestamp?.seconds) dateStr = new Date(item.timestamp.seconds * 1000).toISOString();
      else if (item.year && item.month) {
        const monthIndex = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(item.month) + 1;
        dateStr = `${item.year}-${String(monthIndex).padStart(2, '0')}-01`;
      }
      
      if (!dateStr) return true;
      const d = new Date(dateStr);
      if (isNaN(d)) return true;

      switch (globalReportPeriod) {
        case 'This Week': {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          return d >= startOfWeek;
        }
        case 'This Month': return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        case 'Last Month': {
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
        }
        case 'This Quarter': {
          const currentQuarter = Math.floor(today.getMonth() / 3);
          const itemQuarter = Math.floor(d.getMonth() / 3);
          return currentQuarter === itemQuarter && d.getFullYear() === today.getFullYear();
        }
        case 'This Biannual': {
          const isFirstHalf = today.getMonth() < 6;
          const itemFirstHalf = d.getMonth() < 6;
          return isFirstHalf === itemFirstHalf && d.getFullYear() === today.getFullYear();
        }
        case 'This Year': return d.getFullYear() === today.getFullYear();
        case 'FY 25-26': return d >= new Date('2025-04-01') && d <= new Date('2026-03-31');
        case 'FY 24-25': return d >= new Date('2024-04-01') && d <= new Date('2025-03-31');
        default: return true;
      }
    });
  };

  const mtdMilkLiters = milkRecords.filter(m => (m.date || '').startsWith(currentMonthStr)).reduce((sum, m) => sum + (parseFloat(m.yield_liters) || 0), 0);
  const totalBaseSalaries = employees.reduce((acc, emp) => acc + (parseFloat(emp.baseSalary) || 0), 0);
  const currentDayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const mtdLaborCost = (totalBaseSalaries / daysInMonth) * currentDayOfMonth;

  const baseFeedCost = groupFeedLogs.filter(f => isCurrentMonth(null, f.recorded_at)).reduce((sum, f) => sum + (parseFloat(f.total_cost) || 0), 0);
  const topDressCost = topDressLogs.filter(f => isCurrentMonth(null, f.recorded_at)).reduce((sum, f) => sum + (parseFloat(f.cost_incurred) || 0), 0);
  const mtdFeedCost = baseFeedCost + topDressCost;
  
  const mtdMedsCost = medicalRecords.filter(m => isCurrentMonth(null, m.recorded_at)).reduce((sum, m) => sum + (parseFloat(m.cost_incurred) || 0), 0);
  const mtdUtilsCost = utilityLogs.filter(u => (u.date || '').startsWith(currentMonthStr)).reduce((sum, u) => sum + (parseFloat(u.amount) || 0), 0);

  const mtdTotalFarmCost = mtdLaborCost + mtdFeedCost + mtdMedsCost + mtdUtilsCost;
  const liveFarmCpl = mtdMilkLiters > 0 ? (mtdTotalFarmCost / mtdMilkLiters) : 0;
  const deliveryBudgetNum = parseFloat(transportBudget) || 0;
  const deliveryCplCalc = mtdMilkLiters > 0 ? (deliveryBudgetNum / mtdMilkLiters) : 0;
  const totalProductCpl = liveFarmCpl + deliveryCplCalc;

  const activeAnimalCount = livestock.filter(a => a.status !== 'Sold' && a.status !== 'Deceased').length || 1;
  const totalSharedOverhead = mtdLaborCost + mtdUtilsCost + baseFeedCost;
  const overheadPerAnimal = totalSharedOverhead / activeAnimalCount;
  const standardMilkPrice = parseFloat(milkSalePrice) || 60;

  const animalPnL = livestock.filter(a => a.status !== 'Sold' && a.status !== 'Deceased').map(animal => {
    const animalMilk = milkRecords.filter(m => m.cow_id === animal.tag && isCurrentMonth(m.date, null)).reduce((sum, m) => sum + (parseFloat(m.yield_liters) || 0), 0);
    const estimatedRevenue = animalMilk * standardMilkPrice;
    
    const animalMeds = medicalRecords.filter(m => m.cow_id === animal.tag && isCurrentMonth(m.date, null)).reduce((sum, m) => sum + (parseFloat(m.cost_incurred) || 0), 0);
    const animalTopDress = topDressLogs.filter(t => t.cow_id === animal.tag && isCurrentMonth(null, t.recorded_at)).reduce((sum, t) => sum + (parseFloat(t.cost_incurred) || 0), 0);
    
    const animalMilkFed = internalMilkLogs.filter(i => i.purpose === 'Calf Feeding' && i.notes?.includes(animal.tag) && isCurrentMonth(i.date, null)).reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0);
    const calfFeedCost = animalMilkFed * liveFarmCpl;

    const totalDirectCost = animalMeds + animalTopDress + calfFeedCost;
    const totalCost = totalDirectCost + overheadPerAnimal;
    const netProfit = estimatedRevenue - totalCost;

    return { 
      ...animal, animalMilk, estimatedRevenue, animalMeds, animalTopDress, 
      calfFeedCost, totalDirectCost, totalCost, netProfit, overheadPerAnimal 
    };
  });

  const performers = animalPnL.filter(a => a.stage === 'Lactating' && a.netProfit > 0).sort((a,b) => b.netProfit - a.netProfit);
  const bleeders = animalPnL.filter(a => a.stage === 'Lactating' && a.netProfit <= 0).sort((a,b) => a.netProfit - b.netProfit);
  const investments = animalPnL.filter(a => ['Dry', 'Heifer', 'Calf'].includes(a.stage)).sort((a,b) => a.netProfit - b.netProfit);

  const totalVapSalesRevenue = vapSales.reduce((acc, sale) => acc + (Number(sale.total_value) || 0), 0);
  const totalVapProductionCost = vapProductionLogs.reduce((acc, run) => acc + (Number(run.total_cost_incurred) || 0), 0);
  const vapGrossProfit = totalVapSalesRevenue - totalVapProductionCost;
  const currentVapInventoryValue = vapInventory.reduce((acc, item) => acc + ((Number(item.current_stock)||0) * (Number(item.selling_price)||0)), 0);

  const uniqueVapProducts = [...new Set(vapProductionLogs.map(r => r.recipe_name))];
  const vapProductPnL = uniqueVapProducts.map(productName => {
    const pSales = vapSales.filter(s => s.product_name === productName);
    const pRuns = vapProductionLogs.filter(r => r.recipe_name === productName);
    
    const rev = pSales.reduce((sum, s) => sum + (Number(s.total_value) || 0), 0);
    const cost = pRuns.reduce((sum, r) => sum + (Number(r.total_cost_incurred) || 0), 0);
    const qtyProduced = pRuns.reduce((sum, r) => sum + (Number(r.total_yield_produced) || 0), 0);
    const qtySold = pSales.reduce((sum, s) => sum + (Number(s.qty) || 0), 0);
    
    return { name: productName, revenue: rev, cost: cost, profit: rev - cost, qtyProduced, qtySold };
  }).sort((a, b) => b.profit - a.profit);

  const fHist = filterByPeriod(historicalData, 'date');
  const fCap = filterByPeriod(capitalData, 'date');
  const fInv = filterByPeriod(inventory, 'timestamp');
  const fVendPay = filterByPeriod(vendorPayments, 'date');
  const fSpoil = filterByPeriod(spoilageLogs, 'date');
  const fInvoices = filterByPeriod(invoices, 'date');
  const fRevLogs = filterByPeriod(revenueLogs, 'date');
  const fEmpTx = filterByPeriod(employeeTransactions, 'date');
  const fVapSales = filterByPeriod(vapSales, 'date');
  const fVapProd = filterByPeriod(vapProductionLogs, 'date');

  const totalHistoricalRev = fHist.reduce((acc, curr) => acc + (parseFloat(curr.revenue) || 0), 0);
  const totalHistoricalExp = fHist.reduce((acc, curr) => acc + (parseFloat(curr.expenditure) || 0), 0);
  const totalInvestorCapital = fCap.filter(c => c.type === 'Investor' || c.type === 'Capital').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0); 
  const totalLoans = fCap.filter(c => c.type === 'Loan').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const totalSubsidies = fCap.filter(c => c.type === 'Subsidy').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const totalInfrastructureExp = fCap.filter(c => c.type === 'Infrastructure').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const totalEmployeeCost = fEmpTx.filter(t => ['Salary_Earned', 'Bonus', 'Milk_Incentive'].includes(t.type)).reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0); 

  const trueInventoryExpense = fInv.reduce((acc, item) => acc + (parseFloat(item.total_cost) || 0), 0); 
  const realCashPaidToVendors = fVendPay.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0); 
  const totalLegacyDebt = vendors.reduce((sum, v) => sum + (parseFloat(v.legacyDebt) || 0), 0);
  const totalSpoilageLoss = fSpoil.reduce((acc, item) => acc + (parseFloat(item.financialLoss) || 0), 0);
  
  const currentTaxRate = parseFloat(vapTaxRate) || 0;
  const totalInvoiceRevenue = fInvoices.filter(i => !(i.type||'').includes('VAP')).reduce((acc, inv) => acc + (parseFloat(inv.amount) || 0), 0);
  const totalAssetRevenue = fRevLogs.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  
  const dynVapSalesRev = fVapSales.reduce((acc, sale) => acc + (Number(sale.total_value) || 0), 0);
  const dynVapProdCost = fVapProd.reduce((acc, run) => acc + (Number(run.total_cost_incurred) || 0), 0);

  const taxExemptAgriIncome = (globalReportPeriod === 'All-Time' ? 715000 : 0) + totalHistoricalRev + totalInvoiceRevenue + totalAssetRevenue;
  const taxableVapIncome = dynVapSalesRev;
  const estimatedTaxLiability = taxableVapIncome * (currentTaxRate / 100);

  const allTimeRevenue = taxExemptAgriIncome + taxableVapIncome;
  const allTimeTrueExpenditure = totalHistoricalExp + trueInventoryExpense + totalEmployeeCost + dynVapProdCost;
  
  const netOperatingProfitBeforeTax = allTimeRevenue - allTimeTrueExpenditure - totalSpoilageLoss;
  const netOperatingProfitAfterTax = netOperatingProfitBeforeTax - estimatedTaxLiability;
  
  const absoluteNetWorth = netOperatingProfitAfterTax + totalSubsidies + totalInvestorCapital + totalInfrastructureExp - totalLoans + currentVapInventoryValue; 

  const costBenefitRatio = allTimeTrueExpenditure > 0 ? (allTimeRevenue / allTimeTrueExpenditure).toFixed(2) : 0;
  const operatingMargin = allTimeRevenue > 0 ? ((netOperatingProfitAfterTax / allTimeRevenue) * 100).toFixed(1) : 0;
  const estIRR = totalInvestorCapital > 0 ? ((netOperatingProfitAfterTax / totalInvestorCapital) * 100).toFixed(1) : 0;

  const categoryBreakdown = fInv.reduce((acc, item) => {
    const cat = item.category || 'Uncategorized';
    acc[cat] = (acc[cat] || 0) + (parseFloat(item.total_cost) || 0);
    return acc;
  }, {});
  const categoryData = Object.entries(categoryBreakdown).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const itemBreakdown = fInv.reduce((acc, item) => {
    const name = item.item_name || 'Unknown Item';
    if (!acc[name]) acc[name] = { qty: 0, cost: 0, unit: item.unit || '' };
    acc[name].qty += (parseFloat(item.total_quantity) || 0);
    acc[name].cost += (parseFloat(item.total_cost) || 0);
    return acc;
  }, {});
  const itemData = Object.entries(itemBreakdown).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.cost - a.cost);

  const vendorBreakdown = fInv.reduce((acc, item) => {
    const v = item.vendor || 'Unknown Vendor';
    if (!acc[v]) acc[v] = { billed: 0, paid: 0 };
    acc[v].billed += (parseFloat(item.total_cost) || 0);
    return acc;
  }, {});
  fVendPay.forEach(p => {
    const v = p.vendor || 'Unknown Vendor';
    if (!vendorBreakdown[v]) vendorBreakdown[v] = { billed: 0, paid: 0 };
    vendorBreakdown[v].paid += (parseFloat(p.amount) || 0);
  });
  const vendorData = Object.entries(vendorBreakdown).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.billed - a.billed);

  const milkSalesValue = fInvoices.filter(i => (i.type || '').includes('Milk')).reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0) + (globalReportPeriod === 'All-Time' ? 320000 : 0);
  const b2bSalesValue = fInvoices.filter(i => !(i.type || '').includes('Milk')).reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0) + (globalReportPeriod === 'All-Time' ? 25000 : 0);
  
  const revenueCategoryData = [
    { name: 'Raw Milk Sales', value: milkSalesValue, color: '#3b82f6' }, 
    { name: 'VAP Products', value: dynVapSalesRev, color: '#8b5cf6' },
    { name: 'Livestock Sold', value: totalAssetRevenue + (globalReportPeriod === 'All-Time' ? 85000 : 0), color: '#10b981' },
    { name: 'Other B2B', value: b2bSalesValue, color: '#64748b' } 
  ];

  if (printingItr) {
    return (
      <div className="bg-slate-100 min-h-screen p-10 print:p-0 absolute inset-0 z-[100]">
        <div className="print:hidden max-w-4xl mx-auto mb-6 flex justify-end gap-4">
          <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded flex items-center gap-2 shadow transition"><Printer size={18}/> Print / Save PDF</button>
          <button onClick={() => setPrintingItr(false)} className="bg-white text-slate-700 border border-slate-300 font-bold py-2 px-6 rounded shadow hover:bg-slate-50 transition">Close</button>
        </div>
        <div className="max-w-4xl mx-auto bg-white p-16 shadow-2xl print:shadow-none print:p-0 w-full min-h-[1122px] relative">
          <div className="text-center mb-10 border-b-4 border-slate-900 pb-8">
            <div className="flex justify-center mb-4">
              {farmDetails.logoData ? (
                 <img src={farmDetails.logoData} alt="Logo" className="w-24 h-24 object-contain rounded" />
              ) : (
                 <div className="w-24 h-24 bg-slate-100 border-2 border-dashed border-slate-300 text-slate-400 font-bold flex items-center justify-center text-xs text-center p-2 rounded">LOGO</div>
              )}
            </div>
            <h1 className="text-4xl font-black uppercase tracking-widest text-slate-900">{farmDetails.name}</h1>
            <p className="text-sm font-bold text-slate-600 mt-2">{farmDetails.address}</p>
            <p className="text-sm font-bold text-slate-600">GSTIN: {farmDetails.gstin}</p>
            <div className="mt-6 inline-block bg-slate-100 px-6 py-2 rounded-full border border-slate-300">
               <h2 className="text-lg font-bold text-slate-800 tracking-wider">Official Balance Sheet & Income Summary (FY {itrYear})</h2>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-12 mb-10">
            <div>
              <h3 className="font-black text-xl border-b-2 border-slate-300 mb-4 pb-2 text-slate-800">INCOME STREAMS</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium text-slate-700"><span>Agricultural Income (Exempt)</span><span>₹ {(Number(taxExemptAgriIncome)||0).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm font-medium text-slate-700"><span>Processed Goods (VAP)</span><span>₹ {(Number(taxableVapIncome)||0).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm font-medium text-slate-700"><span>Govt. Subsidies / Grants</span><span>₹ {(Number(totalSubsidies)||0).toLocaleString()}</span></div>
                <div className="flex justify-between text-lg font-black mt-4 pt-3 border-t-2 border-slate-800 text-emerald-800"><span>TOTAL GROSS REVENUE</span><span>₹ {(Number(allTimeRevenue + totalSubsidies)||0).toLocaleString()}</span></div>
              </div>
            </div>
            <div>
              <h3 className="font-black text-xl border-b-2 border-slate-300 mb-4 pb-2 text-slate-800">EXPENDITURES</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium text-slate-700"><span>Feed & Inventory Assets</span><span>₹ {(Number(trueInventoryExpense)||0).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm font-medium text-slate-700"><span>Labor & Employee Salaries</span><span>₹ {(Number(totalEmployeeCost)||0).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm font-medium text-slate-700"><span>Manufacturing / Processing COGS</span><span>₹ {(Number(dynVapProdCost)||0).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm font-medium text-slate-700"><span>Written-off Spoilage/Loss</span><span>₹ {(Number(totalSpoilageLoss)||0).toLocaleString()}</span></div>
                <div className="flex justify-between text-lg font-black mt-4 pt-3 border-t-2 border-slate-800 text-rose-800"><span>TOTAL EXPENSES</span><span>₹ {(Number(allTimeTrueExpenditure)||0).toLocaleString()}</span></div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border-2 border-slate-800 p-8 mb-8 flex items-center justify-between">
             <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Gross Operating Profit</p>
                <p className="text-4xl font-black text-slate-900">₹ {(Number(netOperatingProfitBeforeTax)||0).toLocaleString()}</p>
             </div>
             <div className="text-right border-l-2 border-slate-300 pl-8">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Est. Tax / GST Liability (@{currentTaxRate}%)</p>
                <p className="text-2xl font-black text-rose-600">- ₹ {(Number(estimatedTaxLiability)||0).toLocaleString()}</p>
                <p className="text-[10px] text-slate-400 mt-1">Applied strictly to processed VAP income.</p>
             </div>
          </div>

          <div className="flex justify-between items-center bg-slate-900 text-white p-6 mb-12">
             <h2 className="text-xl font-bold uppercase tracking-widest">Final Net Profit After Tax</h2>
             <p className="text-4xl font-black text-emerald-400">₹ {(Number(netOperatingProfitAfterTax)||0).toLocaleString()}</p>
          </div>

          <div className="text-center text-xs font-bold text-slate-500 border-t border-slate-300 pt-6">
             <p className="mb-2 uppercase tracking-widest text-slate-800">C.A. / Audit Declaration</p>
             <p>This balance sheet accurately segments agricultural income from commercial value-added processing.</p>
             <p>All income derived from basic livestock rearing is exempt from Income Tax under Section 10(1) of the Income Tax Act, 1961.</p>
          </div>
        </div>
      </div>
    )
  }

  if (selectedEmployee) {
    const empEarned = employeeTransactions.filter(t => ['Salary_Earned', 'Bonus'].includes(t.type || '')).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const empMilkValue = employeeTransactions.filter(t => t.type === 'Milk_Incentive').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const cumulativeCTC = empEarned + empMilkValue;

    const empSalaryPaid = employeeTransactions.filter(t => t.type === 'Salary_Paid').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const empAdvancesTaken = employeeTransactions.filter(t => t.type === 'Advance').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const empAdvancesRepaidCash = employeeTransactions.filter(t => t.type === 'Advance_Repayment').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const activeLoanBalance = empAdvancesTaken - empAdvancesRepaidCash;
    const empSavingsBalance = empEarned - empSalaryPaid - activeLoanBalance;

    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-300">

        <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-6">
            <button onClick={() => {setSelectedEmployee(null); setShowIdCard(false);}} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition font-medium"><ArrowLeft size={20} /> Back</button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-3">
              <UserCircle size={36} className="text-slate-300" />
              <div><h1 className="text-2xl font-black text-slate-800">{selectedEmployee.name || 'Unnamed Staff'}</h1><p className="text-sm text-slate-500 font-medium mt-1">{selectedEmployee.role || 'Unassigned'} • {selectedEmployee.phone || 'No Phone'}</p></div>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <button onClick={() => setShowIdCard(!showIdCard)} className="text-blue-600 border border-blue-200 bg-blue-50 px-4 py-2 rounded-lg font-bold hover:bg-blue-100 flex items-center gap-2 text-sm"><IdCard size={18}/> {showIdCard ? 'Close ID Editor' : 'Generate ID Card'}</button>
            <div className="text-right pl-4 border-l border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Base Salary</p>
              <p className="text-2xl font-black text-blue-600">₹{(parseFloat(selectedEmployee.baseSalary) || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-purple-50 border border-purple-200 p-5 rounded-xl shadow-sm">
            <p className="text-xs font-bold text-purple-800 uppercase">Cumulative CTC</p>
            <p className="text-2xl font-black text-purple-700 mt-1">₹{(Number(cumulativeCTC)||0).toLocaleString()}</p>
            <p className="text-[10px] font-bold text-purple-600 mt-1">Total Salaries + Bonuses + Milk</p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl shadow-sm">
            <p className="text-xs font-bold text-emerald-800 uppercase">Total Cash Paid Out</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">₹{(Number(empSalaryPaid)||0).toLocaleString()}</p>
            <p className="text-[10px] font-bold text-emerald-600 mt-1">Direct Salary Withdrawals</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl shadow-sm">
            <p className="text-xs font-bold text-amber-800 uppercase">Active Loan / Advance</p>
            <p className="text-2xl font-black text-amber-700 mt-1">₹{(Number(activeLoanBalance)||0).toLocaleString()}</p>
            <p className="text-[10px] font-bold text-amber-600 mt-1">Interest-Free Debt Owed to Farm</p>
          </div>

          <div className="bg-slate-900 p-5 rounded-xl shadow-sm relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-xs font-bold text-slate-300 uppercase">Net Retained Savings</p>
              <p className={`text-3xl font-black mt-1 ${empSavingsBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{Math.abs(Number(empSavingsBalance)||0).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">{empSavingsBalance >= 0 ? 'Money saved securely with farm.' : 'Warning: Staff owes the farm.'}</p>
            </div>
            <Landmark size={80} className="absolute -right-4 -bottom-4 text-slate-800 opacity-50 z-0"/>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><PackagePlus className="text-blue-600" size={20} /> Log Transaction</h2>
            <form onSubmit={handleLogTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">TRANSACTION TYPE</label>
                <select value={transactionForm.type} onChange={(e)=>setTransactionForm({...transactionForm, type: e.target.value})} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold">
                  <optgroup label="Credits (Adds to Savings)">
                    <option value="Salary_Earned">Log Salary Earned (Monthly)</option>
                    <option value="Bonus">Award Performance Bonus</option>
                  </optgroup>
                  <optgroup label="Debits (Reduces Savings)">
                    <option value="Salary_Paid">Pay Out Cash / Salary</option>
                  </optgroup>
                  <optgroup label="Loans & Advances (Interest Free)">
                    <option value="Advance">Give Advance / Loan (Cash)</option>
                    <option value="Advance_Repayment">Staff Returned Advance (Cash)</option>
                  </optgroup>
                  <optgroup label="Perks & Admin">
                    <option value="Milk_Incentive">Log Free Milk (CTC Info Only)</option>
                    <option value="Salary_Revision">Promote / Increment Salary</option>
                  </optgroup>
                </select>
              </div>

              {transactionForm.type === 'Advance' && (
                 <div className="bg-amber-50 p-2 rounded border border-amber-200 text-[10px] text-amber-800 font-bold">
                    Note: To recover this loan from their salary later, just log their monthly "Salary Earned". The system will auto-offset their debt.
                 </div>
              )}
              {transactionForm.type === 'Advance_Repayment' && (
                 <div className="bg-emerald-50 p-2 rounded border border-emerald-200 text-[10px] text-emerald-800 font-bold">
                    Note: Only use this if the staff member physically hands cash back to you to clear a loan early.
                 </div>
              )}

              {transactionForm.type === 'Milk_Incentive' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-blue-600 mb-1">MILK (Liters)</label><input type="number" step="0.1" required value={transactionForm.liters} onChange={(e)=>setTransactionForm({...transactionForm, liters: e.target.value})} className="w-full p-2 border border-blue-200 bg-blue-50 rounded outline-none" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">CTC VALUE (₹)</label><input type="number" required value={transactionForm.amount} onChange={(e)=>setTransactionForm({...transactionForm, amount: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none" /></div>
                </div>
              ) : transactionForm.type === 'Salary_Revision' ? (
                <div><label className="block text-xs font-bold text-purple-600 mb-1">NEW BASE MONTHLY SALARY (₹)</label><input type="number" required value={transactionForm.amount} onChange={(e)=>setTransactionForm({...transactionForm, amount: e.target.value})} className="w-full p-2 border border-purple-300 bg-purple-50 rounded outline-none text-lg font-bold" placeholder="e.g. 15000" /></div>
              ) : (
                <div><label className="block text-xs font-bold text-slate-500 mb-1">AMOUNT (₹)</label><input type="number" required value={transactionForm.amount} onChange={(e)=>setTransactionForm({...transactionForm, amount: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none text-lg font-bold" /></div>
              )}

              <div><label className="block text-xs font-bold text-slate-500 mb-1">TRANSACTION DATE</label><input type="date" required value={transactionForm.date} onChange={(e)=>setTransactionForm({...transactionForm, date: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">NOTES / REASON</label><input type="text" value={transactionForm.notes} onChange={(e)=>setTransactionForm({...transactionForm, notes: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none" placeholder="Details..." /></div>

              <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition disabled:bg-slate-400">
                 {loading ? 'Saving...' : transactionForm.type === 'Salary_Revision' ? 'Execute Increment' : 'Save to Ledger'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><History className="text-blue-600" size={20} /> Official Transaction History</h2>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                    <th className="py-3 px-4 font-bold">Date</th><th className="py-3 px-4 font-bold">Type</th><th className="py-3 px-4 font-bold">Details</th><th className="py-3 px-4 font-bold text-right">Value (₹)</th><th className="py-3 px-4 text-right">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {employeeTransactions.length > 0 ? employeeTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-700">{String(tx.date || 'N/A')}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-widest font-bold border ${
                          ['Salary_Earned', 'Bonus', 'Advance_Repayment'].includes(tx.type || '') ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          tx.type === 'Milk_Incentive' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          ['Salary_Paid', 'Advance'].includes(tx.type || '') ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          tx.type === 'Salary_Revision' ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}>{(tx.type || '').replace('_', ' ')}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {tx.type === 'Salary_Revision' && <IncrementIcon size={12} className="inline text-emerald-500 mr-1"/>}
                        {tx.type === 'Milk_Incentive' && <span className="font-bold text-blue-600">{tx.liters}L given. </span>}
                        {tx.notes || '--'}
                      </td>
                      <td className={`py-3 px-4 text-right font-black ${
                          ['Salary_Earned', 'Bonus', 'Advance_Repayment'].includes(tx.type || '') ? 'text-emerald-600' :
                          ['Salary_Paid', 'Advance'].includes(tx.type || '') ? 'text-amber-600' :
                          tx.type === 'Salary_Revision' ? 'text-purple-600' : 'text-slate-800'
                      }`}>
                        {['Salary_Paid', 'Advance'].includes(tx.type || '') ? '-' : '+'}₹{(parseFloat(tx.amount) || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right"><button onClick={()=>handleDeleteRecord('employee_transactions', tx.id)} className="text-red-400 hover:text-red-600 p-1 align-middle"><Trash2 size={16}/></button></td>
                    </tr>
                  )) : <tr><td colSpan="5" className="py-8 text-center text-slate-400 font-medium">No transactions recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      <datalist id="brand-options">{uniqueBrands.map(b => <option key={b} value={b} />)}</datalist>
      <datalist id="vendor-options">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
      <datalist id="role-options">{uniqueRoles.map(r => <option key={r} value={r} />)}</datalist>

      {paymentModal.show && !paymentModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Banknote size={18}/> Log Payment to Vendor</h3>
              <button onClick={() => setPaymentModal({show: false, vendor: '', amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0], notes: '', proofFile: null})} className="hover:text-blue-200"><X size={20}/></button>
            </div>
            <form onSubmit={handleLogVendorPayment} className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Paying Vendor:</p>
                <p className="text-lg font-black text-slate-800">{paymentModal.vendor}</p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-blue-700 mb-1">AMOUNT PAID (REAL CASH) (₹)</label>
                <input type="number" step="any" required value={paymentModal.amount} onChange={(e) => setPaymentModal({...paymentModal, amount: e.target.value})} className="w-full text-xl font-black p-3 border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 text-blue-900" placeholder="0.00" />
                <p className="text-[10px] text-slate-400 mt-1">To log a partial payment, simply delete the auto-filled amount and type the exact cash paid.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">PAYMENT METHOD</label>
                    <select value={paymentModal.method} onChange={(e) => setPaymentModal({...paymentModal, method: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none bg-white font-bold text-slate-700">
                      <option value="Cash">Cash (Physical)</option>
                      <option value="Online Transfer">Online / App Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">DATE PAID</label>
                    <input type="date" required value={paymentModal.date} onChange={(e) => setPaymentModal({...paymentModal, date: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold text-slate-700" />
                 </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">PAYMENT PROOF (Cheque / Screenshot)</label>
                <div className="p-2 border border-dashed border-slate-300 rounded-lg bg-slate-50">
                  <input type="file" accept="image/*,.pdf" onChange={(e) => setPaymentModal({...paymentModal, proofFile: e.target.files[0] || null})} className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">NOTES</label>
                <input type="text" value={paymentModal.notes} onChange={(e) => setPaymentModal({...paymentModal, notes: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none" placeholder="e.g. Check #12345..." />
              </div>
              <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg transition mt-2 disabled:bg-slate-400">
                {loading ? 'Processing...' : 'Confirm & Log Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {stockAdjustModal.show && stockAdjustModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><ArrowRightLeft size={18}/> Audit Inventory Stock</h3>
              <button onClick={() => setStockAdjustModal({show: false, item: null, amount: '', type: 'Add', notes: ''})} className="hover:text-emerald-200"><X size={20}/></button>
            </div>
            <form onSubmit={handleStockAdjustment} className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Item Audited</p>
                <p className="text-lg font-black text-slate-800">{stockAdjustModal.item.item_name}</p>
                <p className="text-sm font-bold text-emerald-600 mt-1">Current System Stock: {stockAdjustModal.item.current_stock} {stockAdjustModal.item.unit}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ACTION</label>
                  <select value={stockAdjustModal.type} onChange={(e) => setStockAdjustModal({...stockAdjustModal, type: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold text-slate-700">
                    <option value="Add">Add to Stock (Found)</option>
                    <option value="Remove">Remove (Lost/Spoiled)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">AMOUNT / QTY</label>
                  <input type="number" step="any" required value={stockAdjustModal.amount} onChange={(e) => setStockAdjustModal({...stockAdjustModal, amount: e.target.value})} className="w-full p-2 text-lg font-black border border-slate-300 rounded outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0.0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">REASON FOR AUDIT</label>
                <input type="text" required value={stockAdjustModal.notes} onChange={(e) => setStockAdjustModal({...stockAdjustModal, notes: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none text-sm" placeholder="e.g. Physical recount was lower" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg shadow-lg mt-2 disabled:bg-slate-400">
                {loading ? 'Committing...' : 'Commit Audit Change'}
              </button>
            </form>
          </div>
        </div>
      )}

      {capitalAdjustModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><ArrowRightLeft size={18}/> Master Capital Reconciliation</h3>
              <button onClick={() => setCapitalAdjustModal({show: false, amount: '', type: 'Deposit', notes: ''})} className="hover:text-emerald-200"><X size={20}/></button>
            </div>
            <form onSubmit={handleCapitalAdjustment} className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Adjusting Farm Net Worth</p>
                <p className="text-sm font-bold text-emerald-800 mt-1">This will directly inject or deduct from the Master Balance Sheet under 'Owner Capital'. Use this to correct historical bank offsets.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ADJUSTMENT TYPE</label>
                  <select value={capitalAdjustModal.type} onChange={(e) => setCapitalAdjustModal({...capitalAdjustModal, type: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold text-slate-700">
                    <option value="Deposit">Add Capital (Deposit)</option>
                    <option value="Withdrawal">Remove Capital (Withdrawal)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">AMOUNT (₹)</label>
                  <input type="number" step="any" required value={capitalAdjustModal.amount} onChange={(e) => setCapitalAdjustModal({...capitalAdjustModal, amount: e.target.value})} className="w-full p-2 text-lg font-black border border-slate-300 rounded outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0.0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">REASON FOR RECONCILIATION</label>
                <input type="text" required value={capitalAdjustModal.notes} onChange={(e) => setCapitalAdjustModal({...capitalAdjustModal, notes: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none text-sm" placeholder="e.g. Correcting missing cash deposit from 2024" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg shadow-lg mt-2 disabled:bg-slate-400">
                {loading ? 'Reconciling...' : 'Apply Capital Adjustment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {yieldAdjustModal.show && yieldAdjustModal.cow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><ArrowRightLeft size={18}/> Correct Cow Lifetime Yield</h3>
              <button onClick={() => setYieldAdjustModal({show: false, cow: null, amount: '', type: 'Subtract', notes: ''})} className="hover:text-blue-200"><X size={20}/></button>
            </div>
            <form onSubmit={handleYieldAdjustment} className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Animal Target</p>
                <p className="text-lg font-black text-slate-800">Tag {yieldAdjustModal.cow.tag || yieldAdjustModal.cow.id} {yieldAdjustModal.cow.name ? `(${yieldAdjustModal.cow.name})` : ''}</p>
                <p className="text-[10px] text-blue-700 mt-1">Note: This safely injects an adjustment record into the milk ledger to preserve chronological accuracy.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">CORRECTION ACTION</label>
                  <select value={yieldAdjustModal.type} onChange={(e) => setYieldAdjustModal({...yieldAdjustModal, type: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold text-slate-700">
                    <option value="Subtract">Subtract Yield (Was Over-reported)</option>
                    <option value="Add">Add Yield (Was Under-reported)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">AMOUNT TO FIX (L)</label>
                  <input type="number" step="any" required value={yieldAdjustModal.amount} onChange={(e) => setYieldAdjustModal({...yieldAdjustModal, amount: e.target.value})} className="w-full p-2 text-lg font-black border border-slate-300 rounded outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">REASON / NOTES</label>
                <input type="text" required value={yieldAdjustModal.notes} onChange={(e) => setYieldAdjustModal({...yieldAdjustModal, notes: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none text-sm" placeholder="e.g. Milker typed 15 instead of 1.5" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg shadow-lg mt-2 disabled:bg-slate-400">
                {loading ? 'Correcting Ledger...' : 'Apply Yield Correction'}
              </button>
            </form>
          </div>
        </div>
      )}


      {/* HEADER & NAVIGATION */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="text-emerald-600 w-8 h-8" />
          <div><h1 className="text-xl font-bold text-slate-800">Economics & Costing</h1><p className="text-sm text-slate-500">Live production costs, item analytics, and true animal P&L.</p></div>
        </div>
        <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
          <button onClick={() => setActiveTab('costing')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'costing' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Live Costing Engine</button>
          <button onClick={() => setActiveTab('processing_pnl')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'processing_pnl' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Processing P&L</button>
          <button onClick={() => setActiveTab('animal_pnl')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'animal_pnl' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Animal P&L</button>
          <button onClick={() => setActiveTab('reports')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'reports' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Deep Analytics & Balance Sheet</button>
          <button onClick={() => setActiveTab('inventory')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'inventory' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Accounts Payable</button>
          <button onClick={() => setActiveTab('invoices')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'invoices' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Invoicing & ITR</button>
          <button onClick={() => setActiveTab('employees')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'employees' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Employee Ledger</button>
          <button onClick={() => setActiveTab('legacy')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'legacy' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Capital & Infra</button>
        </div>
      </div>

      {activeTab === 'costing' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Calculator className="text-blue-600"/> True Production Cost</h2>
              <div className="flex-1 space-y-3">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Prorated Staff Labor (MTD)</span><span className="font-bold text-slate-700">₹{(Number(mtdLaborCost)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Feed & Ration Logged</span><span className="font-bold text-slate-700">₹{(Number(mtdFeedCost)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Meds & Vaccines Used</span><span className="font-bold text-slate-700">₹{(Number(mtdMedsCost)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Utilities / Bills (MTD)</span><span className="font-bold text-slate-700">₹{(Number(mtdUtilsCost)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
                <div className="border-t border-slate-200 pt-3 flex justify-between text-sm font-bold"><span className="text-slate-800">Total Operational Cost</span><span className="text-blue-700">₹{(Number(mtdTotalFarmCost)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
                <div className="flex justify-between text-sm font-bold"><span className="text-slate-800">Total Yield (Liters)</span><span className="text-blue-700">{(Number(mtdMilkLiters)||0).toLocaleString(undefined, {maximumFractionDigits:1})} L</span></div>
              </div>
              <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200 text-center">
                <p className="text-xs font-bold text-blue-800 uppercase tracking-widest">Farm Cost Per Liter (CPL)</p>
                <p className="text-3xl font-black text-blue-700 mt-1">₹{(Number(liveFarmCpl)||0).toFixed(2)}</p>
                <p className="text-[10px] text-blue-600 mt-1">Cost to produce milk before it leaves the gate.</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Truck className="text-indigo-600"/> Transport & Logistics Cost</h2>
              <div className="flex-1 space-y-4">
                <div className="bg-slate-50 p-4 rounded border border-slate-200">
                  <label className="block text-xs font-bold text-slate-500 mb-2">EST. MONTHLY TRANSPORT BUDGET (₹)</label>
                  <input type="number" value={transportBudget} onChange={(e) => setTransportBudget(e.target.value)} className="w-full p-2 border rounded outline-none font-bold text-slate-800 mb-2" placeholder="e.g. 15000" />
                  
                  <label className="block text-xs font-bold text-emerald-600 mb-2 mt-4">STANDARD MILK SALE PRICE (₹/L)</label>
                  <input type="number" value={milkSalePrice} onChange={(e) => setMilkSalePrice(e.target.value)} className="w-full p-2 border border-emerald-300 rounded outline-none font-bold text-emerald-800 bg-emerald-50 mb-2" placeholder="e.g. 60" />
                  <p className="text-[10px] text-slate-400">Used for animal revenue estimation.</p>
                  
                  <button onClick={handleSaveTransportBudget} className="w-full mt-2 bg-indigo-600 text-white px-4 py-2 rounded font-bold hover:bg-indigo-700 transition">Save Parameters</button>
                </div>
              </div>
              <div className="mt-4 bg-indigo-50 p-4 rounded-lg border border-indigo-200 text-center">
                <p className="text-xs font-bold text-indigo-800 uppercase tracking-widest">Delivery Cost Per Liter</p>
                <p className="text-3xl font-black text-indigo-700 mt-1">₹{(Number(deliveryCplCalc)||0).toFixed(2)}</p>
                <p className="text-[10px] text-indigo-600 mt-1">Cost to transport 1L of milk to the consumer.</p>
              </div>
            </div>

            <div className="space-y-6 flex flex-col">
              <div className="bg-emerald-900 p-6 rounded-xl shadow-lg text-white flex-1 flex flex-col justify-center items-center text-center border border-emerald-800">
                <h2 className="text-sm font-bold text-emerald-300 uppercase tracking-widest mb-2"><CheckCircle size={16} className="inline mr-1"/> Final Product CPL</h2>
                <div className="flex items-end justify-center gap-1 mb-2">
                  <span className="text-5xl font-black text-white">₹{(Number(totalProductCpl)||0).toFixed(2)}</span>
                  <span className="text-emerald-400 font-bold mb-1">/ Liter</span>
                </div>
                <p className="text-xs text-emerald-300">Total cost to produce and deliver your milk.</p>
                <div className="w-full h-px bg-emerald-800 my-4"></div>
                <div className="w-full flex justify-between text-sm font-bold text-emerald-100">
                  <span>Farm: ₹{(Number(liveFarmCpl)||0).toFixed(2)}</span>
                  <span>+</span>
                  <span>Delivery: ₹{(Number(deliveryCplCalc)||0).toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Zap size={16} className="text-amber-500"/> Log Utility Bill</h3>
                <form onSubmit={handleLogUtility} className="space-y-3">
                  <div className="flex gap-2">
                    <select value={utilityForm.category} onChange={(e)=>setUtilityForm({...utilityForm, category: e.target.value})} className="w-1/2 p-2 border rounded text-xs outline-none">
                      <option>Electricity</option><option>Water</option><option>Farm Fuel (Gen/Tractor)</option><option>Maintenance</option>
                    </select>
                    <input type="number" required value={utilityForm.amount} onChange={(e)=>setUtilityForm({...utilityForm, amount: e.target.value})} className="w-1/2 p-2 border rounded text-xs outline-none font-bold" placeholder="Amount (₹)" />
                  </div>
                  <div className="flex gap-2">
                    <input type="date" required value={utilityForm.date} onChange={(e)=>setUtilityForm({...utilityForm, date: e.target.value})} className="w-1/2 p-2 border rounded text-xs outline-none" />
                    <input type="text" value={utilityForm.notes} onChange={(e)=>setUtilityForm({...utilityForm, notes: e.target.value})} className="w-1/2 p-2 border rounded text-xs outline-none" placeholder="Notes..." />
                  </div>
                  <button disabled={loading} className="w-full bg-amber-500 text-slate-900 py-2 rounded font-bold hover:bg-amber-400 transition text-xs disabled:bg-slate-400">{loading ? 'Saving...' : 'Add to MTD Expenses'}</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROCESSING P&L */}
      {activeTab === 'processing_pnl' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl text-white flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black flex items-center gap-2"><Factory className="text-emerald-400" /> Factory Floor: VAP Processing P&L</h2>
              <p className="text-sm text-slate-400 mt-1">Total revenue generated from Value-Added Products minus the cost of raw milk, ingredients, utility, and labor.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl shadow-sm text-center">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">Total VAP Sales</p>
              <p className="text-3xl font-black text-blue-900">₹{(Number(dynVapSalesRev)||0).toLocaleString()}</p>
              <p className="text-[10px] text-blue-600 mt-1">Gross Revenue from Processing</p>
            </div>
            <div className="bg-rose-50 border border-rose-200 p-6 rounded-xl shadow-sm text-center">
              <p className="text-xs font-bold text-rose-700 uppercase tracking-widest mb-1">Total VAP COGS</p>
              <p className="text-3xl font-black text-rose-900">₹{(Number(dynVapProdCost)||0).toLocaleString()}</p>
              <p className="text-[10px] text-rose-600 mt-1">Cost of Goods Manufactured</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl shadow-sm text-center">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1">VAP Gross Profit</p>
              <p className="text-3xl font-black text-emerald-900">₹{(Number(vapGrossProfit)||0).toLocaleString()}</p>
              <p className="text-[10px] text-emerald-600 mt-1">Value added beyond raw milk</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-xl shadow-sm text-center">
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-1">Current VAP Inventory</p>
              <p className="text-3xl font-black text-indigo-900">₹{(Number(currentVapInventoryValue)||0).toLocaleString()}</p>
              <p className="text-[10px] text-indigo-600 mt-1">Unrealized retail value in stock</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
              <Box className="text-slate-500" size={20}/>
              <h3 className="font-bold text-slate-800">Product Profitability Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase">
                  <tr>
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-center">Total Produced</th>
                    <th className="p-3 text-center">Total Sold</th>
                    <th className="p-3 text-right text-rose-600">Total Cost Incurred</th>
                    <th className="p-3 text-right text-blue-600">Gross Revenue</th>
                    <th className="p-3 text-right font-bold text-emerald-600">Net Product Margin (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vapProductPnL.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-800">{p.name || 'Unknown'}</td>
                      <td className="p-3 text-center font-medium text-slate-600">{(Number(p.qtyProduced)||0).toFixed(1)} Units</td>
                      <td className="p-3 text-center font-medium text-slate-600">{(Number(p.qtySold)||0).toFixed(1)} Units</td>
                      <td className="p-3 text-right text-rose-600 font-medium">₹{(Number(p.cost)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="p-3 text-right text-blue-600 font-medium">₹{(Number(p.revenue)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      <td className="p-3 text-right font-black text-emerald-600 text-base">₹{(Number(p.profit)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                    </tr>
                  ))}
                  {vapProductPnL.length === 0 && <tr><td colSpan="6" className="p-6 text-center text-slate-400">No processing data found. Execute a VAP production run to populate this ledger.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ANIMAL P&L */}
      {activeTab === 'animal_pnl' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl text-white flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black flex items-center gap-2"><Activity className="text-emerald-400" /> Individual Animal P&L (MTD)</h2>
              <p className="text-sm text-slate-400 mt-1">Revenue minus specific meds, top-dress, and a daily overhead tax (₹{(Number(overheadPerAnimal)||0).toFixed(2)}/animal).</p>
            </div>
            <div className="text-right">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Herd Size</p>
               <p className="text-3xl font-black text-emerald-400">{activeAnimalCount}</p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
              <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex items-center justify-between">
                <h3 className="font-bold text-emerald-900 flex items-center gap-2"><TrendingUp size={20} className="text-emerald-600"/> The Performers (Profitable Lactating)</h3>
                <span className="text-xs font-black bg-emerald-200 text-emerald-800 px-3 py-1 rounded-full">{performers.length} Cows</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                    <tr><th className="p-3">Tag & Name</th><th className="p-3 text-center">Yield (MTD)</th><th className="p-3 text-right">Est. Revenue</th><th className="p-3 text-right text-red-500">Direct Cost</th><th className="p-3 text-right text-slate-500">Overhead Tax</th><th className="p-3 text-right font-bold text-emerald-600">Net Profit (₹)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {performers.map(a => (
                      <tr key={a.id} className="hover:bg-emerald-50/30">
                        <td className="p-3 font-bold text-slate-800">
                          {a.tag || 'UNK'} <span className="text-xs font-normal text-slate-500 ml-1">{a.name || ''}</span>
                          <button onClick={() => setYieldAdjustModal({show: true, cow: a, amount: '', type: 'Subtract', notes: ''})} className="text-blue-500 hover:text-blue-700 ml-2 inline-flex align-middle" title="Adjust Lifetime Yield"><ArrowRightLeft size={14}/></button>
                        </td>
                        <td className="p-3 text-center font-bold text-blue-600">{(Number(a.animalMilk)||0).toFixed(1)} L</td>
                        <td className="p-3 text-right text-slate-600 font-medium">₹{(Number(a.estimatedRevenue)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                        <td className="p-3 text-right text-red-500 text-xs">Meds: ₹{(Number(a.animalMeds)||0)}<br/>Feed: ₹{(Number(a.animalTopDress)||0)}</td>
                        <td className="p-3 text-right text-slate-500 font-medium">-₹{(Number(a.overheadPerAnimal)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                        <td className="p-3 text-right font-black text-emerald-600 text-base">₹{(Number(a.netProfit)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      </tr>
                    ))}
                    {performers.length === 0 && <tr><td colSpan="6" className="p-6 text-center text-slate-400">No profitable cows found this month.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
              <div className="bg-red-50 p-4 border-b border-red-100 flex items-center justify-between">
                <h3 className="font-bold text-red-900 flex items-center gap-2"><TrendingDown size={20} className="text-red-600"/> The Bleeders (Unprofitable Lactating)</h3>
                <span className="text-xs font-black bg-red-200 text-red-800 px-3 py-1 rounded-full">{bleeders.length} Cows</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                    <tr><th className="p-3">Tag & Name</th><th className="p-3 text-center">Yield (MTD)</th><th className="p-3 text-right">Est. Revenue</th><th className="p-3 text-right text-red-500">Direct Cost</th><th className="p-3 text-right text-slate-500">Overhead Tax</th><th className="p-3 text-right font-bold text-red-600">Net Loss (₹)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bleeders.map(a => (
                      <tr key={a.id} className="hover:bg-red-50/30">
                        <td className="p-3 font-bold text-slate-800">
                          {a.tag || 'UNK'} <span className="text-xs font-normal text-slate-500 ml-1">{a.name || ''}</span>
                          <button onClick={() => setYieldAdjustModal({show: true, cow: a, amount: '', type: 'Subtract', notes: ''})} className="text-blue-500 hover:text-blue-700 ml-2 inline-flex align-middle" title="Adjust Lifetime Yield"><ArrowRightLeft size={14}/></button>
                        </td>
                        <td className="p-3 text-center font-bold text-blue-600">{(Number(a.animalMilk)||0).toFixed(1)} L</td>
                        <td className="p-3 text-right text-slate-600 font-medium">₹{(Number(a.estimatedRevenue)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                        <td className="p-3 text-right text-red-500 text-xs">Meds: ₹{(Number(a.animalMeds)||0)}<br/>Feed: ₹{(Number(a.animalTopDress)||0)}</td>
                        <td className="p-3 text-right text-slate-500 font-medium">-₹{(Number(a.overheadPerAnimal)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                        <td className="p-3 text-right font-black text-red-600 text-base">₹{(Number(a.netProfit)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      </tr>
                    ))}
                    {bleeders.length === 0 && <tr><td colSpan="6" className="p-6 text-center text-slate-400">No unprofitable lactating cows found. Excellent!</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
              <div className="bg-blue-50 p-4 border-b border-blue-100 flex items-center justify-between">
                <h3 className="font-bold text-blue-900 flex items-center gap-2"><Baby size={20} className="text-blue-600"/> Future Assets (Calves, Heifers, Dry)</h3>
                <span className="text-xs font-black bg-blue-200 text-blue-800 px-3 py-1 rounded-full">{investments.length} Animals</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                    <tr><th className="p-3">Tag & Stage</th><th className="p-3 text-right text-purple-600">Calf Milk Cost</th><th className="p-3 text-right text-red-500">Meds & Top-Dress</th><th className="p-3 text-right text-slate-500">Overhead Tax</th><th className="p-3 text-right font-bold text-slate-800">Total Investment (₹)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {investments.map(a => (
                      <tr key={a.id} className="hover:bg-blue-50/30">
                        <td className="p-3 font-bold text-slate-800">{a.tag || 'UNK'} <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded ml-2">{a.stage || a.status || 'Unknown'}</span></td>
                        <td className="p-3 text-right text-purple-600 font-medium">₹{(Number(a.calfFeedCost)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                        <td className="p-3 text-right text-red-500 text-xs">Meds: ₹{(Number(a.animalMeds)||0)}<br/>Feed: ₹{(Number(a.animalTopDress)||0)}</td>
                        <td className="p-3 text-right text-slate-500 font-medium">₹{(Number(a.overheadPerAnimal)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                        <td className="p-3 text-right font-black text-slate-800 text-base">₹{Math.abs(Number(a.netProfit)||0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      </tr>
                    ))}
                    {investments.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-slate-400">No non-lactating animals found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* DEEP ANALYTICS & BALANCE SHEET */}
      {activeTab === 'reports' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-0 print:p-0">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Filter className="text-indigo-600"/> Global Period Filter</h2>
                <p className="text-xs text-slate-500 mt-1">Select a time period. The Master Balance Sheet and all Analytics tables below will instantly sync to this timeframe.</p>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  value={globalReportPeriod} 
                  onChange={(e) => setGlobalReportPeriod(e.target.value)} 
                  className="bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg text-sm font-black p-2 outline-none cursor-pointer shadow-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="This Week">This Week</option>
                  <option value="This Month">This Month</option>
                  <option value="Last Month">Last Month</option>
                  <option value="This Quarter">This Quarter</option>
                  <option value="This Biannual">This Half-Year</option>
                  <option value="This Year">This Year</option>
                  <option value="FY 25-26">Financial Year 2025-2026</option>
                  <option value="FY 24-25">Financial Year 2024-2025</option>
                  <option value="All-Time">All-Time (Includes Legacy)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl text-white print:hidden">
            <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-4">
              <div>
                 <h2 className="text-xl font-black flex items-center gap-2"><Landmark className="text-emerald-400" /> Master Balance Sheet</h2>
                 <p className="text-xs text-slate-400 mt-1">Synced to: <span className="text-white font-bold">{globalReportPeriod}</span></p>
              </div>
              <button onClick={() => setCapitalAdjustModal({show: true, amount: '', type: 'Deposit', notes: ''})} className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-bold py-2 px-4 text-xs rounded transition flex items-center gap-2">
                <ArrowRightLeft size={14}/> Adjust Master Capital
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Filtered Revenue</p>
                <p className="text-2xl font-black text-emerald-400">₹ {(Number(allTimeRevenue)||0).toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">Sales + Live Cow Dispositions</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Filtered True Expense</p>
                <p className="text-2xl font-black text-rose-400">₹ {(Number(allTimeTrueExpenditure)||0).toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">Value of all goods/labor consumed.</p>
              </div>
              <div className="space-y-1 border-l border-slate-700 pl-6">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Debt (Loans)</p>
                <p className="text-2xl font-black text-amber-400">₹ {(Number(totalLoans)||0).toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">Pending repayment</p>
              </div>
              <div className="space-y-1 bg-emerald-900/50 p-4 rounded-lg border border-emerald-800/50 -mt-4">
                <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">True Net Worth / Position</p>
                <p className="text-3xl font-black text-white">₹ {(Number(absoluteNetWorth)||0).toLocaleString()}</p>
                <p className="text-[10px] text-emerald-400/70 mt-1">Profit + Subsidies - Debt - Capex</p>
              </div>
            </div>

            {/* --- NEW: THE AI CFO REPORT TRIGGER WITH FIX --- */}
            <div className="mt-8 pt-6 border-t border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Brain className="text-emerald-400" size={18} /> NooRganicCFO Financial Advisor
                </h3>
                <button 
                  type="button"
                  onClick={handleCfoAnalysis}
                  disabled={isCfoLoading}
                  className="bg-emerald-900 text-emerald-300 hover:bg-emerald-800 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition disabled:opacity-50 border border-emerald-700"
                >
                  <Sparkles size={16} /> 
                  {isCfoLoading ? 'Analyzing Finances...' : 'Generate CFO Report'}
                </button>
              </div>

              {cfoReport && (
                <div className="bg-slate-800 border-2 border-emerald-700 rounded-xl p-6 shadow-sm mt-4">
                  <h4 className="text-lg font-bold text-emerald-400 mb-4">AI Financial Assessment</h4>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-medium">
                    {cfoReport.replace(/\*/g, '')}
                  </div>
                </div>
              )}
            </div>
            {/* -------------------------------------- */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 print:hidden">
            <div onClick={() => setActiveReport('cost_production')} className={`bg-white p-4 rounded-xl border-2 cursor-pointer transition shadow-sm flex flex-col justify-center ${activeReport === 'cost_production' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-blue-300'}`}>
              <div className="flex items-center gap-1 mb-1"><Calculator size={14} className="text-blue-600"/><h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cost of Prod (Est)</h3></div>
              <p className="text-xl font-black text-slate-800">₹ {(Number(totalProductCpl)||0).toFixed(2)} <span className="text-xs font-bold text-slate-400">/ L</span></p>
            </div>
            <div onClick={() => setActiveReport('operating_margin')} className={`bg-white p-4 rounded-xl border-2 cursor-pointer transition shadow-sm flex flex-col justify-center ${activeReport === 'operating_margin' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 hover:border-emerald-300'}`}>
              <div className="flex items-center gap-1 mb-1"><TrendingUp size={14} className="text-emerald-600"/><h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Operating Margin</h3></div>
              <p className="text-xl font-black text-slate-800">{(Number(operatingMargin)||0)}%</p>
            </div>
            <div onClick={() => setActiveReport('employee_cost')} className={`bg-white p-4 rounded-xl border-2 cursor-pointer transition shadow-sm flex flex-col justify-center ${activeReport === 'employee_cost' ? 'border-amber-500 bg-amber-50/30' : 'border-slate-200 hover:border-amber-300'}`}>
              <div className="flex items-center gap-1 mb-1"><Users size={14} className="text-amber-600"/><h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Labor Cost Ratio</h3></div>
              <p className="text-xl font-black text-slate-800">{allTimeRevenue > 0 ? ((Number(totalEmployeeCost) / Number(allTimeRevenue))*100).toFixed(1) : 0}%</p>
            </div>
            <div onClick={() => setActiveReport('irr')} className={`bg-white p-4 rounded-xl border-2 cursor-pointer transition shadow-sm flex flex-col justify-center ${activeReport === 'irr' ? 'border-purple-500 bg-purple-50/30' : 'border-slate-200 hover:border-purple-300'}`}>
              <div className="flex items-center gap-1 mb-1"><Percent size={14} className="text-purple-600"/><h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Est. IRR / ROI</h3></div>
              <p className="text-xl font-black text-slate-800">{(Number(estIRR)||0)}%</p>
            </div>
            <div onClick={() => setActiveReport('cbr')} className={`bg-white p-4 rounded-xl border-2 cursor-pointer transition shadow-sm flex flex-col justify-center ${activeReport === 'cbr' ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-300'}`}>
              <div className="flex items-center gap-1 mb-1"><Scale size={14} className="text-indigo-600"/><h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cost-Benefit Ratio</h3></div>
              <p className="text-xl font-black text-slate-800">{(Number(costBenefitRatio)||0)} : 1</p>
            </div>
          </div>

          {activeReport && (
            <div className="bg-white p-6 rounded-xl border-2 border-slate-300 shadow-lg animate-in slide-in-from-top-4 relative print:hidden">
               <button onClick={()=>setActiveReport(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X size={20}/></button>
               
               {activeReport === 'employee_cost' && (
                 <>
                   <div className="flex justify-between items-center mb-6 border-b pb-4">
                     <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2"><FileBarChart className="text-amber-600"/> Detailed Employee Cost Report</h2>
                   </div>
                   <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                       <thead>
                         <tr className="border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                           <th className="py-3 px-4 font-bold">Employee</th><th className="py-3 px-4 font-bold text-right">Base Salary</th><th className="py-3 px-4 font-bold text-right">Bonuses Paid</th><th className="py-3 px-4 font-bold text-right">Milk Incentives (Val)</th><th className="py-3 px-4 font-bold text-right text-slate-800">Total Company Cost</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 text-sm">
                         {employees.map(emp => (
                           <tr key={emp.id} className="hover:bg-slate-50">
                             <td className="py-3 px-4 font-bold text-slate-800">{emp.name || 'Unnamed'} <span className="text-xs font-normal text-slate-500">({emp.role || 'UNK'})</span></td>
                             <td className="py-3 px-4 text-right">₹{(parseFloat(emp.baseSalary) || 0).toLocaleString()}</td>
                             <td className="py-3 px-4 text-right text-emerald-600 font-medium">₹{(parseFloat(emp.totalBonus) || 0).toLocaleString()}</td>
                             <td className="py-3 px-4 text-right text-blue-600 font-medium">₹{(parseFloat(emp.cumulativeMilkValue) || 0).toLocaleString()}</td>
                             <td className="py-3 px-4 text-right font-black text-amber-700">₹{((parseFloat(emp.baseSalary) || 0) + (parseFloat(emp.totalBonus) || 0) + (parseFloat(emp.cumulativeMilkValue) || 0)).toLocaleString()}</td>
                           </tr>
                         ))}
                         <tr className="bg-amber-50/50">
                           <td className="py-4 px-4 font-black text-slate-800 uppercase tracking-widest text-xs">COMBINED TOTALS</td>
                           <td className="py-4 px-4 text-right font-black text-slate-800">₹{(Number(totalBaseSalaries)||0).toLocaleString()}</td>
                           <td className="py-4 px-4 text-right font-black text-emerald-700">₹{(Number(employees.reduce((acc, emp) => acc + (parseFloat(emp.totalBonus) || 0), 0))||0).toLocaleString()}</td>
                           <td className="py-4 px-4 text-right font-black text-blue-700">₹{(Number(employees.reduce((acc, emp) => acc + (parseFloat(emp.cumulativeMilkValue) || 0), 0))||0).toLocaleString()}</td>
                           <td className="py-4 px-4 text-right font-black text-amber-900 text-lg">₹{(Number(totalEmployeeCost)||0).toLocaleString()}</td>
                         </tr>
                       </tbody>
                     </table>
                   </div>
                 </>
               )}

               {activeReport === 'cost_production' && (
                 <div>
                   <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2 mb-4"><Calculator className="text-blue-600"/> Cost of Production Breakdown</h2>
                   <p className="text-sm text-slate-600 mb-4">This is your live Month-To-Date cost to produce 1 liter of milk based on actual inventory consumption and labor expenses.</p>
                   <div className="grid grid-cols-4 gap-4 text-center">
                     <div className="bg-slate-50 p-4 rounded border border-slate-200"><p className="text-xs font-bold text-slate-400 uppercase">Farm CPL</p><p className="text-lg font-bold">₹{(Number(liveFarmCpl)||0).toFixed(2)}</p></div>
                     <div className="bg-slate-50 p-4 rounded border border-slate-200"><p className="text-xs font-bold text-slate-400 uppercase">Delivery CPL</p><p className="text-lg font-bold">₹{(Number(deliveryCplCalc)||0).toFixed(2)}</p></div>
                     <div className="bg-slate-50 p-4 rounded border border-slate-200"><p className="text-xs font-bold text-slate-400 uppercase">Total Yield</p><p className="text-lg font-bold">{(Number(mtdMilkLiters)||0).toLocaleString()} L</p></div>
                     <div className="bg-blue-50 p-4 rounded border border-blue-200"><p className="text-xs font-bold text-blue-600 uppercase">Total Final CPL</p><p className="text-xl font-black text-blue-800">₹{(Number(totalProductCpl)||0).toFixed(2)} / L</p></div>
                   </div>
                 </div>
               )}

               {activeReport === 'irr' && (
                 <div>
                   <h2 className="text-xl font-bold text-purple-900 flex items-center gap-2 mb-4"><Percent className="text-purple-600"/> Return on Investment (ROI / IRR)</h2>
                   <p className="text-sm text-slate-600 mb-4">This calculates the percentage return on your initial capital investment based on all-time net operating profits.</p>
                   <div className="bg-purple-50 p-4 rounded border border-purple-200 flex justify-between items-center">
                     <div><p className="text-xs font-bold text-purple-600 uppercase">Formula</p><p className="font-bold text-purple-900">(Net Profit / Total Capital Invested) * 100</p></div>
                     <div className="text-right"><p className="text-xs font-bold text-purple-600 uppercase">Result</p><p className="text-2xl font-black text-purple-900">{(Number(estIRR)||0)}%</p></div>
                   </div>
                 </div>
               )}

               {activeReport === 'cbr' && (
                 <div>
                   <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2 mb-4"><Scale className="text-indigo-600"/> Cost-Benefit Ratio (CBR)</h2>
                   <p className="text-sm text-slate-600 mb-4">For every ₹1 of true value consumed on the farm, this is how many Rupees of revenue are generated.</p>
                   <div className="bg-indigo-50 p-4 rounded border border-indigo-200 flex justify-between items-center">
                     <div><p className="text-xs font-bold text-indigo-600 uppercase">Formula</p><p className="font-bold text-indigo-900">Total Revenue / Total True Expenditure</p></div>
                     <div className="text-right"><p className="text-xs font-bold text-indigo-600 uppercase">Result</p><p className="text-2xl font-black text-indigo-900">{(Number(costBenefitRatio)||0)} : 1</p></div>
                   </div>
                 </div>
               )}

               {activeReport === 'operating_margin' && (
                 <div>
                   <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2 mb-4"><TrendingUp className="text-emerald-600"/> Operating Margin</h2>
                   <p className="text-sm text-slate-600 mb-4">The percentage of revenue left over after accounting for all variable costs (feed, labor, meds).</p>
                   <div className="bg-emerald-50 p-4 rounded border border-emerald-200 flex justify-between items-center">
                     <div><p className="text-xs font-bold text-emerald-600 uppercase">Formula</p><p className="font-bold text-emerald-900">(Net Profit / Total Revenue) * 100</p></div>
                     <div className="text-right"><p className="text-xs font-bold text-emerald-600 uppercase">Result</p><p className="text-2xl font-black text-emerald-900">{(Number(operatingMargin)||0)}%</p></div>
                   </div>
                 </div>
               )}
            </div>
          )}

          {/* EXPENDITURE ANALYTICS ENGINE */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:hidden">
             <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
               <div>
                 <h2 className="text-xl font-black flex items-center gap-2 text-slate-800"><Search className="text-emerald-600" /> Granular Expenditure Analytics</h2>
                 <p className="text-sm text-slate-500 mt-1">Deep breakdown of where money is being spent based on the <span className="font-bold text-indigo-600">{globalReportPeriod}</span> filter.</p>
               </div>
             </div>

             {/* Category Chart */}
             <div className="mb-10">
               <h3 className="font-bold text-slate-700 uppercase tracking-widest text-xs mb-4 flex items-center gap-2"><PieChartIcon size={14}/> Spending by Category</h3>
               {categoryData.length > 0 ? (
                 <div style={{ width: '100%', height: 350, minHeight: 350, minWidth: 300 }}>
                   <ResponsiveContainer width="99%" height="100%">
                     <BarChart data={categoryData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 'bold'}} interval={0} angle={-45} textAnchor="end" />
                       <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                       <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold'}} formatter={(val) => `₹${val.toLocaleString()}`} />
                       <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               ) : (
                 <div className="h-48 bg-slate-50 border border-slate-100 rounded flex items-center justify-center text-slate-400 font-bold">No categorical data found for this period.</div>
               )}
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* Item Wise Table */}
               <div>
                  <h3 className="font-bold text-slate-700 uppercase tracking-widest text-xs mb-4 flex items-center gap-2"><PackagePlus size={14}/> Specific Item Consumption & Cost</h3>
                  <div className="overflow-y-auto border border-slate-200 rounded-lg max-h-[400px]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm">
                        <tr>
                          <th className="p-3 font-bold text-slate-600">Item Name</th>
                          <th className="p-3 font-bold text-center text-slate-600">Qty Consumed</th>
                          <th className="p-3 font-bold text-right text-emerald-600">Total Spent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {itemData.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-bold text-slate-800">{item.name}</td>
                            <td className="p-3 text-center font-bold text-blue-600">{(Number(item.qty)||0).toLocaleString(undefined, {maximumFractionDigits:2})} <span className="text-[10px] text-slate-400">{item.unit}</span></td>
                            <td className="p-3 text-right font-black text-slate-700">₹{(Number(item.cost)||0).toLocaleString()}</td>
                          </tr>
                        ))}
                        {itemData.length === 0 && <tr><td colSpan="3" className="p-6 text-center text-slate-400">No items found for this period.</td></tr>}
                      </tbody>
                    </table>
                  </div>
               </div>

               {/* Vendor Trading Table */}
               <div>
                  <h3 className="font-bold text-slate-700 uppercase tracking-widest text-xs mb-4 flex items-center gap-2"><Building2 size={14}/> Vendor / Supplier Business Volume</h3>
                  <div className="overflow-y-auto border border-slate-200 rounded-lg max-h-[400px]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm">
                        <tr>
                          <th className="p-3 font-bold text-slate-600">Vendor Entity</th>
                          <th className="p-3 font-bold text-right text-rose-600">Billed (Purchases)</th>
                          <th className="p-3 font-bold text-right text-emerald-600">Actual Cash Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vendorData.map((v, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-bold text-slate-800">{v.name}</td>
                            <td className="p-3 text-right font-bold text-rose-600">₹{(Number(v.billed)||0).toLocaleString()}</td>
                            <td className="p-3 text-right font-black text-emerald-600">₹{(Number(v.paid)||0).toLocaleString()}</td>
                          </tr>
                        ))}
                        {vendorData.length === 0 && <tr><td colSpan="3" className="p-6 text-center text-slate-400">No vendor business found for this period.</td></tr>}
                      </tbody>
                    </table>
                  </div>
               </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl shadow-sm text-center">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1">Total True Value (Purchased)</p>
              <p className="text-3xl font-black text-emerald-900">₹{(Number(trueInventoryExpense)||0).toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl shadow-sm text-center">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">Real Cash Paid to Vendors</p>
              <p className="text-3xl font-black text-blue-900">₹{(Number(realCashPaidToVendors)||0).toLocaleString()}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl shadow-sm text-center">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1">Outstanding Vendor Debt (A/P)</p>
              <p className="text-3xl font-black text-amber-900">₹{((Number(totalLegacyDebt)||0) + (Number(trueInventoryExpense)||0) - (Number(realCashPaidToVendors)||0)).toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {showAddVendor ? (
              <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-blue-200 shadow-md h-fit animate-in fade-in">
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><UserPlus className="text-blue-600" size={20} /> Register Supplier</h2>
                  <button onClick={() => setShowAddVendor(false)} className="text-slate-400 hover:text-slate-700"><X size={18}/></button>
                </div>
                <form onSubmit={handleAddVendor} className="space-y-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">VENDOR / SUPPLIER NAME</label><input type="text" required value={newVendor.name} onChange={(e)=>setNewVendor({...newVendor, name: e.target.value})} className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Arshid Feed Store" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">PHONE NUMBER</label><input type="text" value={newVendor.phone} onChange={(e)=>setNewVendor({...newVendor, phone: e.target.value})} className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">CATEGORY</label>
                    <select value={newVendor.category} onChange={(e)=>setNewVendor({...newVendor, category: e.target.value})} className="w-full p-2 border rounded outline-none">
                      <option value="Feed Supplier">Feed Supplier</option>
                      <option value="Pharmacy / Vet">Pharmacy / Vet Supply</option>
                      <option value="Equipment">Hardware / Equipment</option>
                      <option value="General Vendor">General Farm Vendor</option>
                    </select>
                  </div>
                  <div className="p-3 bg-amber-50 rounded border border-amber-200">
                    <label className="block text-xs font-bold text-amber-800 mb-1">OPENING BALANCE / LEGACY DEBT (₹)</label>
                    <input type="number" required value={newVendor.legacyDebt} onChange={(e)=>setNewVendor({...newVendor, legacyDebt: e.target.value})} className="w-full p-2 border border-amber-300 rounded outline-none font-bold text-amber-900" placeholder="0 if fully settled" />
                  </div>
                  <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-slate-400">{loading ? 'Saving...' : 'Save Vendor'}</button>
                </form>
              </div>
            ) : (
              <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><PackagePlus className="text-emerald-600" size={20} /> Log Market Purchase</h2>
                  <button onClick={() => setShowAddVendor(true)} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">+ New Vendor</button>
                </div>
                <form onSubmit={handleLogPurchase} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">CATEGORY</label>
                    <select value={purchase.category} onChange={(e)=>setPurchase({...purchase, category: e.target.value})} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none">
                      <option value="Medicine">Medicine & Vaccines</option><option value="Supplement">Supplements (Minerals, Calcium)</option><option value="Feed">Dry Feed (Silage, Straw, Concentrate)</option><option value="Vegetable">Fresh Vegetables / Greens</option><option value="Equipment">Farm Equipment / Consumables</option>
                    </select>
                  </div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">ITEM NAME</label><input type="text" required value={purchase.itemName} onChange={(e)=>setPurchase({...purchase, itemName: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Enrofloxacin 10%" /></div>
                  
                  <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div><label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><Tag size={12}/> BRAND</label><input type="text" list="brand-options" value={purchase.brand} onChange={(e)=>setPurchase({...purchase, brand: e.target.value})} className="w-full p-2 border border-slate-300 rounded text-sm outline-none" placeholder="e.g. Virbac" /></div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><Building2 size={12}/> VENDOR</label>
                      <input type="text" list="vendor-options" required value={purchase.vendor} onChange={(e)=>setPurchase({...purchase, vendor: e.target.value})} className="w-full p-2 border border-slate-300 rounded text-sm outline-none" placeholder="Select Registered..." />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">BULK QUANTITY</label><input type="number" step="0.01" required value={purchase.totalQuantity} onChange={(e)=>setPurchase({...purchase, totalQuantity: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none" /></div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">UNIT</label>
                      <select value={purchase.unit} onChange={(e)=>setPurchase({...purchase, unit: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none">
                        <option value="ml">Milliliters (ml)</option><option value="L">Liters (L)</option><option value="kg">Kilograms (kg)</option><option value="ton">Tons</option><option value="vial">Vials / Kits</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                     <label className="block text-xs font-bold text-slate-500 mb-1">TOTAL VALUE OF GOODS (₹)</label>
                     <input type="number" step="0.01" required value={purchase.totalCost} onChange={(e)=>setPurchase({...purchase, totalCost: e.target.value})} className="w-full p-2 border border-slate-300 rounded text-xl font-bold outline-none text-emerald-700 bg-emerald-50" placeholder="0.00" />
                  </div>

                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <label className="block text-xs font-bold text-amber-800 mb-1">PAYMENT STATUS</label>
                    <select value={purchase.paymentStatus} onChange={(e)=>setPurchase({...purchase, paymentStatus: e.target.value})} className="w-full p-2 border border-amber-300 rounded outline-none font-bold text-amber-900">
                      <option value="Paid in Full">Paid in Full (Cash/Bank)</option>
                      <option value="Bought on Credit">Bought on Credit (Add to Vendor Debt)</option>
                    </select>
                  </div>
                  <button disabled={loading} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition disabled:bg-slate-400"><Database size={18} /> {loading ? 'Saving...' : 'Add to Master Inventory'}</button>
                </form>
              </div>
            )}

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Building2 className="text-blue-600" size={20} /> Vendor Accounts Payable (A/P)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider bg-slate-50">
                        <th className="py-3 px-4 font-bold rounded-tl-lg">Vendor Profile</th>
                        <th className="py-3 px-4 font-bold text-right border-l border-slate-200">Opening Debt</th>
                        <th className="py-3 px-4 font-bold text-right">New Billed</th>
                        <th className="py-3 px-4 font-bold text-right">Cash Paid</th>
                        <th className="py-3 px-4 font-bold text-right">Outstanding</th>
                        <th className="py-3 px-4 font-bold text-right rounded-tr-lg">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {vendorLedger.map((v) => (
                        <tr key={v.vendor} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800 flex items-center gap-1">{v.vendor} {!v.isRegistered && <span className="w-2 h-2 rounded-full bg-amber-400" title="Unregistered Vendor"></span>}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{v.phone}</div>
                          </td>
                          <td className="py-3 px-4 text-right border-l border-slate-100 text-slate-500 font-bold">₹{(Number(v.legacyDebt)||0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-slate-500 font-bold">₹{(Number(v.totalBilled)||0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-bold">₹{(Number(v.totalPaid)||0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right">
                             {(Number(v.outstandingDue)||0) > 0 ? (
                               <span className="text-amber-600 font-black text-lg">₹{(Number(v.outstandingDue)||0).toLocaleString()}</span>
                             ) : (Number(v.outstandingDue)||0) < 0 ? (
                               <span className="text-emerald-600 font-black">₹{Math.abs(Number(v.outstandingDue)||0).toLocaleString()} (Adv)</span>
                             ) : (
                               <span className="text-slate-400 font-bold flex items-center justify-end gap-1"><CheckCircle size={14}/> Settled</span>
                             )}
                          </td>
                          <td className="py-3 px-4 text-right flex flex-col items-end gap-1">
                            {(Number(v.outstandingDue)||0) > 0 && (
                              <button onClick={() => setPaymentModal({ show: true, vendor: v.vendor, amount: v.outstandingDue, method: 'Cash', date: new Date().toISOString().split('T')[0], notes: '', proofFile: null })} className="bg-blue-600 text-white font-bold px-3 py-1.5 rounded shadow hover:bg-blue-700 transition text-xs w-full">Log Payment</button>
                            )}
                            {v.isRegistered && <button onClick={()=>handleDeleteRecord('vendors', v.id)} className="text-red-400 hover:text-red-600 text-[10px] font-bold">Del</button>}
                          </td>
                        </tr>
                      ))}
                      {vendorLedger.length === 0 && <tr><td colSpan="6" className="py-8 text-center text-slate-400 font-medium">No vendors logged yet.</td></tr>}
                    </tbody>
                  </table>
                </div>

                {vendorPayments.length > 0 && (
                   <div className="mt-8 pt-6 border-t border-slate-200">
                     <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><History size={16} className="text-slate-500"/> Vendor Payment History</h3>
                     <div className="overflow-x-auto max-h-64">
                       <table className="w-full text-left border-collapse text-xs">
                         <thead className="sticky top-0 bg-white">
                           <tr className="border-b text-slate-500 uppercase tracking-wider">
                             <th className="py-2 px-3">Date</th><th className="py-2 px-3">Vendor</th><th className="py-2 px-3 text-right">Amount Paid</th><th className="py-2 px-3 text-center">Method</th><th className="py-2 px-3">Notes</th><th className="py-2 px-3 text-right">Action</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                           {vendorPayments.map(p => {
                             const printObj = { docId: p.id, docType: 'Payment Voucher', date: p.date, entity: p.vendor, amount: p.amount, ref: `PV-${p.id.slice(-5).toUpperCase()}`, raw: p, method: p.method, notes: p.notes };
                             return (
                             <tr key={p.id} className="hover:bg-slate-50">
                               <td className="py-2 px-3 font-bold text-slate-600">{p.date || '--'}</td>
                               <td className="py-2 px-3 font-bold text-slate-800">{p.vendor || 'Unknown'}</td>
                               <td className="py-2 px-3 font-black text-emerald-600 text-right">₹{(parseFloat(p.amount) || 0).toLocaleString()}</td>
                               <td className="py-2 px-3 text-center"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">{p.method || 'Cash'}</span></td>
                               <td className="py-2 px-3 text-slate-500 truncate max-w-[150px]">{p.notes || '--'}</td>
                               <td className="py-2 px-3 text-right flex items-center gap-2 justify-end">
                                 <button onClick={() => triggerPrintEngine(printObj, 'Payment Voucher')} className="text-blue-500 hover:text-blue-700 font-bold bg-blue-50 px-2 py-1 rounded flex items-center gap-1" title="Print Receipt"><Printer size={12}/> Print</button>
                                 <button onClick={()=>handleDeleteRecord('vendor_payments', p.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12}/></button>
                               </td>
                             </tr>
                           )})}
                         </tbody>
                       </table>
                     </div>
                   </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Search className="text-emerald-600" size={20} /> Live Inventory & Unit Costs</h2>
                {editingInventoryItem && (
                   <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-lg mb-6 shadow-inner animate-in fade-in">
                     <div className="flex justify-between items-center mb-3"><h3 className="font-bold text-emerald-900">Editing: {editingInventoryItem.item_name}</h3><button onClick={()=>setEditingInventoryItem(null)}><X size={18}/></button></div>
                     <form onSubmit={handleUpdateInventoryItem} className="flex gap-2 items-end">
                       <div className="flex-1"><label className="text-[10px] font-bold">QTY</label><input type="number" step="0.1" value={editingInventoryItem.total_quantity} onChange={(e)=>setEditingInventoryItem({...editingInventoryItem, total_quantity: e.target.value})} className="w-full border p-1.5 rounded outline-none text-sm"/></div>
                       <div className="flex-1"><label className="text-[10px] font-bold">CURRENT STOCK</label><input type="number" step="0.1" value={editingInventoryItem.current_stock} onChange={(e)=>setEditingInventoryItem({...editingInventoryItem, current_stock: e.target.value})} className="w-full border border-blue-400 bg-blue-50 p-1.5 rounded outline-none text-sm"/></div>
                       <div className="flex-1"><label className="text-[10px] font-bold">BRAND</label><input type="text" value={editingInventoryItem.brand} onChange={(e)=>setEditingInventoryItem({...editingInventoryItem, brand: e.target.value})} className="w-full border p-1.5 rounded outline-none text-sm"/></div>
                       <div className="flex-1"><label className="text-[10px] font-bold">VENDOR</label><input type="text" value={editingInventoryItem.vendor} onChange={(e)=>setEditingInventoryItem({...editingInventoryItem, vendor: e.target.value})} className="w-full border p-1.5 rounded outline-none text-sm"/></div>
                       <div className="flex-1"><label className="text-[10px] font-bold">TOTAL VALUE(₹)</label><input type="number" value={editingInventoryItem.total_cost} onChange={(e)=>setEditingInventoryItem({...editingInventoryItem, total_cost: e.target.value})} className="w-full border p-1.5 rounded outline-none text-sm"/></div>
                       <button disabled={loading} type="submit" className="bg-emerald-600 text-white px-4 py-1.5 rounded font-bold hover:bg-emerald-700 text-sm disabled:bg-slate-400">Save</button>
                     </form>
                   </div>
                )}

                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider sticky top-0 bg-white z-10">
                        <th className="py-3 px-4 font-bold">Item Name</th><th className="py-3 px-4 font-bold">Vendor</th><th className="py-3 px-4 font-bold">Current Stock</th><th className="py-3 px-4 font-bold text-emerald-600">Unit Cost (₹)</th><th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {inventory.length > 0 ? inventory.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4"><div className="font-bold text-slate-800">{item.item_name || 'Unknown'}</div><div className="text-[10px] uppercase text-slate-400 font-bold mt-0.5 bg-slate-100 inline-block px-1.5 rounded">{item.category || '--'}</div></td>
                            <td className="py-3 px-4 text-xs text-slate-600">{item.vendor || '--'}<br/><span className="text-[9px] font-bold text-slate-400">{item.brand || '--'}</span></td>
                            <td className="py-3 px-4 font-medium"><span className={`px-2 py-1 rounded font-bold ${(parseFloat(item.current_stock)||0) <= 0 ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{(parseFloat(item.current_stock)||0).toFixed(2)} <span className="text-xs">{item.unit || ''}</span></span></td>
                            <td className="py-3 px-4 font-black text-emerald-600">₹{(parseFloat(item.unit_cost)||0).toFixed(2)} <span className="text-xs text-emerald-400 font-normal">/ {item.unit || ''}</span></td>
                            <td className="py-3 px-4 text-right">
                              <button onClick={() => setStockAdjustModal({show: true, item: item, amount: '', type: 'Add', notes: ''})} className="text-emerald-500 hover:text-emerald-700 p-1 ml-1" title="Audit / Adjust Stock"><ArrowRightLeft size={16}/></button>
                              <button onClick={() => setEditingInventoryItem(item)} className="text-blue-500 hover:text-blue-700 p-1 ml-1"><Edit size={16}/></button>
                              <button onClick={() => handleDeleteRecord('inventory', item.id)} className="text-red-400 hover:text-red-600 p-1 ml-1"><Trash2 size={16}/></button>
                            </td>
                          </tr>
                        )) : <tr><td colSpan="5" className="py-8 text-center text-slate-400 font-medium">No inventory data found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="space-y-6 animate-in fade-in duration-300">
           <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2"><Settings size={24}/> Farm Profile & Tax Configuration</h2>
                <p className="text-sm text-blue-700 mt-1">Set the legal details that will appear on your generated Balance Sheets and define VAP GST rates.</p>
              </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm animate-in fade-in">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <div className="md:col-span-2">
                 <label className="block text-xs font-bold text-slate-500 mb-1">REGISTERED FARM NAME</label>
                 <input type="text" value={farmDetails.name} onChange={(e)=>setFarmDetails({...farmDetails, name: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold" />
               </div>
               <div className="md:col-span-2">
                 <label className="block text-xs font-bold text-slate-500 mb-1">FARM GSTIN (Leave blank if NA)</label>
                 <input type="text" value={farmDetails.gstin} onChange={(e)=>setFarmDetails({...farmDetails, gstin: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold" />
               </div>
               <div className="md:col-span-3">
                 <label className="block text-xs font-bold text-slate-500 mb-1">REGISTERED ADDRESS</label>
                 <input type="text" value={farmDetails.address} onChange={(e)=>setFarmDetails({...farmDetails, address: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold" />
               </div>
               <div>
                 <label className="block text-xs font-bold text-rose-600 mb-1">VAP TAX RATE (%)</label>
                 <input type="number" step="0.1" value={vapTaxRate} onChange={(e)=>setVapTaxRate(e.target.value)} className="w-full p-2 border border-rose-300 bg-rose-50 text-rose-800 rounded outline-none font-bold" placeholder="e.g. 18" />
                 <p className="text-[10px] text-slate-400 mt-1">Applied only to Processed Goods</p>
               </div>
               <div className="md:col-span-4 border-t border-slate-200 pt-4">
                 <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><ImageIcon size={14}/> UPLOAD OFFICIAL FARM LOGO (For ITR Prints)</label>
                 <div className="flex items-center gap-4">
                    {farmDetails.logoData && <img src={farmDetails.logoData} alt="Logo" className="h-12 w-12 object-contain bg-slate-100 rounded border border-slate-200 p-1" />}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                 </div>
               </div>
             </div>
             <button onClick={handleSaveFarmSettings} className="mt-6 w-full bg-slate-800 text-white font-bold py-3 px-6 rounded shadow hover:bg-slate-700 transition">Save Farm Configuration</button>
           </div>

           <div className="bg-slate-900 p-6 rounded-xl shadow-xl text-white">
              <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                 <div>
                   <h2 className="text-xl font-bold flex items-center gap-2"><Landmark className="text-emerald-400"/> Annual Tax (ITR) & Balance Sheet Generator</h2>
                   <p className="text-sm text-slate-400 mt-1">Generate official financial year summaries for CA filing.</p>
                 </div>
              </div>
              <div className="flex items-end gap-4 bg-slate-800 p-4 rounded-lg border border-slate-700">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">SELECT FINANCIAL YEAR</label>
                  <select value={itrYear} onChange={(e)=>setItrYear(e.target.value)} className="bg-slate-900 border border-slate-600 p-2 rounded text-white outline-none w-48">
                    <option value="2023-2024">FY 2023-2024</option><option value="2024-2025">FY 2024-2025</option><option value="2025-2026">FY 2025-2026</option>
                  </select>
                </div>
                <button onClick={()=>setPrintingItr(true)} className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-bold py-2 px-6 rounded transition">Generate FY Balance Sheet</button>
              </div>
           </div>

           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Master Invoices Ledger</h3>
                <p className="text-xs text-slate-500 font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">Linked to Document Hub</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead><tr className="border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider"><th className="py-3 px-4 font-bold">Inv #</th><th className="py-3 px-4 font-bold">Date</th><th className="py-3 px-4 font-bold">Customer</th><th className="py-3 px-4 font-bold">Type</th><th className="py-3 px-4 font-bold text-emerald-600">Amount</th><th className="py-3 px-4 text-right">Actions</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.length > 0 ? invoices.map(inv => {
                      const printObj = { docId: inv.id, docType: 'Invoice', date: inv.date, entity: inv.customerName, amount: inv.amount, ref: inv.invoiceNumber, raw: inv, type: inv.type, notes: inv.notes };
                      return (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-blue-600">{inv.invoiceNumber || '--'}</td>
                        <td className="py-3 px-4 text-slate-600">{inv.date || '--'}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{inv.customerName || 'Unknown'}<br/><span className="text-xs font-normal text-slate-500">{inv.notes || ''}</span></td>
                        <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${(inv.type || '').includes('Milk') ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{(inv.type || '')}</span></td>
                        <td className="py-3 px-4 font-black text-emerald-700">₹{(parseFloat(inv.amount) || 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right flex justify-end gap-2">
                          <button onClick={() => triggerPrintEngine(printObj, 'Invoice')} className="text-blue-500 hover:text-blue-700 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded flex items-center gap-1 border border-blue-200"><Printer size={12}/> Print</button>
                          <button onClick={()=>handleDeleteRecord('invoices', inv.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    )}) : <tr><td colSpan="6" className="py-8 text-center text-slate-400 font-medium">No invoices generated yet.</td></tr>}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
             <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Users className="text-blue-600" size={20} /> Register Staff</h2>
             <form onSubmit={handleAddEmployee} className="space-y-4">
               <div><label className="block text-xs font-bold text-slate-500 mb-1">FULL NAME</label><input type="text" required value={newEmployee.name} onChange={(e)=>setNewEmployee({...newEmployee, name: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ROLE / DESIGNATION</label>
                  <input type="text" list="role-options" required value={newEmployee.role} onChange={(e)=>setNewEmployee({...newEmployee, role: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="Select or type new role..." />
               </div>
               <div><label className="block text-xs font-bold text-slate-500 mb-1">PHONE NUMBER</label><input type="text" value={newEmployee.phone} onChange={(e)=>setNewEmployee({...newEmployee, phone: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
               
               <div><label className="block text-xs font-bold text-slate-500 mb-1">AADHAR NUMBER (12 Digits)</label><input type="text" maxLength="12" value={newEmployee.aadhar} onChange={(e)=>setNewEmployee({...newEmployee, aadhar: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="XXXX XXXX XXXX" /></div>
               <div className="p-3 border border-dashed border-slate-300 rounded-lg bg-slate-50">
                 <label className="block text-xs font-bold text-slate-600 mb-2 flex items-center gap-1"><IdCard size={14}/> UPLOAD ID PROOF (PDF/Image)</label>
                 <input type="file" accept="image/*,.pdf" onChange={(e) => setNewEmployee({...newEmployee, idProof: e.target.files[0]})} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
               </div>

               <div><label className="block text-xs font-bold text-slate-500 mb-1">JOIN DATE</label><input type="date" value={newEmployee.joinDate} onChange={(e)=>setNewEmployee({...newEmployee, joinDate: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
               <div><label className="block text-xs font-bold text-slate-500 mb-1">BASE MONTHLY SALARY (₹)</label><input type="number" required value={newEmployee.baseSalary} onChange={(e)=>setNewEmployee({...newEmployee, baseSalary: e.target.value})} className="w-full p-2 border rounded outline-none bg-blue-50 text-blue-800 font-bold" /></div>
               <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-slate-400">{loading ? 'Registering...' : 'Register Employee'}</button>
             </form>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Banknote className="text-blue-600" size={20} /> Staff Directory & Ledger</h2>
             <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 font-bold">Staff Name</th><th className="py-3 px-4 font-bold">Role</th><th className="py-3 px-4 font-bold">Base Salary</th><th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.length > 0 ? employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800">{emp.name || 'Unnamed'}<br/><span className="text-xs text-slate-400 font-normal">{emp.phone || '--'}</span></td>
                      <td className="py-3 px-4 text-sm text-slate-600">{emp.role || '--'}</td>
                      <td className="py-3 px-4 font-bold text-blue-700">₹{(parseFloat(emp.baseSalary)||0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => setSelectedEmployee(emp)} className="text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded text-xs hover:bg-blue-100 mr-2">Open Ledger</button>
                        <button onClick={()=>handleDeleteRecord('employees', emp.id)} className="text-red-400 hover:text-red-600 p-1 align-middle"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan="4" className="py-8 text-center text-slate-400 font-medium">No staff registered yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'legacy' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><PiggyBank className="text-amber-600" size={20} /> Log Capital & Infrastructure</h2>
                <form onSubmit={handleLogCapital} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">CAPITAL TYPE</label>
                    <select value={capitalForm.type} onChange={(e)=>setCapitalForm({...capitalForm, type: e.target.value, source: '', item: '', qty: '', amount: '', interestRate: ''})} className="w-full p-2 border border-slate-300 rounded font-bold outline-none">
                      <option value="Infrastructure">Infrastructure Material (Timber, Cement, etc.)</option>
                      <option value="Investor">Investor Capital / Equity</option>
                      <option value="Capital">Owner Initial Capital</option>
                      <option value="Loan">Bank / Private Loan</option>
                      <option value="Subsidy">Government Subsidy / Grant</option>
                    </select>
                  </div>
                  
                  {capitalForm.type === 'Infrastructure' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">MATERIAL / ITEM</label><input type="text" required value={capitalForm.item} onChange={(e)=>setCapitalForm({...capitalForm, item: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="e.g. Timber Logs" /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">QUANTITY</label><input type="text" required value={capitalForm.qty} onChange={(e)=>setCapitalForm({...capitalForm, qty: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="e.g. 50 CFT" /></div>
                      </div>
                      <div><label className="block text-xs font-bold text-slate-500 mb-1">VENDOR / SUPPLIER</label><input type="text" required value={capitalForm.source} onChange={(e)=>setCapitalForm({...capitalForm, source: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="e.g. SS Traders" /></div>
                    </>
                  )}

                  {(capitalForm.type === 'Investor' || capitalForm.type === 'Capital') && (
                    <>
                      <div><label className="block text-xs font-bold text-slate-500 mb-1">INVESTOR / OWNER NAME</label><input type="text" required value={capitalForm.source} onChange={(e)=>setCapitalForm({...capitalForm, source: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="Name..." /></div>
                      <div><label className="block text-xs font-bold text-slate-500 mb-1">EQUITY / NOTES</label><input type="text" value={capitalForm.item} onChange={(e)=>setCapitalForm({...capitalForm, item: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="e.g. Phase 1 Investment" /></div>
                    </>
                  )}

                  {capitalForm.type === 'Loan' && (
                    <>
                      <div><label className="block text-xs font-bold text-slate-500 mb-1">BANK / LENDER</label><input type="text" required value={capitalForm.source} onChange={(e)=>setCapitalForm({...capitalForm, source: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="e.g. SBI Dairy Loan" /></div>
                    </>
                  )}

                  {capitalForm.type === 'Subsidy' && (
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">GOVERNMENT SCHEME</label><input type="text" required value={capitalForm.source} onChange={(e)=>setCapitalForm({...capitalForm, source: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="e.g. NABARD Subsidy" /></div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">AMOUNT (₹)</label><input type="number" required value={capitalForm.amount} onChange={(e)=>setCapitalForm({...capitalForm, amount: e.target.value})} className="w-full p-2 border rounded outline-none font-bold text-lg" /></div>
                    {capitalForm.type === 'Loan' ? (
                      <div><label className="block text-xs font-bold text-amber-600 mb-1">INTEREST RATE (%)</label><input type="number" step="0.1" required value={capitalForm.interestRate} onChange={(e)=>setCapitalForm({...capitalForm, interestRate: e.target.value})} className="w-full p-2 border border-amber-300 bg-amber-50 rounded outline-none font-bold" /></div>
                    ) : (
                      <div><label className="block text-xs font-bold text-slate-500 mb-1">DATE</label><input type="date" required value={capitalForm.date} onChange={(e)=>setCapitalForm({...capitalForm, date: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
                    )}
                  </div>
                  {capitalForm.type === 'Loan' && (
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">DATE ISSUED</label><input type="date" required value={capitalForm.date} onChange={(e)=>setCapitalForm({...capitalForm, date: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
                  )}
                  <button disabled={loading} className="w-full bg-amber-600 text-white py-2 rounded-lg font-bold hover:bg-amber-700 transition disabled:bg-slate-400">{loading ? 'Saving...' : 'Save Record'}</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><FileSpreadsheet className="text-blue-600" size={20} /> Log Historical P&L</h2>
                <p className="text-xs text-slate-500 mb-4">Enter past monthly data to build your historical database.</p>
                <form onSubmit={handleLogHistoricalData} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">MONTH</label>
                      <select value={historyForm.month} onChange={(e)=>setHistoryForm({...historyForm, month: e.target.value})} className="w-full p-2 border rounded outline-none">
                        {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">YEAR</label><input type="number" required value={historyForm.year} onChange={(e)=>setHistoryForm({...historyForm, year: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-emerald-600 mb-1">TOTAL REVENUE (₹)</label><input type="number" required value={historyForm.revenue} onChange={(e)=>setHistoryForm({...historyForm, revenue: e.target.value})} className="w-full p-2 border border-emerald-200 bg-emerald-50 rounded outline-none font-bold" /></div>
                    <div><label className="block text-xs font-bold text-red-600 mb-1">TOTAL EXPENDITURE (₹)</label><input type="number" required value={historyForm.expenditure} onChange={(e)=>setHistoryForm({...historyForm, expenditure: e.target.value})} className="w-full p-2 border border-red-200 bg-red-50 rounded outline-none font-bold" /></div>
                  </div>
                  <button disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-slate-400">{loading ? 'Saving...' : 'Save Historical Record'}</button>
                </form>
              </div>
            </div>
            
            <div className="space-y-6">
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full">
                 <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Database className="text-emerald-600" size={20} /> Capital Ledger</h2>
                 <div className="overflow-x-auto max-h-[800px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b text-slate-500 uppercase tracking-wider sticky top-0 bg-white">
                        <th className="py-2 px-3">Date</th><th className="py-2 px-3">Type</th><th className="py-2 px-3">Details</th><th className="py-2 px-3 text-right">Amount (₹)</th><th className="py-2 px-3 text-right">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {capitalData.length > 0 ? capitalData.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-bold text-slate-600">{c.date || '--'}</td>
                          <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                            c.type === 'Infrastructure' ? 'bg-slate-100 text-slate-700' :
                            c.type === 'Loan' ? 'bg-amber-100 text-amber-800' :
                            c.type === 'Subsidy' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>{c.type}</span></td>
                          <td className="py-3 px-3 text-slate-600">{c.source} {c.item && `- ${c.item}`}</td>
                          <td className="py-3 px-3 font-black text-right text-slate-800">₹{(parseFloat(c.amount) || 0).toLocaleString()}</td>
                          <td className="py-3 px-3 text-right"><button onClick={()=>handleDeleteRecord('capital_loans', c.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></td>
                        </tr>
                      )) : <tr><td colSpan="5" className="py-8 text-center text-slate-400 font-medium">No capital or infra records found.</td></tr>}
                    </tbody>
                  </table>
                 </div>
               </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}