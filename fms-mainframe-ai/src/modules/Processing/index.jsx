import { useState, useEffect } from 'react';
import { 
  Factory, Beaker, Save, ListPlus, TrendingUp, FlaskConical, Milk, FileText, Calculator, Trash2, CheckCircle, PackageCheck, ArchiveRestore, Coins, ShoppingCart, Box, ArrowRightLeft, Edit, X, Undo, Printer, IndianRupee, Banknote
} from 'lucide-react';
import { collection, addDoc, getDocs, getDoc, serverTimestamp, query, orderBy, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function Processing() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  
  // Data States
  const [internalMilkLogs, setInternalMilkLogs] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [productionRuns, setProductionRuns] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [vapInventory, setVapInventory] = useState([]); 
  const [vapSales, setVapSales] = useState([]); 
  
  // Cross-Reference States for Dropdowns
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  // Live CPL calculation variables
  const [liveFarmCpl, setLiveFarmCpl] = useState(0);

  // Forms & Editing
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [recipeForm, setRecipeForm] = useState({ name: '', yieldQty: '', yieldUnit: 'Kg', rawMilkLiters: '', utilitiesCost: '', laborCost: '', sellingPrice: '' });
  const [recipeIngredients, setRecipeIngredients] = useState([{ id: Date.now(), inventoryId: '', amount: '' }]);
  
  const [runForm, setRunForm] = useState({ recipeId: '', batches: '1', date: new Date().toISOString().split('T')[0], notes: '' });
  
  // Updated Sale Form to include the advanced payment method dropdown
  const [saleForm, setSaleForm] = useState({ productId: '', qty: '', buyer: '', totalValue: '', amountPaid: '', paymentMethod: 'Cash (Driver Collected)', date: new Date().toISOString().split('T')[0] });

  // NEW: VAP Accounting Modal State
  const [vapPaymentModal, setVapPaymentModal] = useState({ show: false, sale: null, amount: '', method: 'Cash (Driver Collected)', date: new Date().toISOString().split('T')[0], notes: '' });

  // Native Invoice Printer State
  const [printingInvoice, setPrintingInvoice] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const internalSnap = await getDocs(query(collection(db, "internal_milk_logs"), orderBy("recorded_at", "desc")));
      setInternalMilkLogs(internalSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const recipeSnap = await getDocs(query(collection(db, "vap_recipes"), orderBy("recorded_at", "desc")));
      setRecipes(recipeSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const runSnap = await getDocs(query(collection(db, "vap_production_logs"), orderBy("date", "desc")));
      setProductionRuns(runSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const invSnap = await getDocs(collection(db, "inventory"));
      setInventory(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const vapInvSnap = await getDocs(collection(db, "vap_inventory"));
      setVapInventory(vapInvSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const vapSalesSnap = await getDocs(query(collection(db, "vap_sales"), orderBy("recorded_at", "desc")));
      setVapSales(vapSalesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const venSnap = await getDocs(collection(db, "vendors"));
      setVendors(venSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const custSnap = await getDocs(collection(db, "customers"));
      setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch Economics data to calculate LIVE CPL
      const currentMonthStr = new Date().toISOString().slice(0, 7);
      const isCurrentMonth = (dateField, timestamp) => {
        if (dateField && dateField.startsWith(currentMonthStr)) return true;
        if (timestamp?.seconds) return new Date(timestamp.seconds * 1000).toISOString().startsWith(currentMonthStr);
        return false;
      };

      const [milk, emp, gFeed, tDress, meds, utils] = await Promise.all([
        getDocs(collection(db, "milk_records")), getDocs(collection(db, "employees")),
        getDocs(collection(db, "group_feed_logs")), getDocs(collection(db, "top_dress_logs")),
        getDocs(collection(db, "medical_records")), getDocs(collection(db, "utility_logs"))
      ]);

      const mtdMilkLiters = milk.docs.map(d=>d.data()).filter(m => (m.date || '').startsWith(currentMonthStr)).reduce((sum, m) => sum + (parseFloat(m.yield_liters) || 0), 0);
      const totalBaseSalaries = emp.docs.map(d=>d.data()).reduce((acc, e) => acc + (parseFloat(e.baseSalary) || 0), 0);
      const currentDay = new Date().getDate();
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const mtdLaborCost = (totalBaseSalaries / daysInMonth) * currentDay;

      const mtdFeedCost = gFeed.docs.map(d=>d.data()).filter(f => isCurrentMonth(null, f.recorded_at)).reduce((sum, f) => sum + (parseFloat(f.total_cost) || 0), 0) +
                          tDress.docs.map(d=>d.data()).filter(f => isCurrentMonth(null, f.recorded_at)).reduce((sum, f) => sum + (parseFloat(f.cost_incurred) || 0), 0);
      const mtdMedsCost = meds.docs.map(d=>d.data()).filter(m => isCurrentMonth(null, m.recorded_at)).reduce((sum, m) => sum + (parseFloat(m.cost_incurred) || 0), 0);
      const mtdUtilsCost = utils.docs.map(d=>d.data()).filter(u => (u.date || '').startsWith(currentMonthStr)).reduce((sum, u) => sum + (parseFloat(u.amount) || 0), 0);

      const mtdTotalFarmCost = mtdLaborCost + mtdFeedCost + mtdMedsCost + mtdUtilsCost;
      const cpl = mtdMilkLiters > 0 ? (mtdTotalFarmCost / mtdMilkLiters) : 28.50; 
      setLiveFarmCpl(cpl);

    } catch (e) { console.error("Error fetching data:", e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  // =========================================================================
  // RAW MILK INVENTORY CALCULATION
  // =========================================================================
  const rawMilkTransferredIn = internalMilkLogs.filter(log => String(log.purpose).includes('R&D') || String(log.purpose).includes('Processing')).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
  const rawMilkUsedInProduction = productionRuns.reduce((sum, run) => sum + (parseFloat(run.total_milk_used) || 0), 0);
  const availableRawMilkStock = rawMilkTransferredIn - rawMilkUsedInProduction;

  const handleDeleteInternalLog = async (id) => {
    if (!window.confirm("Delete this milk transfer log? This will remove the milk from your processing stockpile.")) return;
    try {
      await deleteDoc(doc(db, "internal_milk_logs", id));
      fetchData();
    } catch(e) { alert("Error deleting log."); }
  };

  // =========================================================================
  // RECIPE COSTING ENGINE LOGIC
  // =========================================================================
  const addRecipeIngredient = () => setRecipeIngredients([...recipeIngredients, { id: Date.now(), inventoryId: '', amount: '' }]);
  const removeRecipeIngredient = (id) => setRecipeIngredients(recipeIngredients.filter(row => row.id !== id));
  const updateRecipeIngredient = (id, field, value) => setRecipeIngredients(recipeIngredients.map(row => row.id === id ? { ...row, [field]: value } : row));

  const currentRecipeMilkCost = (parseFloat(recipeForm.rawMilkLiters) || 0) * liveFarmCpl;
  const currentRecipeUtilityCost = parseFloat(recipeForm.utilitiesCost) || 0;
  const currentRecipeLaborCost = parseFloat(recipeForm.laborCost) || 0;
  const currentRecipeIngredientsCost = recipeIngredients.reduce((total, row) => {
    const item = inventory.find(i => i.id === row.inventoryId);
    return item ? total + ((parseFloat(row.amount) || 0) * (parseFloat(item.unit_cost) || 0)) : total;
  }, 0);

  const totalRecipeBatchCost = currentRecipeMilkCost + currentRecipeUtilityCost + currentRecipeLaborCost + currentRecipeIngredientsCost;
  const recipeUnitCost = (parseFloat(recipeForm.yieldQty) || 0) > 0 ? (totalRecipeBatchCost / parseFloat(recipeForm.yieldQty)) : 0;
  const projectedSellingPrice = parseFloat(recipeForm.sellingPrice) || 0;
  const projectedMarginPercent = projectedSellingPrice > 0 ? (((projectedSellingPrice - recipeUnitCost) / projectedSellingPrice) * 100).toFixed(1) : 0;

  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    if (!recipeForm.name || !recipeForm.yieldQty || !recipeForm.rawMilkLiters || !recipeForm.sellingPrice) return alert("Please fill all required recipe fields including Selling Price.");
    
    setLoading(true);
    const recipeData = {
      ...recipeForm,
      sellingPrice: parseFloat(recipeForm.sellingPrice) || 0,
      ingredients: recipeIngredients,
      calculatedBatchCost: totalRecipeBatchCost,
      calculatedUnitCost: recipeUnitCost,
      baseFarmCplAtCreation: liveFarmCpl,
      recorded_at: serverTimestamp()
    };

    try {
      if (editingRecipeId) {
        await updateDoc(doc(db, "vap_recipes", editingRecipeId), recipeData);
        alert("Recipe Profile Updated Successfully!");
      } else {
        await addDoc(collection(db, "vap_recipes"), recipeData);
        alert("New Recipe Profile Created!");
      }
      setEditingRecipeId(null);
      setRecipeForm({ name: '', yieldQty: '', yieldUnit: 'Kg', rawMilkLiters: '', utilitiesCost: '', laborCost: '', sellingPrice: '' });
      setRecipeIngredients([{ id: Date.now(), inventoryId: '', amount: '' }]);
      fetchData();
    } catch (error) { alert("Error saving recipe."); } finally { setLoading(false); }
  };

  const handleEditRecipe = (recipe) => {
    setEditingRecipeId(recipe.id);
    setRecipeForm({
      name: recipe.name, yieldQty: recipe.yieldQty, yieldUnit: recipe.yieldUnit, 
      rawMilkLiters: recipe.rawMilkLiters, utilitiesCost: recipe.utilitiesCost, 
      laborCost: recipe.laborCost, sellingPrice: recipe.sellingPrice
    });
    setRecipeIngredients(recipe.ingredients && recipe.ingredients.length > 0 ? recipe.ingredients : [{ id: Date.now(), inventoryId: '', amount: '' }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRecipe = async (id) => {
    if(!window.confirm("WARNING: Delete this recipe permanently? This will not delete previously produced stock, but will remove the template.")) return;
    try {
      await deleteDoc(doc(db, "vap_recipes", id));
      fetchData();
    } catch(e) { alert("Error deleting recipe."); }
  };

  // =========================================================================
  // PRODUCTION RUN LOGIC
  // =========================================================================
  const selectedRunRecipe = recipes.find(r => r.id === runForm.recipeId);
  const runBatchCount = parseFloat(runForm.batches) || 0;

  const handleExecuteProductionRun = async (e) => {
    e.preventDefault();
    if (!selectedRunRecipe || runBatchCount <= 0) return alert("Select a recipe and valid batch count.");

    const totalMilkNeeded = parseFloat(selectedRunRecipe.rawMilkLiters) * runBatchCount;
    if (totalMilkNeeded > availableRawMilkStock) {
      return alert(`Insufficient Raw Milk! You need ${totalMilkNeeded} L, but only have ${availableRawMilkStock.toFixed(1)} L in Processing Inventory. Please transfer more from Logistics.`);
    }

    for (const ing of selectedRunRecipe.ingredients) {
      if (!ing.inventoryId || !ing.amount) continue;
      const invItem = inventory.find(i => i.id === ing.inventoryId);
      const totalAmountNeeded = parseFloat(ing.amount) * runBatchCount;
      if (!invItem || parseFloat(invItem.current_stock) < totalAmountNeeded) {
        return alert(`Insufficient stock for ${invItem ? invItem.item_name : 'an ingredient'}. You need ${totalAmountNeeded} but only have ${invItem?.current_stock || 0}.`);
      }
    }

    if(!window.confirm(`Execute production? This will consume ${totalMilkNeeded}L of Raw Milk and physical ingredients to create Finished Goods.`)) return;
    
    setLoading(true);
    try {
      for (const ing of selectedRunRecipe.ingredients) {
        if (!ing.inventoryId || !ing.amount) continue;
        const invItem = inventory.find(i => i.id === ing.inventoryId);
        const totalAmountNeeded = parseFloat(ing.amount) * runBatchCount;
        await updateDoc(doc(db, "inventory", invItem.id), { current_stock: parseFloat(invItem.current_stock) - totalAmountNeeded });
      }

      const totalProductionCost = (parseFloat(selectedRunRecipe.calculatedBatchCost) || 0) * runBatchCount;
      const totalYieldGenerated = parseFloat(selectedRunRecipe.yieldQty) * runBatchCount;

      await addDoc(collection(db, "vap_production_logs"), {
        recipe_id: selectedRunRecipe.id,
        recipe_name: selectedRunRecipe.name,
        batches_run: runBatchCount,
        total_milk_used: totalMilkNeeded,
        total_cost_incurred: totalProductionCost,
        total_yield_produced: totalYieldGenerated,
        yield_unit: selectedRunRecipe.yieldUnit,
        date: runForm.date,
        notes: runForm.notes,
        recorded_at: serverTimestamp()
      });

      const existingVapQ = query(collection(db, "vap_inventory"), where("recipe_id", "==", selectedRunRecipe.id));
      const existingVapSnap = await getDocs(existingVapQ);
      
      if (!existingVapSnap.empty) {
        const vapDoc = existingVapSnap.docs[0];
        const newStock = parseFloat(vapDoc.data().current_stock || 0) + totalYieldGenerated;
        await updateDoc(doc(db, "vap_inventory", vapDoc.id), { current_stock: newStock });
      } else {
        await addDoc(collection(db, "vap_inventory"), {
          recipe_id: selectedRunRecipe.id,
          product_name: selectedRunRecipe.name,
          current_stock: totalYieldGenerated,
          unit: selectedRunRecipe.yieldUnit,
          unit_cost: selectedRunRecipe.calculatedUnitCost || 0,
          selling_price: selectedRunRecipe.sellingPrice || 0,
          recorded_at: serverTimestamp()
        });
      }

      alert(`Success! Produced ${totalYieldGenerated} ${selectedRunRecipe.yieldUnit} of ${selectedRunRecipe.name}.`);
      setRunForm({ recipeId: '', batches: '1', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (error) { alert("Error executing run."); } finally { setLoading(false); }
  };

  const handleRevertProductionRun = async (run, isEdit = false) => {
    if (!isEdit && !window.confirm("CRITICAL: This will RETURN ingredients and milk to inventory, and DEDUCT the finished goods from VAP Stock. Proceed?")) return;
    
    setLoading(true);
    try {
      const recipeRef = doc(db, "vap_recipes", run.recipe_id);
      const recipeSnap = await getDoc(recipeRef);
      if (recipeSnap.exists()) {
        const recipe = recipeSnap.data();
        for (const ing of recipe.ingredients) {
          if (!ing.inventoryId || !ing.amount) continue;
          const invRef = doc(db, "inventory", ing.inventoryId);
          const invSnap = await getDoc(invRef);
          if (invSnap.exists()) {
            const totalAmountToRefund = parseFloat(ing.amount) * run.batches_run;
            await updateDoc(invRef, { current_stock: parseFloat(invSnap.data().current_stock) + totalAmountToRefund });
          }
        }
      }

      const vapQ = query(collection(db, "vap_inventory"), where("recipe_id", "==", run.recipe_id));
      const vapSnap = await getDocs(vapQ);
      if (!vapSnap.empty) {
        const vapDoc = vapSnap.docs[0];
        const newStock = Math.max(0, parseFloat(vapDoc.data().current_stock) - run.total_yield_produced);
        await updateDoc(doc(db, "vap_inventory", vapDoc.id), { current_stock: newStock });
      }

      await deleteDoc(doc(db, "vap_production_logs", run.id));
      if (!isEdit) {
        alert("Production run reversed. Raw milk, ingredients, and finished goods have been restocked/deducted.");
        fetchData();
      } else {
        await fetchData(); 
      }
    } catch (error) {
      alert("Error reversing production run.");
    } finally {
      if(!isEdit) setLoading(false);
    }
  };

  const handleEditProductionRun = async (run) => {
    if (!window.confirm("This will reverse the previous run and load its details into the form so you can modify any mistakes. Proceed?")) return;
    await handleRevertProductionRun(run, true);
    setRunForm({ recipeId: run.recipe_id, batches: run.batches_run, date: run.date, notes: run.notes });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // VAP SALES, DISPATCH & ACCOUNTING
  // =========================================================================
  const handleSaleChange = (field, value) => {
    setSaleForm(prev => {
      const newState = { ...prev, [field]: value };
      const product = vapInventory.find(p => p.id === (field === 'productId' ? value : prev.productId));
      if (product && newState.qty && field !== 'totalValue' && field !== 'amountPaid') {
        newState.totalValue = (parseFloat(newState.qty) * (parseFloat(product.selling_price) || 0)).toFixed(2);
        newState.amountPaid = newState.totalValue; // Auto-fill amount paid initially
      }
      return newState;
    });
  };

  // INITIAL DISPATCH LOGIC
  const handleLogVapSale = async (e) => {
    e.preventDefault();
    try {
      const product = vapInventory.find(p => p.id === saleForm.productId);
      if (!product) return alert("Select a product from inventory.");
      
      const sellQty = parseFloat(saleForm.qty);
      if (!sellQty || sellQty <= 0) return alert("Enter a valid quantity to sell.");
      if (sellQty > parseFloat(product.current_stock)) return alert(`Not enough stock! You only have ${product.current_stock} ${product.unit}.`);
      if (!saleForm.buyer) return alert("Please enter a buyer or vendor name.");

      setLoading(true);
      const totalVal = parseFloat(saleForm.totalValue) || 0;
      const cashReceived = parseFloat(saleForm.amountPaid) || 0;
      const amountDueOnCredit = totalVal - cashReceived;

      let linkedRevId = null;
      let linkedInvId = null;

      // 1. Deduct Stock
      await updateDoc(doc(db, "vap_inventory", product.id), { current_stock: parseFloat(product.current_stock) - sellQty });
      
      // 2. THE ECONOMICS BRIDGE: Split transaction based on Cash Received vs Total Value
      if (cashReceived > 0) {
        const revRef = await addDoc(collection(db, "revenue_logs"), {
          type: `VAP Sale Cash (${product.product_name})`, amount: cashReceived, date: saleForm.date,
          method: saleForm.paymentMethod,
          notes: `Received ${saleForm.paymentMethod} from ${saleForm.buyer}`, recorded_at: serverTimestamp()
        });
        linkedRevId = revRef.id;
      } 
      
      if (amountDueOnCredit > 0) {
        const invNumber = `VAP-${Date.now().toString().slice(-5)}`;
        const invRef = await addDoc(collection(db, "invoices"), {
          invoiceNumber: invNumber, type: 'B2B Farm Produce', customerName: saleForm.buyer,
          amount: amountDueOnCredit, date: saleForm.date, notes: `Pending Credit for ${sellQty} ${product.unit || 'units'} of ${product.product_name}`,
          recorded_at: serverTimestamp()
        });
        linkedInvId = invRef.id;
      }

      // Determine Final Status Tag Automatically
      const finalStatus = amountDueOnCredit <= 0 ? 'Paid in Full' : cashReceived === 0 ? 'On Credit' : 'Partial Payment';

      // 3. Log Initial Sale Locally in Processing
      const newSaleRef = await addDoc(collection(db, "vap_sales"), {
        product_id: product.id, product_name: product.product_name, qty: sellQty, unit: product.unit || 'units',
        buyer: saleForm.buyer, total_value: totalVal, amount_paid: cashReceived, status: finalStatus,
        payment_method: saleForm.paymentMethod,
        linked_revenue_id: linkedRevId, linked_invoice_id: linkedInvId,
        date: saleForm.date, recorded_at: serverTimestamp()
      });

      // Prompt Print View automatically after successful save
      const saleToPrint = {
        id: newSaleRef.id, product_name: product.product_name, qty: sellQty, unit: product.unit || 'units',
        buyer: saleForm.buyer, total_value: totalVal, amount_paid: cashReceived, date: saleForm.date
      };
      
      alert(`Sale Logged Successfully! Inventory reduced.`);
      setSaleForm({ productId: '', qty: '', buyer: '', totalValue: '', amountPaid: '', paymentMethod: 'Cash (Driver Collected)', date: new Date().toISOString().split('T')[0] });
      fetchData();
      
      if(window.confirm("Would you like to print the PDF Invoice for this dispatch?")) {
        setPrintingInvoice(saleToPrint);
      }

    } catch (err) { alert(`Error logging sale: ${err.message}`); } finally { setLoading(false); }
  };

  // NEW: ACCOUNTING LOGIC (LOG SUBSEQUENT PAYMENTS)
  const handleLogVapPayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const sale = vapPaymentModal.sale;
      const paymentAmt = parseFloat(vapPaymentModal.amount) || 0;
      if (paymentAmt <= 0) return alert("Enter valid amount");

      const currentPaid = parseFloat(sale.amount_paid) || 0;
      const totalVal = parseFloat(sale.total_value) || 0;
      const newTotalPaid = currentPaid + paymentAmt;
      const newStatus = newTotalPaid >= totalVal ? 'Paid in Full' : 'Partial Payment';

      // 1. Update the local Sale record
      await updateDoc(doc(db, "vap_sales", sale.id), {
        amount_paid: newTotalPaid,
        status: newStatus
      });

      // 2. Add to Master Revenue Logs in Economics
      await addDoc(collection(db, "revenue_logs"), {
        type: `VAP Ledger Payment (${sale.product_name})`, 
        amount: paymentAmt, 
        date: vapPaymentModal.date,
        method: vapPaymentModal.method,
        notes: `Collected ${vapPaymentModal.method} from ${sale.buyer} for Inv VAP-${sale.id.slice(-5).toUpperCase()}`, 
        recorded_at: serverTimestamp()
      });

      alert(`₹${paymentAmt} payment logged successfully to ${sale.buyer}'s account!`);
      setVapPaymentModal({ show: false, sale: null, amount: '', method: 'Cash (Driver Collected)', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (err) { alert(`Error logging payment: ${err.message}`); } finally { setLoading(false); }
  };

  // REVERT SALE (ERROR CORRECTION)
  const handleRevertVapSale = async (sale, isEdit = false) => {
    if (!isEdit && !window.confirm("CRITICAL: Reversing this sale will RETURN the product to VAP Inventory and DELETE the financial revenue/invoice logs. Proceed?")) return;
    
    setLoading(true);
    try {
      // 1. Restock VAP Inventory
      const vapRef = doc(db, "vap_inventory", sale.product_id);
      const vapSnap = await getDoc(vapRef);
      if (vapSnap.exists()) {
        await updateDoc(vapRef, { current_stock: parseFloat(vapSnap.data().current_stock) + parseFloat(sale.qty) });
      }

      // 2. Delete linked financials in Economics
      if (sale.linked_revenue_id) await deleteDoc(doc(db, "revenue_logs", sale.linked_revenue_id));
      if (sale.linked_invoice_id) await deleteDoc(doc(db, "invoices", sale.linked_invoice_id));

      // 3. Delete Sale Log
      await deleteDoc(doc(db, "vap_sales", sale.id));
      
      if (!isEdit) {
        alert("Sale reversed successfully. Goods restocked and financials wiped.");
        fetchData();
      } else {
        await fetchData(); 
      }
    } catch(e) {
      alert("Error reversing sale.");
    } finally {
      if(!isEdit) setLoading(false);
    }
  };

  const handleEditVapSale = async (sale) => {
    if (!window.confirm("This is for correcting errors (e.g. wrong item or quantity). This will reverse the dispatch and load it back into the form. To log a new payment, use the 'Log Pay' button instead. Proceed with Edit?")) return;
    await handleRevertVapSale(sale, true);
    setSaleForm({ 
      productId: sale.product_id, 
      qty: sale.qty, 
      buyer: sale.buyer, 
      totalValue: sale.total_value, 
      amountPaid: sale.amount_paid || sale.total_value, 
      paymentMethod: sale.payment_method || 'Cash (Driver Collected)', 
      date: sale.date 
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // NATIVE PDF INVOICE TEMPLATE GENERATOR
  if (printingInvoice) {
    return (
      <div className="bg-slate-100 min-h-screen p-10 print:p-0 absolute inset-0 z-[100]">
        <div className="print:hidden max-w-4xl mx-auto mb-6 flex gap-4 justify-end">
          <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded shadow flex items-center gap-2"><Printer size={18}/> Print / Save as PDF</button>
          <button onClick={() => setPrintingInvoice(null)} className="bg-white text-slate-600 hover:bg-slate-50 font-bold py-2 px-6 rounded shadow border border-slate-200">Close Window</button>
        </div>
        
        <div className="max-w-4xl mx-auto bg-white p-16 shadow-2xl print:shadow-none print:p-0">
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-8">
            <div className="flex gap-6 items-center">
              <div className="w-24 h-24 bg-slate-100 border-2 border-dashed border-slate-300 text-slate-400 font-bold flex items-center justify-center text-xs text-center p-2">FARM<br/>LOGO</div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">YOUR DAIRY FARM</h1>
                <p className="text-slate-600 font-medium">123 Agriculture Way, Farming District</p>
                <p className="text-slate-600 font-medium">Phone: +91 9876543210</p>
                <p className="text-slate-600 font-medium">GSTIN: XXXXXXXXXXXXXXX</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-4xl font-black text-slate-200 uppercase tracking-widest">Invoice</h2>
              <p className="font-bold text-slate-800 mt-2">Inv #: VAP-{printingInvoice.id.slice(-6).toUpperCase()}</p>
              <p className="text-slate-600">Date: {printingInvoice.date}</p>
            </div>
          </div>

          <div className="mt-12 mb-12">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Billed To:</p>
            <p className="text-2xl font-black text-slate-800">{printingInvoice.buyer}</p>
          </div>

          <table className="w-full text-left border-collapse mb-12">
            <thead>
              <tr className="bg-slate-100 text-slate-800 uppercase text-xs tracking-wider border-y-2 border-slate-800">
                <th className="py-4 px-4 font-bold">Item Description</th>
                <th className="py-4 px-4 font-bold text-center">Quantity</th>
                <th className="py-4 px-4 font-bold text-right">Rate</th>
                <th className="py-4 px-4 font-bold text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="border-b-2 border-slate-800">
              <tr>
                <td className="py-6 px-4 font-bold text-slate-800 text-lg">{printingInvoice.product_name}</td>
                <td className="py-6 px-4 text-center font-bold text-slate-600">{printingInvoice.qty} <span className="text-xs">{printingInvoice.unit}</span></td>
                <td className="py-6 px-4 text-right text-slate-600 font-medium">₹{((Number(printingInvoice.total_value)||0) / (Number(printingInvoice.qty)||1)).toFixed(2)}</td>
                <td className="py-6 px-4 text-right font-black text-slate-900 text-lg">₹{(Number(printingInvoice.total_value)||0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end mb-16">
            <div className="w-1/2 space-y-3">
              <div className="flex justify-between text-slate-600 font-bold text-lg"><p>Subtotal:</p><p>₹{(Number(printingInvoice.total_value)||0).toLocaleString()}</p></div>
              <div className="flex justify-between text-emerald-600 font-bold border-b border-slate-300 pb-3"><p>Total Payments Received:</p><p>- ₹{(Number(printingInvoice.amount_paid)||0).toLocaleString()}</p></div>
              <div className="flex justify-between text-slate-900 font-black text-2xl pt-2"><p>Balance Due:</p><p>₹{((Number(printingInvoice.total_value)||0) - (Number(printingInvoice.amount_paid)||0)).toLocaleString()}</p></div>
            </div>
          </div>

          <div className="border-t-2 border-slate-200 pt-8 flex justify-between items-end text-sm text-slate-500 font-medium">
            <div>
              <p className="font-bold text-slate-700 mb-1">Terms & Conditions:</p>
              <p>1. Payment is due within 15 days of invoice date.</p>
              <p>2. Agricultural products exempt under Section 10(1).</p>
            </div>
            <div className="text-center">
              <div className="w-48 border-b-2 border-slate-800 mb-2 mt-12"></div>
              <p className="font-bold text-slate-800">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculations
  const totalRnDMilk = internalMilkLogs.filter(log => String(log.purpose).includes('R&D') || String(log.purpose).includes('Processing')).reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);
  const totalVapSalesRevenue = vapSales.reduce((sum, sale) => sum + (parseFloat(sale.total_value) || 0), 0);
  const totalVapInventoryValue = vapInventory.reduce((sum, item) => sum + ((parseFloat(item.current_stock) || 0) * (parseFloat(item.selling_price) || 0)), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* DATALIST FOR VENDOR/BUYER AUTOCOMPLETE */}
      <datalist id="buyer-list">
        {customers.map(c => <option key={`c-${c.id}`} value={c.name} />)}
        {vendors.map(v => <option key={`v-${v.id}`} value={v.name} />)}
      </datalist>

      {/* VAP PAYMENT ACCOUNTING MODAL */}
      {vapPaymentModal.show && vapPaymentModal.sale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Banknote size={18}/> Log Customer Payment</h3>
              <button onClick={() => setVapPaymentModal({show: false, sale: null, amount: '', method: 'Cash (Driver Collected)', date: '', notes: ''})} className="hover:text-emerald-200"><X size={20}/></button>
            </div>
            <form onSubmit={handleLogVapPayment} className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Buyer / Vendor</p>
                <p className="text-lg font-black text-slate-800">{vapPaymentModal.sale.buyer}</p>
                <p className="text-sm font-bold text-red-600 mt-1">Pending Balance: ₹{((Number(vapPaymentModal.sale.total_value)||0) - (Number(vapPaymentModal.sale.amount_paid)||0)).toLocaleString()} Due</p>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-emerald-700 mb-1">AMOUNT RECEIVED (₹)</label>
                <input type="number" step="any" required value={vapPaymentModal.amount} onChange={(e) => setVapPaymentModal({...vapPaymentModal, amount: e.target.value})} className="w-full text-2xl font-black p-3 border border-emerald-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50 text-emerald-900" placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">PAYMENT METHOD</label>
                  <select value={vapPaymentModal.method} onChange={(e) => setVapPaymentModal({...vapPaymentModal, method: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none bg-white font-bold text-slate-700">
                    <option value="Cash (Driver Collected)">Cash (Driver Collected)</option>
                    <option value="App / Online Verified">App / Online Verified</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">DATE RECEIVED</label>
                  <input type="date" required value={vapPaymentModal.date} onChange={(e) => setVapPaymentModal({...vapPaymentModal, date: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold text-slate-700" />
                </div>
              </div>
              <button disabled={loading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow-lg transition mt-2 disabled:bg-slate-400">
                {loading ? 'Processing...' : 'Verify & Log Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Factory className="text-purple-600 w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Dairy Processing & R&D</h1>
            <p className="text-sm text-slate-500">Value-added products (VAP), recipe economics, inventory, and sales.</p>
          </div>
        </div>
        
        <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
          <button onClick={() => setActiveTab('dashboard')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'dashboard' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>VAP Dashboard</button>
          <button onClick={() => setActiveTab('rnd')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'rnd' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Raw Milk Stockpile</button>
          <button onClick={() => setActiveTab('recipes')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'recipes' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Recipe Costing Engine</button>
          <button onClick={() => setActiveTab('production')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'production' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>Production Runs</button>
          <button onClick={() => setActiveTab('vap_sales')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'vap_sales' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-800 whitespace-nowrap'}`}>VAP Inventory & Sales</button>
        </div>
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-purple-50 border border-purple-200 p-6 rounded-xl shadow-sm text-center">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-1">Live Farm CPL</p>
              <p className="text-3xl font-black text-purple-900">₹{(Number(liveFarmCpl)||0).toFixed(2)}</p>
              <p className="text-[10px] text-purple-600 mt-1">Raw milk transfer cost</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl shadow-sm text-center">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">Available Raw Milk</p>
              <p className="text-3xl font-black text-blue-900">{(Number(availableRawMilkStock)||0).toFixed(1)} L</p>
              <p className="text-[10px] text-blue-600 mt-1">Ready for Processing/R&D</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl shadow-sm text-center">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1">Total VAP Sales</p>
              <p className="text-3xl font-black text-emerald-900">₹{Number(totalVapSalesRevenue||0).toLocaleString()}</p>
              <p className="text-[10px] text-emerald-600 mt-1">Billed revenue from finished goods</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-xl shadow-sm text-center">
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-1">VAP Stock Value</p>
              <p className="text-3xl font-black text-indigo-900">₹{Number(totalVapInventoryValue||0).toLocaleString()}</p>
              <p className="text-[10px] text-indigo-600 mt-1">Potential retail value of inventory</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp className="text-purple-600"/> Recipe Library & Margins</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.map(recipe => (
                <div key={recipe.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition">
                  <h3 className="font-black text-slate-800 text-lg">{recipe.name}</h3>
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-slate-500">Yield per batch:</span>
                    <span className="font-bold text-slate-700">{recipe.yieldQty} {recipe.yieldUnit}</span>
                  </div>
                  <div className="flex justify-between mt-1 text-sm border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Milk Required:</span>
                    <span className="font-bold text-blue-600">{recipe.rawMilkLiters} L</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-50 p-2 rounded">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Unit Cost</span>
                      <span className="font-black text-red-500 text-lg">₹{(Number(recipe.calculatedUnitCost) || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block">Margin</span>
                      <span className="font-black text-emerald-600 text-lg">{(Number(recipe.sellingPrice) || 0) > 0 ? ((((Number(recipe.sellingPrice) || 0) - (Number(recipe.calculatedUnitCost) || 0)) / (Number(recipe.sellingPrice) || 0)) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                </div>
              ))}
              {recipes.length === 0 && <div className="col-span-3 text-center py-12 text-slate-400 font-medium border-2 border-dashed rounded-xl">No recipes built yet. Head to the Costing Engine.</div>}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RAW MILK STOCKPILE / R&D */}
      {activeTab === 'rnd' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2"><Milk size={24}/> Processing & R&D Milk Stockpile</h2>
                <p className="text-sm text-slate-500 mt-1">Milk transferred from Logistics into the Factory Floor for value-addition or testing.</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Milk Currently Available</p>
                <p className="text-4xl font-black text-blue-600">{(Number(availableRawMilkStock)||0).toFixed(1)} L</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-bold">Date & Shift</th>
                    <th className="py-3 px-4 font-bold">Category</th>
                    <th className="py-3 px-4 font-bold text-center border-l border-slate-200">Volume (Liters)</th>
                    <th className="py-3 px-4 font-bold text-right border-l border-slate-200">Capital Value (₹)</th>
                    <th className="py-3 px-4 font-bold">Transfer Notes</th>
                    <th className="py-3 px-4 font-bold text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {internalMilkLogs.filter(l => String(l.purpose).includes('R&D') || String(l.purpose).includes('Processing')).map(log => (
                    <tr key={log.id} className="hover:bg-blue-50/30 transition">
                      <td className="py-3 px-4 font-bold text-slate-800">{new Date(log.recorded_at?.seconds * 1000).toLocaleDateString()} <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded ml-1">{log.shift}</span></td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-blue-100 text-blue-800 border border-blue-200">{log.purpose}</span></td>
                      <td className="py-3 px-4 text-center font-black text-blue-600 border-l border-slate-100">+{log.qty} L</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-600 border-l border-slate-100">₹{(Number(log.qty || 0) * Number(liveFarmCpl || 0)).toFixed(2)}</td>
                      <td className="py-3 px-4 text-slate-500 italic text-xs">{log.notes || 'Transferred from Logistics Hub'}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => handleDeleteInternalLog(log.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                  {internalMilkLogs.filter(l => String(l.purpose).includes('R&D') || String(l.purpose).includes('Processing')).length === 0 && <tr><td colSpan="6" className="py-12 text-center text-slate-400 font-medium">No milk transferred. Use the Logistics tab to send milk to Processing.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RECIPE COSTING ENGINE */}
      {activeTab === 'recipes' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Calculator className="text-purple-600" /> {editingRecipeId ? 'Edit Product Recipe' : 'New Product Recipe Calculator'}</h2>
                  {editingRecipeId && <button onClick={() => {setEditingRecipeId(null); setRecipeForm({ name: '', yieldQty: '', yieldUnit: 'Kg', rawMilkLiters: '', utilitiesCost: '', laborCost: '', sellingPrice: '' }); setRecipeIngredients([{ id: Date.now(), inventoryId: '', amount: '' }]);}} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>}
                </div>
                <form onSubmit={handleSaveRecipe} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">PRODUCT NAME</label><input type="text" required value={recipeForm.name} onChange={(e)=>setRecipeForm({...recipeForm, name: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="e.g. Farm Fresh Paneer" /></div>
                    <div className="flex gap-2">
                      <div className="w-2/3"><label className="block text-xs font-bold text-slate-500 mb-1">BATCH YIELD</label><input type="number" step="0.1" required value={recipeForm.yieldQty} onChange={(e)=>setRecipeForm({...recipeForm, yieldQty: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="e.g. 1" /></div>
                      <div className="w-1/3"><label className="block text-xs font-bold text-slate-500 mb-1">UNIT</label><select value={recipeForm.yieldUnit} onChange={(e)=>setRecipeForm({...recipeForm, yieldUnit: e.target.value})} className="w-full p-2 border rounded outline-none"><option>Kg</option><option>Liters</option><option>Boxes</option></select></div>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="grid grid-cols-2 gap-4 items-center">
                      <div><label className="block text-xs font-bold text-blue-800 mb-1">RAW MILK REQUIRED PER BATCH (Liters)</label><input type="number" step="0.1" required value={recipeForm.rawMilkLiters} onChange={(e)=>setRecipeForm({...recipeForm, rawMilkLiters: e.target.value})} className="w-full p-2 border border-blue-300 rounded outline-none font-bold text-blue-900" placeholder="Liters" /></div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Calculated Milk Cost</p>
                        <p className="text-2xl font-black text-blue-700">₹{(Number(currentRecipeMilkCost)||0).toFixed(2)}</p>
                        <p className="text-[10px] text-blue-600 font-bold">Based on live Farm CPL (₹{(Number(liveFarmCpl)||0).toFixed(2)})</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                    <h3 className="font-bold text-slate-700 text-sm border-b pb-2 flex items-center gap-2"><ListPlus size={16}/> Additional Ingredients & Packaging</h3>
                    {recipeIngredients.map((row) => {
                      const selectedInv = inventory.find(i => i.id === row.inventoryId);
                      const rowCost = selectedInv ? ((parseFloat(row.amount) || 0) * (parseFloat(selectedInv.unit_cost) || 0)).toFixed(2) : '0.00';
                      return (
                        <div key={row.id} className="flex gap-2 items-center bg-white p-2 rounded border border-slate-200 shadow-sm">
                          <select value={row.inventoryId} onChange={(e) => updateRecipeIngredient(row.id, 'inventoryId', e.target.value)} className="flex-1 border p-2 rounded text-sm outline-none">
                            <option value="">-- Master Inventory Item --</option>
                            {inventory.map(inv => (
                              <option key={inv.id} value={inv.id}>{inv.item_name} {inv.brand ? `(${inv.brand})` : ''} - ₹{(Number(inv.unit_cost)||0).toFixed(2)}/{inv.unit}</option>
                            ))}
                          </select>
                          <input type="number" step="0.01" value={row.amount} onChange={(e) => updateRecipeIngredient(row.id, 'amount', e.target.value)} className="w-24 border p-2 rounded text-sm outline-none" placeholder="Qty" />
                          <div className="w-20 text-right text-slate-700 font-bold text-sm">₹{rowCost}</div>
                          <button type="button" onClick={() => removeRecipeIngredient(row.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                        </div>
                      );
                    })}
                    <button type="button" onClick={addRecipeIngredient} className="text-blue-600 text-sm font-bold hover:text-blue-800">+ Add Inventory Item</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">UTILITIES (Gas/Elec) (₹)</label><input type="number" value={recipeForm.utilitiesCost} onChange={(e)=>setRecipeForm({...recipeForm, utilitiesCost: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="₹" /></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">PROCESSING LABOR (₹)</label><input type="number" value={recipeForm.laborCost} onChange={(e)=>setRecipeForm({...recipeForm, laborCost: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="₹" /></div>
                    <div><label className="block text-xs font-bold text-emerald-600 mb-1">TARGET SELLING PRICE (₹)</label><input type="number" required value={recipeForm.sellingPrice} onChange={(e)=>setRecipeForm({...recipeForm, sellingPrice: e.target.value})} className="w-full p-2 border border-emerald-300 bg-emerald-50 rounded outline-none font-bold text-emerald-900" placeholder={`₹ per ${recipeForm.yieldUnit}`} /></div>
                  </div>

                  <button disabled={loading} type="submit" className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition shadow flex items-center justify-center gap-2 disabled:bg-slate-400">
                    <Save size={18}/> {loading ? 'Saving...' : editingRecipeId ? 'Update Recipe Profile' : 'Save Recipe Profile'}
                  </button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp className="text-purple-600"/> Master Recipe Library</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50 border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4 font-bold">Product Name</th>
                        <th className="py-3 px-4 font-bold">Batch Yield</th>
                        <th className="py-3 px-4 font-bold text-right text-red-500">Unit Cost</th>
                        <th className="py-3 px-4 font-bold text-right text-emerald-600">Sell Price</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recipes.map(recipe => (
                        <tr key={recipe.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-black text-slate-800">{recipe.name}</td>
                          <td className="py-3 px-4 font-bold text-slate-600">{recipe.yieldQty} {recipe.yieldUnit}</td>
                          <td className="py-3 px-4 text-right font-bold text-red-500">₹{(Number(recipe.calculatedUnitCost) || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600">₹{(Number(recipe.sellingPrice) || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right flex items-center justify-end gap-2">
                            <button onClick={() => handleEditRecipe(recipe)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded flex items-center gap-1 font-bold"><Edit size={12}/> Modify</button>
                            <button onClick={() => handleDeleteRecipe(recipe.id)} className="text-red-400 hover:text-red-600 p-1.5 bg-red-50 rounded"><Trash2 size={14}/></button>
                          </td>
                        </tr>
                      ))}
                      {recipes.length === 0 && <tr><td colSpan="5" className="py-12 text-center text-slate-400 font-medium">No recipes built yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6 flex flex-col">
              <div className="bg-emerald-900 p-6 rounded-xl shadow-lg text-white border border-emerald-800">
                <h2 className="text-sm font-bold text-emerald-300 uppercase tracking-widest mb-4 text-center"><CheckCircle size={16} className="inline mr-1"/> Recipe Economics</h2>
                
                <div className="space-y-3 mb-6 border-b border-emerald-700 pb-4">
                  <div className="flex justify-between text-sm"><span className="text-emerald-200">Raw Milk Cost</span><span className="font-bold">₹{(Number(currentRecipeMilkCost)||0).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-emerald-200">Ingredients & Pkg</span><span className="font-bold">₹{(Number(currentRecipeIngredientsCost)||0).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-emerald-200">Utilities</span><span className="font-bold">₹{(Number(currentRecipeUtilityCost)||0).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-emerald-200">Labor</span><span className="font-bold">₹{(Number(currentRecipeLaborCost)||0).toFixed(2)}</span></div>
                </div>

                <div className="text-center mb-6">
                  <p className="text-[10px] text-emerald-300 uppercase tracking-widest mb-1">Total Batch Cost</p>
                  <p className="text-3xl font-black">₹{(Number(totalRecipeBatchCost)||0).toFixed(2)}</p>
                </div>
                
                <div className="bg-emerald-800 p-4 rounded-lg flex justify-between items-center">
                   <div>
                     <p className="text-[10px] text-emerald-200 uppercase tracking-widest mb-1">Cost Per {recipeForm.yieldUnit || 'Unit'}</p>
                     <p className="text-2xl font-black text-rose-300">₹{(Number(recipeUnitCost)||0).toFixed(2)}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[10px] text-emerald-200 uppercase tracking-widest mb-1">Gross Margin</p>
                     <p className="text-2xl font-black text-emerald-400">{(Number(projectedMarginPercent)||0).toFixed(1)}%</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PRODUCTION RUNS */}
      {activeTab === 'production' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><PackageCheck className="text-purple-600"/> Execute Production Run</h2>
              <form onSubmit={handleExecuteProductionRun} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">SELECT RECIPE</label>
                  <select required value={runForm.recipeId} onChange={(e)=>setRunForm({...runForm, recipeId: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold text-purple-800">
                    <option value="">-- Choose Recipe --</option>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.name} (Yields {r.yieldQty}{r.yieldUnit})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">BATCHES</label><input type="number" step="0.1" required value={runForm.batches} onChange={(e)=>setRunForm({...runForm, batches: e.target.value})} className="w-full p-2 border border-purple-300 bg-purple-50 text-purple-900 rounded outline-none font-bold" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">DATE</label><input type="date" required value={runForm.date} onChange={(e)=>setRunForm({...runForm, date: e.target.value})} className="w-full p-2 border rounded outline-none" /></div>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">BATCH NOTES / EXPIRY</label><input type="text" value={runForm.notes} onChange={(e)=>setRunForm({...runForm, notes: e.target.value})} className="w-full p-2 border rounded outline-none" placeholder="Lot #, Expiry..." /></div>
                
                {selectedRunRecipe && (
                  <div className="bg-slate-50 p-4 rounded border border-slate-200 text-sm space-y-2">
                    <p className="font-bold text-slate-700 border-b pb-2 flex justify-between">Execution Preview <span className={parseFloat(selectedRunRecipe.rawMilkLiters) * runBatchCount > availableRawMilkStock ? 'text-red-500' : 'text-emerald-500'}>{(Number(availableRawMilkStock)||0).toFixed(1)} L Stock Avail.</span></p>
                    <div className="flex justify-between"><span className="text-slate-500">Output Generated:</span><span className="font-bold text-emerald-600">{(parseFloat(selectedRunRecipe.yieldQty) * runBatchCount).toFixed(2)} {selectedRunRecipe.yieldUnit}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Milk Consumed:</span><span className="font-bold text-blue-600">{(parseFloat(selectedRunRecipe.rawMilkLiters) * runBatchCount).toFixed(2)} L</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Total Cost Incurred:</span><span className="font-bold text-red-600">₹{((parseFloat(selectedRunRecipe.calculatedBatchCost)||0) * runBatchCount).toFixed(2)}</span></div>
                    <p className="text-[10px] text-amber-600 font-bold uppercase mt-2 pt-2 border-t text-center leading-tight">Warning: This will permanently deduct physical ingredients from Master Inventory.</p>
                  </div>
                )}
                
                <button disabled={loading} type="submit" className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition shadow disabled:bg-slate-400">Execute & Stock Inventory</button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><ArchiveRestore className="text-purple-600"/> Production History Ledger</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 font-bold">Date & Product</th>
                      <th className="py-3 px-4 font-bold text-center">Batches</th>
                      <th className="py-3 px-4 font-bold text-center border-l border-slate-200">Milk Used</th>
                      <th className="py-3 px-4 font-bold text-center text-emerald-600 border-l border-slate-200">Total Yield</th>
                      <th className="py-3 px-4 font-bold text-right text-red-600 border-l border-slate-200">Capital Cost</th>
                      <th className="py-3 px-4 font-bold text-right border-l border-slate-200">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {productionRuns.map(run => (
                      <tr key={run.id} className="hover:bg-purple-50/30 transition">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-700">{run.date}</p>
                          <p className="font-black text-purple-700">{run.recipe_name}</p>
                          {run.notes && <p className="text-[10px] text-slate-500 mt-1">{run.notes}</p>}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-600">{run.batches_run}</td>
                        <td className="py-3 px-4 text-center font-bold text-blue-600 border-l border-slate-100">{run.total_milk_used} L</td>
                        <td className="py-3 px-4 text-center font-black text-emerald-600 border-l border-slate-100 bg-emerald-50/30">{run.total_yield_produced} <span className="text-xs font-normal">{run.yield_unit}</span></td>
                        <td className="py-3 px-4 text-right font-black text-red-600 border-l border-slate-100">₹{(Number(run.total_cost_incurred)||0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right border-l border-slate-100 flex flex-col items-end gap-1">
                          <button onClick={() => handleEditProductionRun(run)} className="text-blue-500 hover:text-blue-700 font-bold bg-blue-50 px-2 py-1 rounded flex items-center justify-end gap-1 w-full" title="Reverse & Edit to fix typos"><Edit size={12}/> Modify</button>
                          <button onClick={() => handleRevertProductionRun(run)} className="text-red-400 hover:text-red-600 font-bold bg-red-50 px-2 py-1 rounded flex items-center justify-end gap-1 w-full" title="Delete Production Run & Restore Inventory"><Undo size={12}/> Delete</button>
                        </td>
                      </tr>
                    ))}
                    {productionRuns.length === 0 && <tr><td colSpan="6" className="py-12 text-center text-slate-400 font-medium">No production runs recorded.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: VAP INVENTORY & SALES */}
      {activeTab === 'vap_sales' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Box className="text-purple-600"/> Master Finished Goods Inventory</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-bold">Product Name</th>
                    <th className="py-3 px-4 font-bold text-center border-l border-slate-200">Current Stock</th>
                    <th className="py-3 px-4 font-bold text-right border-l border-slate-200">Est. Unit Cost</th>
                    <th className="py-3 px-4 font-bold text-right text-emerald-600">Target Sell Price</th>
                    <th className="py-3 px-4 font-bold text-right border-l border-slate-200 text-indigo-600">Total Stock Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {vapInventory.filter(i => parseFloat(i.current_stock) > 0).map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-black text-slate-800">{item.product_name}</td>
                      <td className="py-3 px-4 text-center font-black text-blue-600 border-l border-slate-100 bg-blue-50/30">{(Number(item.current_stock)||0).toFixed(2)} <span className="text-xs font-normal">{item.unit}</span></td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600 border-l border-slate-100">₹{(Number(item.unit_cost)||0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600">₹{(Number(item.selling_price)||0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-black text-indigo-600 border-l border-slate-100 bg-indigo-50/30">₹{((Number(item.current_stock)||0) * (Number(item.selling_price)||0)).toLocaleString()}</td>
                    </tr>
                  ))}
                  {vapInventory.filter(i => parseFloat(i.current_stock) > 0).length === 0 && <tr><td colSpan="5" className="py-12 text-center text-slate-400 font-medium">No finished goods in stock. Execute a production run first.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><ShoppingCart className="text-emerald-600"/> Dispatch & Sell Product</h2>
              <form onSubmit={handleLogVapSale} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">SELECT FINISHED PRODUCT</label>
                  <select required value={saleForm.productId} onChange={(e) => handleSaleChange('productId', e.target.value)} className="w-full p-2 border border-slate-300 rounded outline-none font-bold text-slate-800">
                    <option value="">-- Choose Item in Stock --</option>
                    {vapInventory.filter(i => parseFloat(i.current_stock) > 0).map(item => <option key={item.id} value={item.id}>{item.product_name} (Avail: {item.current_stock}{item.unit})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">QUANTITY TO SELL</label><input type="number" step="0.1" required value={saleForm.qty} onChange={(e) => handleSaleChange('qty', e.target.value)} className="w-full p-2 border border-slate-300 rounded outline-none font-bold" placeholder="Qty" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">DATE OF DISPATCH</label><input type="date" required value={saleForm.date} onChange={(e) => handleSaleChange('date', e.target.value)} className="w-full p-2 border rounded outline-none" /></div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">BUYER / VENDOR NAME</label>
                  <input type="text" list="buyer-list" required value={saleForm.buyer} onChange={(e) => handleSaleChange('buyer', e.target.value)} className="w-full p-2 border rounded outline-none" placeholder="Company or Individual..." />
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <label className="block text-xs font-bold text-emerald-700 mb-1">TOTAL SALE VALUE (₹)</label>
                  <input type="number" required value={saleForm.totalValue} onChange={(e)=>setSaleForm({...saleForm, totalValue: e.target.value})} className="w-full p-2 border border-emerald-300 bg-emerald-50 rounded outline-none font-black text-emerald-900 text-xl" placeholder="0.00" />
                  <p className="text-[10px] text-slate-500 mt-1">Auto-calculated from target price, but you can override for discounts.</p>
                </div>

                <div className="grid grid-cols-2 gap-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-amber-800 mb-1">AMOUNT RECEIVED NOW (₹)</label>
                    <input type="number" step="any" required value={saleForm.amountPaid} onChange={(e)=>setSaleForm({...saleForm, amountPaid: e.target.value})} className="w-full p-2 border border-amber-300 rounded outline-none font-bold text-amber-900" placeholder="Cash received..." />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-amber-800 mb-1">PAYMENT METHOD</label>
                    <select value={saleForm.paymentMethod} onChange={(e)=>setSaleForm({...saleForm, paymentMethod: e.target.value})} className="w-full p-2 border border-amber-300 rounded outline-none font-bold bg-white text-slate-700">
                      <option value="Cash (Driver Collected)">Cash (Driver Collected)</option>
                      <option value="App / Online Verified">App / Online Verified</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                  <p className="col-span-2 text-[10px] text-amber-600 mt-1 font-bold">If Amount Received is less than Total Value, the balance generates an A/R Invoice.</p>
                </div>
                
                <button disabled={loading} type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 transition shadow disabled:bg-slate-400">Log Sale & Generate Invoice</button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><ArrowRightLeft className="text-emerald-600"/> VAP Dispatch & Accounts Receivable</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 font-bold">Date & Product</th>
                      <th className="py-3 px-4 font-bold">Buyer</th>
                      <th className="py-3 px-4 font-bold text-center border-l border-slate-200">Qty Shipped</th>
                      <th className="py-3 px-4 font-bold text-right border-l border-slate-200">Total Value</th>
                      <th className="py-3 px-4 font-bold text-right">Accounting Status</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {vapSales.map(sale => {
                      const balanceDue = (parseFloat(sale.total_value) || 0) - (parseFloat(sale.amount_paid) || 0);
                      
                      return (
                        <tr key={sale.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-700">{sale.date}</p>
                            <p className="font-black text-slate-800">{sale.product_name}</p>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-600">{sale.buyer}</td>
                          <td className="py-3 px-4 text-center font-black text-blue-600 border-l border-slate-100">{sale.qty} <span className="text-xs font-normal">{sale.unit}</span></td>
                          
                          <td className="py-3 px-4 text-right border-l border-slate-100">
                            <div className="font-black text-emerald-600 text-base">₹{(Number(sale.total_value)||0).toLocaleString()}</div>
                            <div className="text-[10px] text-slate-500 font-bold mt-0.5">Paid: ₹{(Number(sale.amount_paid)||0).toLocaleString()}</div>
                          </td>
                          
                          <td className="py-3 px-4 text-right">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${sale.status === 'Paid in Full' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : sale.status === 'Partial Payment' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                              {sale.status}
                            </span>
                            {balanceDue > 0 && <div className="text-[10px] text-red-500 font-bold mt-1 tracking-widest">₹{balanceDue.toLocaleString()} DUE</div>}
                          </td>
                          
                          <td className="py-3 px-4 text-right flex flex-col items-end gap-1">
                            {balanceDue > 0 && (
                              <button onClick={() => setVapPaymentModal({ show: true, sale: sale, amount: balanceDue.toFixed(2), method: 'Cash (Driver Collected)', date: new Date().toISOString().split('T')[0], notes: '' })} className="text-emerald-600 hover:text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded flex items-center justify-end gap-1 ml-auto w-full border border-emerald-200" title="Log a new payment against this balance">
                                <IndianRupee size={12}/> Log Pay
                              </button>
                            )}
                            <button onClick={() => setPrintingInvoice(sale)} className="text-slate-600 hover:text-slate-800 font-bold bg-slate-100 px-2 py-1 rounded flex items-center justify-end gap-1 ml-auto w-full" title="Print Invoice PDF"><Printer size={12}/> Print</button>
                            <button onClick={() => handleEditVapSale(sale)} className="text-blue-500 hover:text-blue-700 font-bold bg-blue-50 px-2 py-1 rounded flex items-center justify-end gap-1 ml-auto w-full" title="Reverse & Edit to fix typos"><Edit size={12}/> Modify</button>
                            <button onClick={() => handleRevertVapSale(sale)} className="text-red-400 hover:text-red-600 font-bold bg-red-50 px-2 py-1 rounded flex items-center justify-end gap-1 ml-auto w-full" title="Reverse Sale, Restore Stock & Remove Financials"><Undo size={12}/> Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                    {vapSales.length === 0 && <tr><td colSpan="6" className="py-12 text-center text-slate-400 font-medium">No sales logged. Dispatch inventory to generate revenue.</td></tr>}
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