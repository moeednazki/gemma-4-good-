import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Droplets, Plus, Save, ClipboardList, Stethoscope, Calendar, 
  Search, ArrowLeft, CalendarHeart, AlertTriangle, Wheat, Calculator, 
  Trash2, Check, ThermometerSun, Baby, Target, FileText, Edit, 
  GitMerge, Syringe, Clock, History, ArrowRightLeft, Sparkles, Brain, X, CloudRain,
  MapPin, Settings
} from 'lucide-react';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { askGemma } from "../../services/AIEngine";

const addDaysToDate = (dateStr, days) => {
  const d = new Date(dateStr + 'T12:00:00Z'); 
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export default function Production() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [cows, setCows] = useState([]);
  const [inventory, setInventory] = useState([]); 
  const [milkRecords, setMilkRecords] = useState([]); 
  const [medicalRecords, setMedicalRecords] = useState([]); 
  const [showAllMilk, setShowAllMilk] = useState(false); 
  const [showAddCow, setShowAddCow] = useState(false);
  
  // Dashboard routing intercepts
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'daily'); 
  const [filterStatus, setFilterStatus] = useState(location.state?.filterStatus || '');
  
  const [selectedCow, setSelectedCow] = useState(null); 
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editCowForm, setEditCowForm] = useState({});

  const [filterBreed, setFilterBreed] = useState('');
  const [filterParity, setFilterParity] = useState('');
  const [filterGender, setFilterGender] = useState('');

  // Live Environment & GPS State
  const [environment, setEnvironment] = useState({ tempCelsius: '...', humidity: '...', season: '...', isLive: false });
  const [lat, setLat] = useState(localStorage.getItem('fms_lat') || '34.2');
  const [lng, setLng] = useState(localStorage.getItem('fms_lng') || '74.8');
  const [showWeatherConfig, setShowWeatherConfig] = useState(false);
  const [latInput, setLatInput] = useState(lat);
  const [lngInput, setLngInput] = useState(lng);

  const [yieldEntryMode, setYieldEntryMode] = useState('bulk'); 
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], cowId: '', yieldLiters: '', shift: 'Morning', healthStatus: 'Healthy' });
  const [bulkFormData, setBulkFormData] = useState({ date: new Date().toISOString().split('T')[0], shift: 'Morning', totalLiters: '' });

  // Yield Adjustment Modal State
  const [yieldAdjustModal, setYieldAdjustModal] = useState({ show: false, amount: '', type: 'Subtract', notes: '' });

  const [newCow, setNewCow] = useState({ 
    id: '', name: '', breed: '', gender: 'Female', status: 'Active', expectedYield: '', birthDate: '', lastParturition: '', 
    parity: '', entryWeight: '', bcs: '', description: '', damId: '', sireId: '',
    source: 'Farm Born', purchaseDate: '', ownerName: '', ownerDetails: '', expectedDueDate: '', failedAIs: 0, nextActionDate: '', nextActionType: ''
  });

  const [medicalForm, setMedicalForm] = useState({ 
    diseaseClassification: '', symptoms: '', prognosis: '', 
    courseDurationDays: '', astReport: '', inventoryId: '', 
    totalDose: '', prescriptionImage: null 
  });

  const [topDressRows, setTopDressRows] = useState([{ id: Date.now(), inventoryId: '', amount: '' }]);
  const [rationCowId, setRationCowId] = useState('');
  const [rationRows, setRationRows] = useState([{ id: Date.now(), inventoryId: '', amount: '' }]);
  const [rationNotes, setRationNotes] = useState('');
  
  // AI NUTRITION STATE
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiNutritionReport, setAiNutritionReport] = useState(null);

  // AI REPRODUCTION STATE
  const [isReproAiLoading, setIsReproAiLoading] = useState(false);
  const [aiReproReport, setAiReproReport] = useState(null);

  const [birthForm, setBirthForm] = useState({ damId: '', sireId: '', dob: new Date().toISOString().split('T')[0], gender: 'Female', breed: '', birthWeight: '', walkingTimeMins: '', colostrumFed: false, healthStatus: 'Healthy', notes: '' });

  const [reproForm, setReproForm] = useState({
    eventType: 'Heat', date: new Date().toISOString().split('T')[0], sireId: '', notes: '',
    pdResult: 'Pregnant', pdInventoryId: '', 
    protocolStep: 'Day0_GnRH', gnrhInventoryId: '', pgfInventoryId: '' 
  });

  const uniqueBreeds = [...new Set(cows.map(c => c.breed).filter(Boolean))];

  const fetchLiveWeather = async (targetLat, targetLng) => {
    const month = new Date().getMonth();
    const seasonCalc = (month >= 2 && month <= 4) ? 'Spring' : (month >= 5 && month <= 7) ? 'Summer' : (month >= 8 && month <= 10) ? 'Autumn' : 'Winter';
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLng}&current=temperature_2m,relative_humidity_2m`);
      if(res.ok) {
        const data = await res.json();
        setEnvironment({ 
          tempCelsius: data.current.temperature_2m.toString(), 
          humidity: data.current.relative_humidity_2m.toString(), 
          season: seasonCalc,
          isLive: true
        });
      } else { throw new Error("Network response was not ok"); }
    } catch (error) {
      console.warn("Weather telemetry offline. Using defaults.");
      setEnvironment({ tempCelsius: '24', humidity: '60', season: seasonCalc, isLive: false });
    }
  };

  const handleSaveLocation = () => {
    localStorage.setItem('fms_lat', latInput);
    localStorage.setItem('fms_lng', lngInput);
    setLat(latInput);
    setLng(lngInput);
    setShowWeatherConfig(false);
    setEnvironment(prev => ({...prev, isLive: false, tempCelsius: '...', humidity: '...'}));
    fetchLiveWeather(latInput, lngInput);
  };

  const fetchData = async () => {
    try {
      const cowQ = query(collection(db, "cows"), orderBy("id", "asc"));
      const cowSnap = await getDocs(cowQ);
      let fetchedCows = cowSnap.docs.map(d => ({ firestoreDocId: d.id, ...d.data() }));

      const todayDate = new Date();
      let dbUpdated = false;

      for (let cow of fetchedCows) {
        if (cow.status === 'Calf' && cow.birthDate) {
          const bDate = new Date(cow.birthDate);
          const ageDays = (todayDate - bDate) / (1000 * 60 * 60 * 24);
          
          if (ageDays >= 180) { 
            const newStatus = cow.gender === 'Female' ? 'Heifer' : 'Bull';
            await updateDoc(doc(db, "cows", cow.firestoreDocId), { status: newStatus });
            
            await addDoc(collection(db, "farm_news"), {
              title: "🐄 Animal Matured!",
              message: `Tag #${cow.id} ${cow.name ? `(${cow.name})` : ''} has reached 6 months of age and automatically progressed from Calf to ${newStatus}.`,
              date: todayDate.toISOString().split('T')[0],
              type: "Milestone",
              recorded_at: serverTimestamp()
            });
            dbUpdated = true;
          }
        }
      }

      if (dbUpdated) {
        const freshCowSnap = await getDocs(cowQ);
        fetchedCows = freshCowSnap.docs.map(d => ({ firestoreDocId: d.id, ...d.data() }));
      }

      setCows(fetchedCows);
      
      const invQ = query(collection(db, "inventory"));
      const invSnap = await getDocs(invQ);
      setInventory(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const milkQ = query(collection(db, "milk_records"), orderBy("recorded_at", "desc"));
      const milkSnap = await getDocs(milkQ);
      setMilkRecords(milkSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const medQ = query(collection(db, "medical_records"), orderBy("recorded_at", "desc"));
      const medSnap = await getDocs(medQ);
      setMedicalRecords(medSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Error fetching data:", e); }
  };

  useEffect(() => {
    fetchData();
    fetchLiveWeather(lat, lng);
  }, []);

  const getCowGroup = (cow) => {
    if (cow.status === 'Dead' || cow.status === 'Sold') return 'Other';
    if (cow.gender === 'Male' && cow.status !== 'Calf') return 'Bull';
    if (cow.status === 'Calf') return 'Calf';
    if (cow.status === 'Heifer') return 'Heifer';
    if (cow.status === 'Dry') return 'Dry';
    if (cow.status === 'Active' || cow.status === 'Sick') {
      const expected = parseFloat(cow.expectedYield) || 0;
      if (expected >= 15) return 'Lactating_High';
      if (expected >= 10 && expected < 15) return 'Lactating_Mid';
      return 'Lactating_Low';
    }
    return 'Other';
  };
  
  const targetCow = cows.find(c => c.id === rationCowId);
  const autoHeadcount = targetCow ? 1 : 0;

  const handleLogIndividualYield = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await addDoc(collection(db, "milk_records"), { 
        type: 'individual', 
        date: formData.date, 
        cow_id: formData.cowId, 
        yield_liters: parseFloat(formData.yieldLiters), 
        shift: formData.shift, 
        health_status: formData.healthStatus, 
        env_temp: environment.tempCelsius, 
        season: environment.season, 
        recorded_at: serverTimestamp() 
      });
      alert("Individual Record Saved!"); 
      setFormData({ ...formData, yieldLiters: '' }); 
      fetchData();
    } catch (e) { alert("Error saving record."); } finally { setLoading(false); }
  };

  const handleLogBulkYield = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await addDoc(collection(db, "milk_records"), { 
        type: 'bulk_total', 
        date: bulkFormData.date, 
        yield_liters: parseFloat(bulkFormData.totalLiters), 
        shift: bulkFormData.shift, 
        env_temp: environment.tempCelsius, 
        season: environment.season, 
        recorded_at: serverTimestamp() 
      });
      alert("Bulk Farm Total Saved!"); 
      setBulkFormData({ ...bulkFormData, totalLiters: '' }); 
      fetchData();
    } catch (e) { alert("Error saving bulk record."); } finally { setLoading(false); }
  };

  const handleYieldAdjustment = async (e) => {
    e.preventDefault();
    if (!yieldAdjustModal.amount || parseFloat(yieldAdjustModal.amount) <= 0) return alert("Enter a valid amount.");

    setLoading(true);
    try {
      const amount = parseFloat(yieldAdjustModal.amount);
      const isAdding = yieldAdjustModal.type === 'Add';

      await addDoc(collection(db, "milk_records"), {
        cow_id: selectedCow.id,
        date: new Date().toISOString().split('T')[0],
        type: 'individual',
        shift: 'Ledger Correction',
        yield_liters: isAdding ? amount : -amount, 
        health_status: 'Correction',
        notes: yieldAdjustModal.notes || 'Manual yield correction',
        recorded_at: serverTimestamp()
      });

      alert(`Yield correction applied to Tag ${selectedCow.id}.`);
      setYieldAdjustModal({ show: false, amount: '', type: 'Subtract', notes: '' });
      fetchData();
    } catch (error) { alert("Error correcting yield."); } finally { setLoading(false); }
  };

  const handleAddCow = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const checkQ = query(collection(db, "cows"), where("id", "==", newCow.id));
      const checkSnap = await getDocs(checkQ);
      if (!checkSnap.empty) {
        setLoading(false);
        return alert(`CRITICAL ERROR: Tag #${newCow.id} already exists. Duplicate tags are strictly prohibited.`);
      }

      let initialPregStatus = 'Open';
      if (newCow.status === 'Dry' && newCow.expectedDueDate) initialPregStatus = 'Pregnant Confirmed';

      await addDoc(collection(db, "cows"), {
        ...newCow, 
        parity: parseInt(newCow.parity) || 0, 
        entryWeight: parseFloat(newCow.entryWeight) || 0, 
        bcs: parseFloat(newCow.bcs) || 0, 
        expectedYield: parseFloat(newCow.expectedYield) || 0, 
        failedAIs: 0, 
        pregnancyStatus: initialPregStatus, 
        nextActionDate: '', 
        nextActionType: '', 
        registered_at: serverTimestamp()
      });
      setShowAddCow(false);
      setNewCow({ id: '', name: '', breed: '', gender: 'Female', status: 'Active', expectedYield: '', birthDate: '', lastParturition: '', parity: '', entryWeight: '', bcs: '', description: '', damId: '', sireId: '', source: 'Farm Born', purchaseDate: '', ownerName: '', ownerDetails: '', expectedDueDate: '', failedAIs: 0, nextActionDate: '', nextActionType: '' });
      fetchData();
    } catch (e) { alert("Error adding animal."); } finally { setLoading(false); }
  };

  const handleSaveProfileEdit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editCowForm.id !== selectedCow.id) {
        const checkQ = query(collection(db, "cows"), where("id", "==", editCowForm.id));
        const checkSnap = await getDocs(checkQ);
        if (!checkSnap.empty) {
          setLoading(false);
          return alert(`CRITICAL ERROR: Cannot change tag to #${editCowForm.id} as it is already in use.`);
        }
      }

      let updatedPregStatus = editCowForm.pregnancyStatus || 'Open';
      if (editCowForm.status === 'Dry' && editCowForm.expectedDueDate) updatedPregStatus = 'Pregnant Confirmed';

      await updateDoc(doc(db, "cows", selectedCow.firestoreDocId), {
        ...editCowForm, 
        parity: parseInt(editCowForm.parity) || 0, 
        entryWeight: parseFloat(editCowForm.entryWeight) || 0, 
        bcs: parseFloat(editCowForm.bcs) || 0, 
        expectedYield: parseFloat(editCowForm.expectedYield) || 0, 
        pregnancyStatus: updatedPregStatus
      });
      alert("Profile Successfully Updated!"); 
      setIsEditingProfile(false); 
      setSelectedCow({...editCowForm, pregnancyStatus: updatedPregStatus}); 
      fetchData();
    } catch (e) { alert("Error updating profile."); } finally { setLoading(false); }
  };

  const handleUpdateAssetStatus = async (newStatus) => {
    let extraData = {};

    if (newStatus === 'Sold') {
      const price = window.prompt(`Enter the final selling price for Tag ${selectedCow.id} to log into revenue:`);
      if (price === null) return; 
      if (isNaN(price) || price.trim() === '') return alert("Invalid price entered. Action cancelled.");
      extraData = { sellPrice: parseFloat(price), soldDate: new Date().toISOString().split('T')[0] };
      
      try {
        await addDoc(collection(db, "revenue_logs"), {
          cow_id: selectedCow.id, type: 'Asset Sale', amount: parseFloat(price), date: extraData.soldDate, recorded_at: serverTimestamp()
        });
      } catch (e) { return alert("Failed to log revenue to the database."); }

    } else if (newStatus === 'Dead') {
      const reason = window.prompt(`Enter the medical or circumstantial reason for the death of Tag ${selectedCow.id}:`);
      if (reason === null) return; 
      extraData = { deathReason: reason || 'Unknown', deathDate: new Date().toISOString().split('T')[0] };
      
      try {
        await addDoc(collection(db, "mortality_logs"), {
          cow_id: selectedCow.id, reason: extraData.deathReason, date: extraData.deathDate, recorded_at: serverTimestamp()
        });
      } catch (e) { return alert("Failed to log mortality record to the database."); }

    } else {
      if(!window.confirm(`Mark ${selectedCow.id} as ${newStatus}?`)) return;
    }

    try { 
      await updateDoc(doc(db, "cows", selectedCow.firestoreDocId), { status: newStatus, ...extraData }); 
      alert(`Status updated to ${newStatus}`); 
      setSelectedCow(null); 
      fetchData(); 
    } catch (e) { alert("Error updating status."); }
  };

  const handleDeleteCow = async () => {
    if(window.confirm(`CRITICAL WARNING: Are you sure you want to permanently delete Tag ${selectedCow.id}? This action cannot be undone.`)) {
      try { 
        await deleteDoc(doc(db, "cows", selectedCow.firestoreDocId)); 
        alert(`Tag ${selectedCow.id} permanently deleted.`); 
        setSelectedCow(null); 
        fetchData(); 
      } catch (e) { alert("Error deleting record."); }
    }
  };

  const handleLogParturition = async () => {
    const today = new Date().toISOString().split('T')[0];
    if(window.confirm(`Log a new calving for ${selectedCow.id} today? This adds +1 to parity and clears pregnancy status.`)) {
      try {
        await updateDoc(doc(db, "cows", selectedCow.firestoreDocId), { 
          lastParturition: today, 
          parity: (parseInt(selectedCow.parity) || 0) + 1, 
          status: 'Active', 
          pregnancyStatus: 'Open', 
          expectedDueDate: '', 
          lastAIDate: null, 
          failedAIs: 0, 
          nextActionDate: '', 
          nextActionType: '' 
        });
        alert("Parturition logged! Remember to register the new calf in the Parturitions Tab."); 
        setSelectedCow(null); 
        fetchData();
      } catch (e) { alert("Error logging calving."); }
    }
  };

  const handleLogBirth = async (e) => {
    e.preventDefault(); 
    setLoading(true);
    
    const dateParts = birthForm.dob.split('-');
    const ddmmyyyy = `${dateParts[2]}${dateParts[1]}${dateParts[0]}`;
    
    const existingToday = cows.filter(c => c.id && c.id.startsWith(`${ddmmyyyy}-`));
    const nextX = existingToday.length + 1;
    let tempCalfId = `${ddmmyyyy}-${nextX}`;

    try {
      const checkQ = query(collection(db, "cows"), where("id", "==", tempCalfId));
      const checkSnap = await getDocs(checkQ);
      if (!checkSnap.empty) tempCalfId = `${ddmmyyyy}-${nextX + 1}`; 

      await addDoc(collection(db, "cows"), { 
        id: tempCalfId, 
        name: '', 
        breed: birthForm.breed, 
        gender: birthForm.gender, 
        status: birthForm.healthStatus === 'Dead' ? 'Dead' : 'Calf', 
        birthDate: birthForm.dob, 
        entryWeight: parseFloat(birthForm.birthWeight) || 0, 
        damId: birthForm.damId, 
        sireId: birthForm.sireId, 
        birthWalkingTimeMins: birthForm.walkingTimeMins, 
        colostrumFed: birthForm.colostrumFed, 
        birthHealthStatus: birthForm.healthStatus, 
        description: birthForm.notes, 
        source: 'Farm Born', 
        parity: 0, bcs: 0, expectedYield: 0, pregnancyStatus: 'Open', failedAIs: 0, nextActionDate: '', nextActionType: '', 
        registered_at: serverTimestamp() 
      });
      
      const dam = cows.find(c => c.id === birthForm.damId);
      if (dam) {
        await updateDoc(doc(db, "cows", dam.firestoreDocId), { 
          lastParturition: birthForm.dob, 
          parity: (parseInt(dam.parity) || 0) + 1, 
          status: 'Active', 
          pregnancyStatus: 'Open', 
          expectedDueDate: '', 
          lastAIDate: null, failedAIs: 0, nextActionDate: '', nextActionType: '' 
        });
      }
      
      alert(`Birth Logged! Auto-generated Tag: ${tempCalfId}. Dam profile updated.`);
      setBirthForm({ damId: '', sireId: '', dob: new Date().toISOString().split('T')[0], gender: 'Female', breed: '', birthWeight: '', walkingTimeMins: '', colostrumFed: false, healthStatus: 'Healthy', notes: ''});
      fetchData();
    } catch (e) { alert("Error logging birth."); } finally { setLoading(false); }
  };

  const handleLogReproduction = async (e) => {
    e.preventDefault();
    try {
      let updates = {};
      let msg = "";
      
      if (reproForm.eventType === 'Heat') {
        const nextHeat = addDaysToDate(reproForm.date, 21);
        updates = { lastHeatDate: reproForm.date, nextActionDate: nextHeat, nextActionType: 'Expected Heat (+21 days)' };
        msg = `Heat observed. Next cycle projected for ${nextHeat}.`;
      } 
      else if (reproForm.eventType === 'AI' || reproForm.eventType === 'Natural') {
        const dueDateStr = addDaysToDate(reproForm.date, 283); 
        const returnToHeatDate = addDaysToDate(reproForm.date, 21); 
        
        updates = { 
          lastAIDate: reproForm.date, 
          lastHeatDate: reproForm.date, 
          aiSireId: reproForm.sireId, 
          expectedDueDate: dueDateStr, 
          pregnancyStatus: 'Inseminated', 
          nextActionDate: returnToHeatDate, 
          nextActionType: 'Return to Heat Check (Post-AI)' 
        };
        msg = `${reproForm.eventType} Logged. Return-to-heat check set. EDD tentatively set to ${dueDateStr}.`;
      } 
      else if (reproForm.eventType === 'PD_Check') {
        if (!reproForm.pdInventoryId) return alert("Select the PD Test Kit or Vet Service used from Inventory.");
        const pdItem = inventory.find(i => i.id === reproForm.pdInventoryId);
        if (pdItem.current_stock < 1) return alert("Insufficient PD kits/vet allocations in inventory.");

        if (reproForm.pdResult === 'Pregnant') {
          updates = { pregnancyStatus: 'Pregnant Confirmed', failedAIs: 0, nextActionDate: '', nextActionType: '' }; 
          msg = "Pregnancy Confirmed! Timeline cleared until Dry-off.";
        } else {
          const currentFails = parseInt(selectedCow.failedAIs) || 0;
          const newFailCount = currentFails + 1;
          const newStatus = newFailCount >= 3 ? 'Repeat Breeder' : 'Open';
          updates = { pregnancyStatus: newStatus, expectedDueDate: '', failedAIs: newFailCount, nextActionDate: '', nextActionType: '' }; 
          msg = `Negative PD. Cow is ${newStatus}. Failed AI count is now ${newFailCount}.`;
        }

        await updateDoc(doc(db, "inventory", pdItem.id), { current_stock: pdItem.current_stock - 1 });
        await addDoc(collection(db, "medical_records"), { cow_id: selectedCow.id, disease_class: "Reproductive Check", medicine_name: pdItem.item_name, cost_incurred: pdItem.unit_cost, recorded_at: serverTimestamp() });
      }
      else if (reproForm.eventType === 'Hormone') {
        if (!reproForm.protocolStep) return alert("Select a protocol step.");
        
        let targetActionDate = '';
        let targetActionType = '';
        let medicineUsed = null;

        if (reproForm.protocolStep === 'Day0_GnRH') {
          if (!reproForm.gnrhInventoryId) return alert("Please select a GnRH batch. If your inventory is empty, add it in the Economics tab.");
          medicineUsed = inventory.find(i => i.id === reproForm.gnrhInventoryId);
          targetActionDate = addDaysToDate(reproForm.date, 7);
          targetActionType = 'Ovsynch Day 7: Administer PGF2a';
        } else if (reproForm.protocolStep === 'Day7_PGF2a') {
          if (!reproForm.pgfInventoryId) return alert("Please select a PGF2a batch.");
          medicineUsed = inventory.find(i => i.id === reproForm.pgfInventoryId);
          targetActionDate = addDaysToDate(reproForm.date, 2);
          targetActionType = 'Ovsynch Day 9: Administer GnRH';
        } else if (reproForm.protocolStep === 'Day9_GnRH2') {
          if (!reproForm.gnrhInventoryId) return alert("Please select a GnRH batch.");
          medicineUsed = inventory.find(i => i.id === reproForm.gnrhInventoryId);
          targetActionDate = addDaysToDate(reproForm.date, 1);
          targetActionType = 'Ovsynch Day 10: Timed AI';
        }

        if (!medicineUsed) return alert("Selected medicine not found in inventory.");
        if (medicineUsed.current_stock < 1) return alert(`Insufficient stock! You need at least 1 unit of ${medicineUsed.item_name}.`);

        await updateDoc(doc(db, "inventory", medicineUsed.id), { current_stock: medicineUsed.current_stock - 1 });
        await addDoc(collection(db, "medical_records"), { cow_id: selectedCow.id, disease_class: "Hormone Sync", medicine_name: medicineUsed.item_name, cost_incurred: medicineUsed.unit_cost, recorded_at: serverTimestamp() });
        
        updates = { pregnancyStatus: 'Under Sync Protocol', nextActionDate: targetActionDate, nextActionType: targetActionType };
        msg = `Protocol step logged. Next action scheduled for ${targetActionDate} (${targetActionType}). Inventory updated.`;
      }

      await updateDoc(doc(db, "cows", selectedCow.firestoreDocId), updates);
      await addDoc(collection(db, "reproduction_logs"), { cow_id: selectedCow.id, ...reproForm, recorded_at: serverTimestamp() });

      alert(msg);
      setReproForm({ eventType: 'Heat', date: new Date().toISOString().split('T')[0], sireId: '', notes: '', pdResult: 'Pregnant', pdInventoryId: '', protocolStep: 'Day0_GnRH', gnrhInventoryId: '', pgfInventoryId: '' });
      fetchData();
      setSelectedCow({ ...selectedCow, ...updates }); 
    } catch (e) { alert("Error logging reproductive event."); }
  };

  const handleSaveMedicalRecord = async (e) => {
    e.preventDefault();
    if (!medicalForm.inventoryId || !medicalForm.diseaseClassification) return alert("Select disease and medicine.");
    const selectedMedItem = inventory.find(i => i.id === medicalForm.inventoryId);
    
    const totalDoseRequired = parseFloat(medicalForm.totalDose);
    if (!totalDoseRequired || totalDoseRequired <= 0) return alert("Enter a valid total dose amount.");
    
    if (selectedMedItem.current_stock < totalDoseRequired) return alert(`Insufficient stock! You only have ${selectedMedItem.current_stock} ${selectedMedItem.unit} left in inventory.`);
    
    setLoading(true);
    const proofFileName = medicalForm.prescriptionImage ? medicalForm.prescriptionImage.name : 'No prescription attached';

    try {
      await addDoc(collection(db, "medical_records"), { 
        cow_id: selectedCow.id, 
        disease_class: medicalForm.diseaseClassification, 
        symptoms: medicalForm.symptoms, 
        prognosis: medicalForm.prognosis,
        course_duration: parseInt(medicalForm.courseDurationDays) || 1,
        ast_report: medicalForm.astReport, 
        medicine_id: selectedMedItem.id, 
        medicine_name: selectedMedItem.item_name, 
        brand: selectedMedItem.brand || 'Generic', 
        vendor: selectedMedItem.vendor || 'Unknown', 
        dose_given: totalDoseRequired, 
        cost_incurred: totalDoseRequired * selectedMedItem.unit_cost, 
        env_temp: environment.tempCelsius, 
        env_humidity: environment.humidity, 
        season: environment.season, 
        prescription_file: proofFileName,
        recorded_at: serverTimestamp() 
      });
      await updateDoc(doc(db, "inventory", selectedMedItem.id), { current_stock: selectedMedItem.current_stock - totalDoseRequired });
      alert("Medical record successfully locked and inventory deducted."); 
      setMedicalForm({ diseaseClassification: '', symptoms: '', astReport: '', prognosis: '', courseDurationDays: '', inventoryId: '', totalDose: '', prescriptionImage: null }); 
      fetchData();
    } catch (e) { alert("Error saving medical record."); } finally { setLoading(false); }
  };

  const handleApplyTopDress = async () => {
    for(const row of topDressRows) {
      if(!row.inventoryId || !row.amount) continue;
      const item = inventory.find(i => i.id === row.inventoryId);
      if(item.current_stock < parseFloat(row.amount)) return alert(`Insufficient stock for ${item.item_name}`);
    }
    try {
      for(const row of topDressRows) {
        if(!row.inventoryId || !row.amount) continue;
        const item = inventory.find(i => i.id === row.inventoryId);
        const amountNeeded = parseFloat(row.amount);
        await addDoc(collection(db, "top_dress_logs"), { cow_id: selectedCow.id, item_id: item.id, item_name: item.item_name, brand: item.brand || 'Generic', vendor: item.vendor || 'Unknown', amount: amountNeeded, cost_incurred: amountNeeded * item.unit_cost, recorded_at: serverTimestamp() });
        await updateDoc(doc(db, "inventory", item.id), { current_stock: item.current_stock - amountNeeded });
      }
      alert(`Top-Dress applied!`); setTopDressRows([{ id: Date.now(), inventoryId: '', amount: '' }]); fetchData();
    } catch (e) { alert("Error applying top dress."); }
  };

  const handleLockFeed = async () => {
    if (!targetCow) return alert("Please select an individual cow first.");
    for (const row of rationRows) {
      if (row.inventoryId && row.amount) {
        const item = inventory.find(i => i.id === row.inventoryId);
        if (item.current_stock < (parseFloat(row.amount))) return alert(`Insufficient Stock for ${item.item_name}.`);
      }
    }
    try {
      let totalCost = 0;
      for (const row of rationRows) {
        if (row.inventoryId && row.amount) {
          const item = inventory.find(i => i.id === row.inventoryId);
          const totalNeeded = parseFloat(row.amount);
          totalCost += (totalNeeded * item.unit_cost);
          await updateDoc(doc(db, "inventory", item.id), { current_stock: item.current_stock - totalNeeded });
        }
      }
      await addDoc(collection(db, "feed_logs"), { cow_id: targetCow.id, headcount: 1, total_cost: totalCost, cost_per_cow: totalCost, notes: rationNotes, recorded_at: serverTimestamp() });
      alert(`Success! Logged feed for Tag ${targetCow.id}.`); 
      setRationRows([{ id: Date.now(), inventoryId: '', amount: '' }]); 
      setRationNotes(''); 
      fetchData();
    } catch (e) { alert("Error locking feed schedule."); }
  };

  // --- 1. THE NUTRITION AI ENGINE ---
  const handleAIAnalysis = async () => {
    if (!targetCow) return alert("Please select a specific cow to analyze.");
    
    setIsAiLoading(true);
    setAiNutritionReport(null);

    try {
      const currentDiet = rationRows.map(row => {
        const item = inventory.find(i => i.id === row.inventoryId);
        return item && row.amount ? `${row.amount} kg of ${item.item_name}` : null;
      }).filter(Boolean);

      if (currentDiet.length === 0) {
         setIsAiLoading(false);
         return alert("Please add at least one ingredient to the ration before analyzing.");
      }

      const payload = {
        target_cow_id: targetCow.id,
        cow_metrics: {
           weight_kg: parseFloat(targetCow.entryWeight) || 0,
           target_yield_L: parseFloat(targetCow.expectedYield) || 0,
           bcs: parseFloat(targetCow.bcs) || 0
        },
        environment_stressors: environment,
        proposed_diet: currentDiet,
        available_inventory: inventory.map(i => `${i.item_name} (Stock: ${i.current_stock} ${i.unit})`)
      };

      const systemContext = `You are NooRganic-Vet, an expert dairy veterinary and nutrition AI. 
      Analyze the provided farm data JSON for this specific cow. 
      1. Evaluate if the 'proposed_diet' meets the exact energy/protein requirements for her specific 'target_yield_L', 'weight_kg', and 'bcs'.
      2. Factor in the 'environment_stressors' (like heat stress).
      3. Suggest precise ingredient adjustments from 'available_inventory' to optimize her yield and fix her BCS if it is too high or low.
      Keep your response concise, professional, and directly actionable for the farmer.`;
      
      const response = await askGemma(JSON.stringify(payload, null, 2), systemContext);
      setAiNutritionReport(response);
    } catch (error) {
      setAiNutritionReport("Connection Error: Unable to reach the AI Engine.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- 2. THE ESTRUS & REPRODUCTION AI ENGINE ---
  const handleReproAIAnalysis = async () => {
    if (!selectedCow) return;
    setIsReproAiLoading(true); 
    setAiReproReport(null);

    try {
      const payload = {
        tag_id: selectedCow.id,
        breed: selectedCow.breed,
        parity: selectedCow.parity || 0,
        bcs: selectedCow.bcs || 0,
        reproduction_status: selectedCow.pregnancyStatus || 'Open',
        last_parturition_date: selectedCow.lastParturition || 'Unknown',
        last_insemination_date: selectedCow.lastAIDate || 'N/A',
        failed_insemination_count: selectedCow.failedAIs || 0,
        expected_due_date: selectedCow.expectedDueDate || 'N/A',
        scheduled_veterinary_actions: selectedCow.nextActionDate ? `${selectedCow.nextActionDate} - ${selectedCow.nextActionType}` : 'None'
      };

      const sysCtx = `You are NooRganic-Vet, an expert dairy veterinary AI specializing in bovine reproduction and theriogenology.
      Analyze this cow's reproductive history JSON.
      1. If Open/Inseminated: Calculate probability of conception, evaluate estrus cycle timing, and recommend exact optimal window for AI.
      2. If Pregnant: Provide a parturition prep timeline (drying off, transition diet).
      3. Address 'failed_insemination_count' if > 0 with potential clinical causes (metabolic, cystic, etc.).
      Keep your response concise, actionable, and formatted cleanly for the farmhand.`;
      
      const response = await askGemma(JSON.stringify(payload, null, 2), sysCtx);
      setAiReproReport(response);
    } catch(e) {
      setAiReproReport("Connection Error: Unable to reach the AI Engine for Fertility Analysis.");
    } finally { 
      setIsReproAiLoading(false); 
    }
  };

  const addRationRow = () => setRationRows([...rationRows, { id: Date.now(), inventoryId: '', amount: '' }]);
  const removeRationRow = (id) => setRationRows(rationRows.filter(row => row.id !== id));
  const updateRationRow = (id, field, value) => setRationRows(rationRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  const totalRationCost = rationRows.reduce((total, row) => { const item = inventory.find(i => i.id === row.inventoryId); return item && item.unit_cost ? total + ((parseFloat(row.amount) || 0) * item.unit_cost) : total; }, 0);

  const addTopDressRow = () => setTopDressRows([...topDressRows, { id: Date.now(), inventoryId: '', amount: '' }]);
  const removeTopDressRow = (id) => setTopDressRows(topDressRows.filter(row => row.id !== id));
  const updateTopDressRow = (id, field, value) => setTopDressRows(topDressRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  const totalTopDressCost = topDressRows.reduce((total, row) => { const item = inventory.find(i => i.id === row.inventoryId); return item && item.unit_cost ? total + ((parseFloat(row.amount) || 0) * item.unit_cost) : total; }, 0);

  const filteredCows = cows.filter(cow => {
    const matchBreed = filterBreed === '' || (cow.breed && cow.breed.toLowerCase().includes(filterBreed.toLowerCase()));
    const matchParity = filterParity === '' || (cow.parity && cow.parity.toString() === filterParity);
    const matchStatus = filterStatus === '' || cow.status === filterStatus;
    const matchGender = filterGender === '' || cow.gender === filterGender;
    return matchBreed && matchParity && matchStatus && matchGender;
  });

  const reproCows = cows.filter(c => c.gender === 'Female' && c.status !== 'Calf' && c.status !== 'Heifer');
  const upcomingActions = reproCows.filter(c => c.nextActionDate && c.pregnancyStatus !== 'Pregnant Confirmed')
                                     .sort((a, b) => new Date(a.nextActionDate) - new Date(b.nextActionDate));

  if (selectedCow) {
    if (isEditingProfile) {
      return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-300">
          <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setIsEditingProfile(false)} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium"><ArrowLeft size={20} /> Cancel Edit</button>
            <h1 className="text-xl font-bold text-slate-800">Editing Profile: {editCowForm.id}</h1>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <form onSubmit={handleSaveProfileEdit} className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">TAG/ID *</label>
                    <input type="text" required value={editCowForm.id} onChange={(e)=>setEditCowForm({...editCowForm, id: e.target.value})} className="w-full border p-2 rounded outline-none bg-yellow-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">NICKNAME</label>
                    <input type="text" value={editCowForm.name || ''} onChange={(e)=>setEditCowForm({...editCowForm, name: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">GENDER</label>
                    <select value={editCowForm.gender} onChange={(e)=>setEditCowForm({...editCowForm, gender: e.target.value})} className="w-full border p-2 rounded outline-none">
                      <option>Female</option>
                      <option>Male</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">BREED</label>
                    <input type="text" list="breed-options" value={editCowForm.breed} onChange={(e)=>setEditCowForm({...editCowForm, breed: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">BIRTH DATE</label>
                    <input type="date" value={editCowForm.birthDate} onChange={(e)=>setEditCowForm({...editCowForm, birthDate: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">STATUS</label>
                    <select value={editCowForm.status} onChange={(e)=>setEditCowForm({...editCowForm, status: e.target.value})} className="w-full border p-2 rounded outline-none">
                      <option>Active</option>
                      <option>Dry</option>
                      <option>Heifer</option>
                      <option>Bull</option>
                      <option>Calf</option>
                      <option>Sick</option>
                      <option>Sold</option>
                      <option>Dead</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1 flex items-center gap-1"><Target size={12}/> EXPECTED YIELD</label>
                    <input type="number" step="0.1" value={editCowForm.expectedYield} onChange={(e)=>setEditCowForm({...editCowForm, expectedYield: e.target.value})} className="w-full border border-blue-400 p-2 rounded outline-none bg-blue-50" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ORIGIN / SOURCE</label>
                    <select value={editCowForm.source} onChange={(e)=>setEditCowForm({...editCowForm, source: e.target.value})} className="w-full border p-2 rounded outline-none">
                      <option value="Farm Born">Born on Farm</option>
                      <option value="Purchased">Purchased Outside</option>
                    </select>
                  </div>
                  {editCowForm.source === 'Purchased' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">PURCHASE DATE</label>
                        <input type="date" value={editCowForm.purchaseDate} onChange={(e)=>setEditCowForm({...editCowForm, purchaseDate: e.target.value})} className="w-full border p-2 rounded outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">SELLER / OWNER</label>
                        <input type="text" value={editCowForm.ownerName} onChange={(e)=>setEditCowForm({...editCowForm, ownerName: e.target.value})} className="w-full border p-2 rounded outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">PRICE / DETAILS</label>
                        <input type="text" value={editCowForm.ownerDetails} onChange={(e)=>setEditCowForm({...editCowForm, ownerDetails: e.target.value})} className="w-full border p-2 rounded outline-none" />
                      </div>
                    </>
                  )}
                  {editCowForm.status === 'Dry' && (
                     <div>
                      <label className="block text-xs font-bold text-amber-700 mb-1">EXPECTED DUE DATE</label>
                      <input type="date" value={editCowForm.expectedDueDate || ''} onChange={(e)=>setEditCowForm({...editCowForm, expectedDueDate: e.target.value})} className="w-full border border-amber-300 bg-amber-50 p-2 rounded outline-none" />
                     </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">DAM ID (Mother)</label>
                    <input type="text" value={editCowForm.damId || ''} onChange={(e)=>setEditCowForm({...editCowForm, damId: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">SIRE ID (Sire)</label>
                    <input type="text" value={editCowForm.sireId || ''} onChange={(e)=>setEditCowForm({...editCowForm, sireId: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">WEIGHT (kg)</label>
                    <input type="number" value={editCowForm.entryWeight} onChange={(e)=>setEditCowForm({...editCowForm, entryWeight: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">BCS</label>
                    <input type="number" step="0.25" value={editCowForm.bcs} onChange={(e)=>setEditCowForm({...editCowForm, bcs: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                </div>
                
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button disabled={loading} type="submit" className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold disabled:bg-slate-400 transition">
                    {loading ? 'Updating...' : 'Save Updated Profile'}
                  </button>
                </div>

            </form>
          </div>
        </div>
      );
    }

    const selectedMedItem = inventory.find(i => i.id === medicalForm.inventoryId);
    const totalDoseRequired = parseFloat(medicalForm.totalDose) || 0;
    const treatmentCost = selectedMedItem ? (totalDoseRequired * selectedMedItem.unit_cost).toFixed(2) : '0.00';
    
    const offspring = cows.filter(c => c.damId === selectedCow.id || c.sireId === selectedCow.id);
    const cowMedicalHistory = medicalRecords.filter(m => m.cow_id === selectedCow.id);

    let displayPregStatus = selectedCow.pregnancyStatus || 'Open';
    if (selectedCow.status === 'Dry' && selectedCow.expectedDueDate) displayPregStatus = 'Pregnant (Dry)';

    let reproBadgeColor = 'bg-slate-100 text-slate-700';
    if (displayPregStatus.includes('Pregnant')) reproBadgeColor = 'bg-emerald-100 text-emerald-700 border border-emerald-300';
    else if (displayPregStatus === 'Repeat Breeder') reproBadgeColor = 'bg-red-100 text-red-700 border border-red-300';
    else if (displayPregStatus === 'Open') reproBadgeColor = 'bg-blue-100 text-blue-700 border border-blue-300';
    else if (displayPregStatus === 'Inseminated' || displayPregStatus === 'Under Sync Protocol') reproBadgeColor = 'bg-amber-100 text-amber-700 border border-amber-300';

    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-300">
        
        {/* YIELD ADJUSTMENT MODAL FOR THIS COW */}
        {yieldAdjustModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><ArrowRightLeft size={18}/> Correct Cow Lifetime Yield</h3>
                <button onClick={() => setYieldAdjustModal({show: false, amount: '', type: 'Subtract', notes: ''})} className="hover:text-blue-200"><X size={20}/></button>
              </div>
              <form onSubmit={handleYieldAdjustment} className="p-6 space-y-4">
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Animal Target</p>
                  <p className="text-lg font-black text-slate-800">Tag {selectedCow.id} {selectedCow.name ? `(${selectedCow.name})` : ''}</p>
                  <p className="text-[10px] text-blue-700 mt-1">Note: This safely injects an adjustment record into the milk ledger to preserve chronological accuracy.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">CORRECTION ACTION</label>
                    <select value={yieldAdjustModal.type} onChange={(e) => setYieldAdjustModal({...yieldAdjustModal, type: e.target.value})} className="w-full p-2 border border-slate-300 rounded outline-none font-bold text-slate-700">
                      <option value="Subtract">Subtract Yield (Over-reported)</option>
                      <option value="Add">Add Yield (Under-reported)</option>
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

        <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-6">
            <button onClick={() => setSelectedCow(null)} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition font-medium"><ArrowLeft size={20} /> Back</button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                {selectedCow.id} 
                {selectedCow.name && <span className="text-lg text-slate-500 font-medium italic">"{selectedCow.name}"</span>}
                <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-slate-100 border">{selectedCow.gender}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${selectedCow.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : selectedCow.status === 'Sold' || selectedCow.status === 'Dead' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>{selectedCow.status}</span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1"><Target size={12}/> {getCowGroup(selectedCow).replace('_', ' ')}</span>
              </h1>
              <p className="text-sm text-slate-500 font-medium mt-1">Weight: {selectedCow.entryWeight}kg • BCS: {selectedCow.bcs} • Target Yield: {selectedCow.expectedYield || 0}L</p>
            </div>
          </div>
          
          <div className="flex gap-2">
             <button onClick={() => setYieldAdjustModal({show: true, amount: '', type: 'Subtract', notes: ''})} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg font-bold hover:bg-emerald-100 text-sm flex items-center gap-2"><ArrowRightLeft size={16}/> Adjust Yield</button>
             <button onClick={() => { setEditCowForm(selectedCow); setIsEditingProfile(true); }} className="bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg font-bold hover:bg-slate-50 text-sm flex items-center gap-2"><Edit size={16}/> Edit Profile</button>
             <button onClick={() => handleUpdateAssetStatus('Sold')} className="bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg font-bold hover:bg-blue-100 text-sm">Sell Asset</button>
             <button onClick={() => handleUpdateAssetStatus('Dead')} className="bg-slate-100 text-slate-600 border border-slate-200 px-4 py-2 rounded-lg font-bold hover:bg-slate-200 text-sm">Mark Deceased</button>
             <button onClick={handleDeleteCow} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold hover:bg-red-100 text-sm flex items-center gap-2"><Trash2 size={16}/> Delete Error</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
             <div><p className="text-xs font-bold text-slate-400 uppercase">Parity</p><p className="text-2xl font-black">{selectedCow.parity || 0}</p></div>
             {selectedCow.gender === 'Female' && (<button onClick={handleLogParturition} className="bg-emerald-50 text-emerald-700 p-2 rounded-lg flex items-center gap-1 text-xs font-bold hover:bg-emerald-100 border border-emerald-200"><Baby size={16}/> Log Calving</button>)}
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase">Last Parturition / DOB</p><p className="text-xl font-bold mt-1">{selectedCow.lastParturition || selectedCow.birthDate || 'N/A'}</p></div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase">Breed</p><p className="text-xl font-bold mt-1">{selectedCow.breed || 'N/A'}</p></div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase">Origin</p><p className="text-sm font-bold mt-1">{selectedCow.source}</p></div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-2 mb-4 border-b pb-4"><GitMerge className="text-purple-600" /><h2 className="text-lg font-bold text-slate-800">Pedigree & Lineage</h2></div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div>
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ancestry</h3>
               <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                 <p className="text-sm"><span className="font-bold text-purple-900">DAM (Mother):</span> {selectedCow.damId || 'Unknown / Not Logged'}</p>
                 <p className="text-sm mt-2"><span className="font-bold text-purple-900">SIRE (Father):</span> {selectedCow.sireId || 'Unknown / Not Logged'}</p>
               </div>
             </div>
             <div>
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recorded Offspring at Farm</h3>
               {offspring.length > 0 ? (
                 <ul className="space-y-2">
                   {offspring.map(calf => (
                     <li key={calf.firestoreDocId} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded border border-slate-100">
                       <span className="font-bold">{calf.id} {calf.name ? `(${calf.name})` : ''}</span><span className="text-xs text-slate-500">{calf.gender} • {calf.status}</span>
                     </li>
                   ))}
                 </ul>
               ) : (
                 <p className="text-sm text-slate-400 italic">No offspring registered in system.</p>
               )}
             </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b pb-4"><Stethoscope className="text-blue-600" /><h2 className="text-lg font-bold text-slate-800">Comprehensive Clinical Record</h2></div>
            
            <form onSubmit={handleSaveMedicalRecord} className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 bg-white p-2 rounded border border-slate-200 mb-2">
                <div className="flex items-center gap-3">
                  <ThermometerSun size={14} className="text-amber-500"/>
                  <span>Season: {environment.season}</span> | 
                  <span>{environment.tempCelsius}°C</span> | 
                  <span>{environment.humidity}% RH</span>
                </div>
                {environment.isLive ? (
                   <span className="flex items-center gap-1 text-[10px] text-emerald-600 tracking-widest uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200" title="Live Telemetry via Open-Meteo">
                      <CloudRain size={10}/> Live
                   </span>
                ) : (
                   <span className="flex items-center gap-1 text-[10px] text-slate-400 tracking-widest uppercase bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Offline
                   </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">DISEASE / AILMENT</label>
                  <select required value={medicalForm.diseaseClassification} onChange={(e)=>setMedicalForm({...medicalForm, diseaseClassification: e.target.value})} className="w-full border p-2 rounded outline-none bg-white">
                    <option value="">-- Select --</option><option value="Mastitis_Clinical">Clinical Mastitis</option><option value="Mastitis_SubClinical">Sub-Clinical Mastitis</option><option value="Lameness">Lameness / Hoof Issue</option><option value="Metabolic_Ketosis">Ketosis</option><option value="Metabolic_MilkFever">Milk Fever</option><option value="Reproductive_Metritis">Metritis</option><option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">SYMPTOMS OBSERVED</label>
                  <input type="text" required value={medicalForm.symptoms} onChange={(e)=>setMedicalForm({...medicalForm, symptoms: e.target.value})} className="w-full border p-2 rounded outline-none" placeholder="e.g. Swollen udder, high temp..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">PROGNOSIS / VET DIAGNOSIS</label>
                  <input type="text" required value={medicalForm.prognosis} onChange={(e)=>setMedicalForm({...medicalForm, prognosis: e.target.value})} className="w-full border p-2 rounded outline-none" placeholder="e.g. Full recovery expected..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">COURSE DURATION (DAYS)</label>
                  <input type="number" required value={medicalForm.courseDurationDays} onChange={(e)=>setMedicalForm({...medicalForm, courseDurationDays: e.target.value})} className="w-full border p-2 rounded outline-none font-bold" placeholder="e.g. 3" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">AST / LAB / TREATMENT NOTES</label>
                <textarea value={medicalForm.astReport} onChange={(e)=>setMedicalForm({...medicalForm, astReport: e.target.value})} className="w-full border p-2 rounded outline-none h-12 text-sm" placeholder="Any culture results or extra details..."></textarea>
              </div>
              
              <div className="p-3 border border-dashed border-slate-300 rounded-lg bg-white">
                 <label className="block text-xs font-bold text-slate-600 mb-2 flex items-center gap-1"><FileText size={14}/> UPLOAD VET PRESCRIPTION / REPORT</label>
                 <input type="file" accept="image/*,.pdf" onChange={(e) => setMedicalForm({...medicalForm, prescriptionImage: e.target.files[0] || null})} className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>

              <div className="col-span-2 pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-1">SELECT MEDICINE BATCH (INVENTORY)</label>
                <select required value={medicalForm.inventoryId} onChange={(e)=>setMedicalForm({...medicalForm, inventoryId: e.target.value})} className="w-full border p-2 rounded outline-none bg-white">
                  <option value="">-- Choose Medicine --</option>
                  {inventory.filter(i => i.category === 'Medicine' && i.current_stock > 0).map(med => (
                    <option key={med.id} value={med.id}>{med.item_name} (Stock: {med.current_stock} {med.unit}) - ₹{med.unit_cost.toFixed(2)}/{med.unit}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-blue-700 mb-1">TOTAL DOSE GIVEN (Vials / ML / Bolus)</label>
                  <input type="number" step="0.1" required value={medicalForm.totalDose} onChange={(e)=>setMedicalForm({...medicalForm, totalDose: e.target.value})} className="w-full border border-blue-300 p-2 rounded outline-none font-bold bg-blue-50 text-lg" placeholder="Exact amount used..." />
                </div>
                <div className="bg-red-50 p-2 rounded border border-red-100 text-center"><div className="text-[10px] font-bold text-red-800 uppercase">Estimated Financial Hit</div><div className="font-bold text-red-600">₹{treatmentCost}</div></div>
              </div>
              <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 mt-4 disabled:bg-slate-400">{loading ? 'Saving...' : 'Deduct Stock & Save Medical Record'}</button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><History size={18} className="text-slate-500"/> Full Treatment History</h3>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-slate-500 uppercase tracking-wider text-[10px]">
                      <th className="py-2 px-3 font-bold">Date</th>
                      <th className="py-2 px-3 font-bold">Disease & Symptoms</th>
                      <th className="py-2 px-3 font-bold">Treatment & Duration</th>
                      <th className="py-2 px-3 font-bold">File</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cowMedicalHistory.map(med => (
                      <tr key={med.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-700">{new Date(med.recorded_at?.seconds * 1000).toLocaleDateString()}</td>
                        <td className="py-2 px-3">
                          <span className="font-bold text-slate-800">{med.disease_class.replace('_', ' ')}</span><br/>
                          <span className="text-xs text-slate-500">{med.symptoms}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-bold text-emerald-600">{med.medicine_name} ({med.dose_given} units)</span><br/>
                          <span className="text-xs text-slate-500 font-bold">{med.course_duration} Days Course</span> • <span className="text-xs text-slate-400 italic">"{med.prognosis}"</span>
                        </td>
                        <td className="py-2 px-3">
                           {med.prescription_file && med.prescription_file !== 'No prescription attached' ? (
                             <span className="text-blue-600 underline cursor-pointer text-xs font-bold">View Rx</span>
                           ) : <span className="text-slate-300 text-xs">--</span>}
                        </td>
                      </tr>
                    ))}
                    {cowMedicalHistory.length === 0 && <tr><td colSpan="4" className="py-8 text-center text-slate-400 font-medium">No medical history logged.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 border-b border-emerald-200 pb-2"><Wheat className="text-emerald-700" /><h2 className="text-lg font-bold text-emerald-900">Multi-Item Top-Dress</h2></div>
              <div className="space-y-3">
                {topDressRows.map(row => {
                  const selectedItem = inventory.find(i => i.id === row.inventoryId);
                  const rowCost = selectedItem ? ((parseFloat(row.amount) || 0) * selectedItem.unit_cost).toFixed(2) : '0.00';
                  return (
                    <div key={row.id} className="flex gap-2 items-center">
                      <select value={row.inventoryId} onChange={(e) => updateTopDressRow(row.id, 'inventoryId', e.target.value)} className="flex-1 border border-emerald-300 p-2 rounded text-sm outline-none bg-white">
                        <option value="">-- Select Supplement/Veg --</option>
                        {inventory.filter(i => ['Supplement', 'Vegetable', 'Feed'].includes(i.category) && i.current_stock > 0).map(item => (
                          <option key={item.id} value={item.id}>{item.item_name} {item.brand ? `(${item.brand})` : ''}</option>
                        ))}
                      </select>
                      <input type="number" step="0.01" value={row.amount} onChange={(e) => updateTopDressRow(row.id, 'amount', e.target.value)} className="w-24 border border-emerald-300 p-2 rounded text-sm outline-none" placeholder="Amount" />
                      <div className="w-20 text-right text-emerald-800 font-bold text-sm">₹{rowCost}</div>
                      <button onClick={() => removeTopDressRow(row.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center pt-2">
                  <button onClick={addTopDressRow} className="text-emerald-600 text-sm font-bold hover:text-emerald-800">+ Add Item</button>
                  <div className="font-black text-emerald-900">Total: ₹{totalTopDressCost.toFixed(2)}</div>
                </div>
                <button onClick={handleApplyTopDress} className="w-full bg-emerald-700 text-white py-2 rounded font-bold hover:bg-emerald-800 flex justify-center items-center gap-2 mt-2"><Check size={16}/> Deduct & Apply Top-Dress</button>
              </div>
            </div>

            {selectedCow.gender === 'Female' && (
              <div className="bg-rose-50 p-6 rounded-xl border border-rose-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4 border-b border-rose-200 pb-2"><CalendarHeart className="text-rose-600" /><h2 className="text-lg font-bold text-rose-900">Veterinary Reproductive Hub</h2></div>
                
                <div className="mb-4 text-sm bg-white p-4 rounded-lg border border-rose-100 grid grid-cols-2 gap-3">
                   <div><span className="font-bold text-rose-800 block text-[10px] uppercase">Status</span> <span className={`px-2 py-0.5 rounded font-bold text-xs ${reproBadgeColor}`}>{displayPregStatus}</span></div>
                   <div><span className="font-bold text-rose-800 block text-[10px] uppercase">Expected Due Date</span> <span className="font-bold">{selectedCow.expectedDueDate || '--'}</span></div>
                   <div><span className="font-bold text-rose-800 block text-[10px] uppercase">Last AI / Sire</span> {selectedCow.aiSireId ? `${selectedCow.lastAIDate} (${selectedCow.aiSireId})` : '--'}</div>
                   <div><span className="font-bold text-amber-600 block text-[10px] uppercase">Failed AI Count</span> <span className="font-bold text-red-600">{selectedCow.failedAIs || 0}</span></div>
                </div>

                <div className="mb-4 p-3 bg-amber-50 rounded border border-amber-200 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={14}/> Next Scheduled Action</span>
                  {selectedCow.nextActionDate ? (
                    <div className="text-center"><span className="font-black text-amber-600 text-lg">{selectedCow.nextActionDate}</span><br/><span className="text-xs font-bold text-amber-700">{selectedCow.nextActionType}</span></div>
                  ) : <span className="text-sm font-bold text-slate-400">No pending actions scheduled.</span>}
                </div>

                <form onSubmit={handleLogReproduction} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-rose-800 mb-1">EVENT TYPE</label>
                      <select value={reproForm.eventType} onChange={(e)=>setReproForm({...reproForm, eventType: e.target.value})} className="w-full border border-rose-300 p-2 rounded outline-none bg-white">
                        <option value="Heat">Heat Observed (+21d Proj.)</option>
                        <option value="AI">Artificial Insemination (AI)</option>
                        <option value="Natural">Natural Service (Bull)</option>
                        <option value="PD_Check">Pregnancy Check (PD)</option>
                        <option value="Hormone">Hormone Therapy (Ovsynch)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-rose-800 mb-1">DATE</label>
                      <input type="date" required value={reproForm.date} onChange={(e)=>setReproForm({...reproForm, date: e.target.value})} className="w-full border border-rose-300 p-2 rounded outline-none" />
                    </div>
                  </div>

                  {(reproForm.eventType === 'AI' || reproForm.eventType === 'Natural') && (
                    <div>
                      <label className="block text-xs font-bold text-rose-800 mb-1">SIRE / SEMEN STRAW ID</label>
                      <input type="text" required value={reproForm.sireId} onChange={(e)=>setReproForm({...reproForm, sireId: e.target.value})} className="w-full border border-rose-300 p-2 rounded outline-none" placeholder="Bull Name or Straw ID" />
                    </div>
                  )}

                  {reproForm.eventType === 'PD_Check' && (
                    <div className="p-3 bg-white border border-rose-200 rounded-lg space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-rose-800 mb-1">SELECT PD TEST KIT / VET (Inventory)</label>
                        <select required value={reproForm.pdInventoryId} onChange={(e)=>setReproForm({...reproForm, pdInventoryId: e.target.value})} className="w-full border border-rose-300 p-2 rounded outline-none">
                          <option value="">-- Choose Kit/Service --</option>
                          {inventory.filter(i => i.category === 'Medicine' && i.current_stock > 0).map(item => (
                            <option key={item.id} value={item.id}>{item.item_name} - ₹{item.unit_cost}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-rose-800 mb-1">PD RESULT</label>
                        <select value={reproForm.pdResult} onChange={(e)=>setReproForm({...reproForm, pdResult: e.target.value})} className="w-full border border-rose-300 p-2 rounded outline-none font-bold">
                          <option value="Pregnant" className="text-emerald-600">Positive (Pregnant)</option><option value="Open" className="text-red-600">Negative (Open)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {reproForm.eventType === 'Hormone' && (
                    <div className="p-3 bg-white border border-rose-200 rounded-lg space-y-3">
                      <p className="text-xs text-rose-600 mb-2">Ovsynch Protocol steps auto-calculate the next action date.</p>
                      <div>
                        <label className="block text-xs font-bold text-rose-800 mb-1">PROTOCOL STEP</label>
                        <select value={reproForm.protocolStep} onChange={(e)=>setReproForm({...reproForm, protocolStep: e.target.value})} className="w-full border border-rose-300 p-2 rounded outline-none">
                          <option value="Day0_GnRH">Day 0: Induce HT (GnRH)</option>
                          <option value="Day7_PGF2a">Day 7: Administer PGF2a</option>
                          <option value="Day9_GnRH2">Day 9: Administer 2nd GnRH</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                         {(reproForm.protocolStep === 'Day0_GnRH' || reproForm.protocolStep === 'Day9_GnRH2') && (
                           <div>
                            <label className="block text-xs font-bold text-rose-800 mb-1 flex items-center gap-1"><Syringe size={12}/> SELECT GnRH BATCH</label>
                            <select value={reproForm.gnrhInventoryId} onChange={(e)=>setReproForm({...reproForm, gnrhInventoryId: e.target.value})} className="w-full border border-rose-300 p-2 rounded outline-none text-xs">
                              <option value="">-- GnRH Inventory --</option>{inventory.filter(i => i.category === 'Medicine').map(item => (<option key={item.id} value={item.id}>{item.item_name}</option>))}
                            </select>
                           </div>
                         )}
                         {reproForm.protocolStep === 'Day7_PGF2a' && (
                           <div>
                            <label className="block text-xs font-bold text-rose-800 mb-1 flex items-center gap-1"><Syringe size={12}/> SELECT PGF2a BATCH</label>
                            <select value={reproForm.pgfInventoryId} onChange={(e)=>setReproForm({...reproForm, pgfInventoryId: e.target.value})} className="w-full border border-rose-300 p-2 rounded outline-none text-xs">
                              <option value="">-- PGF2a Inventory --</option>{inventory.filter(i => i.category === 'Medicine').map(item => (<option key={item.id} value={item.id}>{item.item_name}</option>))}
                            </select>
                           </div>
                         )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-rose-800 mb-1">NOTES</label>
                    <input type="text" value={reproForm.notes} onChange={(e)=>setReproForm({...reproForm, notes: e.target.value})} className="w-full border border-rose-300 p-2 rounded outline-none" placeholder="Observations..." />
                  </div>
                  <button type="submit" className="w-full bg-rose-600 text-white px-4 py-2 rounded font-bold hover:bg-rose-700">Save Reproductive Event</button>
                </form>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-rose-200">
                  <button type="button" onClick={handleReproAIAnalysis} disabled={isReproAiLoading} className="w-full bg-purple-100 text-purple-700 hover:bg-purple-200 px-4 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50">
                    <Brain size={18}/> {isReproAiLoading ? 'Analyzing Repro History...' : 'Gemma Fertility & Parturition AI'}
                  </button>
                </div>
                {aiReproReport && (
                  <div className="bg-white border-2 border-purple-200 rounded-xl p-4 shadow-sm mt-4">
                    <div className="flex items-center gap-2 mb-2"><Sparkles size={16} className="text-purple-600"/><h4 className="font-bold text-purple-900 text-sm">AI Fertility Assessment</h4></div>
                    <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">{aiReproReport.replace(/\*/g, '')}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <datalist id="breed-options">{uniqueBreeds.map(b => <option key={b} value={b} />)}</datalist>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3"><Droplets className="text-blue-500 w-8 h-8" /><h1 className="text-xl font-bold text-slate-800">Production & Herd Management</h1></div>
          <div className="hidden md:flex items-center gap-4 text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 relative">
            <ThermometerSun size={16} className="text-amber-500"/>
            <span title="Powered by Open-Meteo API">{environment.season} | {environment.tempCelsius}°C | {environment.humidity}% RH</span>
            {environment.isLive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" title="Live Sensor"></span>}
            <div className="h-4 w-px bg-slate-300"></div>
            <button onClick={() => setShowWeatherConfig(!showWeatherConfig)} className="text-blue-500 hover:text-blue-700 transition flex items-center gap-1">
              <Settings size={14}/> Set GPS
            </button>

            {showWeatherConfig && (
              <div className="absolute top-12 right-0 bg-white p-4 rounded-xl border border-slate-200 shadow-xl z-50 w-64 animate-in fade-in">
                 <div className="flex justify-between items-center mb-3">
                   <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><MapPin size={14}/> GPS Settings</h3>
                   <button onClick={() => setShowWeatherConfig(false)}><X size={16} className="text-slate-400 hover:text-slate-700"/></button>
                 </div>
                 <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                       <label className="text-[10px] font-bold text-slate-500">LATITUDE</label>
                       <input type="number" step="any" value={latInput} onChange={e => setLatInput(e.target.value)} className="w-full border p-1.5 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500"/>
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-slate-500">LONGITUDE</label>
                       <input type="number" step="any" value={lngInput} onChange={e => setLngInput(e.target.value)} className="w-full border p-1.5 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500"/>
                    </div>
                 </div>
                 <button onClick={handleSaveLocation} className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded hover:bg-blue-700 transition">Update & Fetch Weather</button>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
          <button onClick={() => setActiveTab('daily')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'daily' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>Daily Operations</button>
          <button onClick={() => setActiveTab('directory')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'directory' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>Master Directory</button>
          <button onClick={() => setActiveTab('reproduction')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'reproduction' ? 'border-b-2 border-rose-600 text-rose-600' : 'text-slate-500'}`}>Reproduction Dashboard</button>
          <button onClick={() => setActiveTab('nutrition')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'nutrition' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500'}`}>Precision Nutrition</button>
          <button onClick={() => setActiveTab('parturition')} className={`pb-2 px-4 font-semibold transition ${activeTab === 'parturition' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-slate-500'}`}>Parturitions & Calves</button>
        </div>
      </div>

      {activeTab === 'daily' && (
        <div className="space-y-6 animate-in fade-in duration-300">
           <div className="flex justify-between items-center">
             <div className="bg-slate-200 p-1 rounded-lg flex gap-1">
               <button onClick={()=>setYieldEntryMode('bulk')} className={`px-4 py-2 rounded-md text-sm font-bold transition ${yieldEntryMode === 'bulk' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Bulk Farm Yield</button>
               <button onClick={()=>setYieldEntryMode('individual')} className={`px-4 py-2 rounded-md text-sm font-bold transition ${yieldEntryMode === 'individual' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Individual Cow Test</button>
             </div>
             <button onClick={() => setShowAddCow(!showAddCow)} className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition hover:bg-slate-800"><Plus size={16} /> Register Animal</button>
          </div>

          {showAddCow && (
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-inner">
              <h2 className="text-lg font-bold text-blue-900 mb-4 border-b border-blue-200 pb-2">Animal Profiling</h2>
              <form onSubmit={handleAddCow} className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">TAG/ID *</label>
                    <input type="text" required value={newCow.id} onChange={(e)=>setNewCow({...newCow, id: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">NICKNAME</label>
                    <input type="text" value={newCow.name} onChange={(e)=>setNewCow({...newCow, name: e.target.value})} className="w-full border p-2 rounded outline-none" placeholder="e.g. Bella" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">GENDER</label>
                    <select value={newCow.gender} onChange={(e)=>setNewCow({...newCow, gender: e.target.value})} className="w-full border p-2 rounded outline-none">
                      <option>Female</option>
                      <option>Male</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">BREED</label>
                    <input type="text" list="breed-options" value={newCow.breed} onChange={(e)=>setNewCow({...newCow, breed: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">BIRTH DATE</label>
                    <input type="date" value={newCow.birthDate} onChange={(e)=>setNewCow({...newCow, birthDate: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">STATUS</label>
                    <select value={newCow.status} onChange={(e)=>setNewCow({...newCow, status: e.target.value})} className="w-full border p-2 rounded outline-none">
                      <option>Active</option>
                      <option>Dry</option>
                      <option>Heifer</option>
                      <option>Calf</option>
                      <option>Sick</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1 flex items-center gap-1"><Target size={12}/> EXPECTED YIELD</label>
                    <input type="number" step="0.1" value={newCow.expectedYield} onChange={(e)=>setNewCow({...newCow, expectedYield: e.target.value})} className="w-full border border-blue-400 p-2 rounded outline-none bg-blue-100" placeholder="L/day" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white border border-blue-100 rounded-lg">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ORIGIN / SOURCE</label>
                    <select value={newCow.source} onChange={(e)=>setNewCow({...newCow, source: e.target.value})} className="w-full border p-2 rounded outline-none">
                      <option value="Farm Born">Born on Farm</option><option value="Purchased">Purchased Outside</option>
                    </select>
                  </div>
                  {newCow.source === 'Purchased' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">PURCHASE DATE</label>
                        <input type="date" value={newCow.purchaseDate} onChange={(e)=>setNewCow({...newCow, purchaseDate: e.target.value})} className="w-full border p-2 rounded outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">SELLER / OWNER</label>
                        <input type="text" value={newCow.ownerName} onChange={(e)=>setNewCow({...newCow, ownerName: e.target.value})} className="w-full border p-2 rounded outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">PRICE / DETAILS</label>
                        <input type="text" value={newCow.ownerDetails} onChange={(e)=>setNewCow({...newCow, ownerDetails: e.target.value})} className="w-full border p-2 rounded outline-none" />
                      </div>
                    </>
                  )}
                  {newCow.status === 'Dry' && (
                     <div>
                      <label className="block text-xs font-bold text-amber-700 mb-1">EXPECTED DUE DATE</label>
                      <input type="date" value={newCow.expectedDueDate} onChange={(e)=>setNewCow({...newCow, expectedDueDate: e.target.value})} className="w-full border border-amber-300 bg-amber-50 p-2 rounded outline-none" />
                     </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">DAM ID</label>
                    <input type="text" value={newCow.damId} onChange={(e)=>setNewCow({...newCow, damId: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">SIRE ID</label>
                    <input type="text" value={newCow.sireId} onChange={(e)=>setNewCow({...newCow, sireId: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">PARITY</label>
                    <input type="number" value={newCow.parity} onChange={(e)=>setNewCow({...newCow, parity: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">WEIGHT (kg)</label>
                    <input type="number" value={newCow.entryWeight} onChange={(e)=>setNewCow({...newCow, entryWeight: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">BCS</label>
                    <input type="number" step="0.25" value={newCow.bcs} onChange={(e)=>setNewCow({...newCow, bcs: e.target.value})} className="w-full border p-2 rounded outline-none" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button disabled={loading} type="submit" className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold disabled:bg-slate-400 transition">
                    {loading ? 'Syncing to Cloud...' : 'Register Animal'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><ClipboardList className="text-blue-600" /> {yieldEntryMode === 'bulk' ? 'Total Bulk Milk Entry' : 'Individual Test Day Entry'}</h2>
              {yieldEntryMode === 'bulk' ? (
                <form onSubmit={handleLogBulkYield} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">DATE</label>
                      <input type="date" value={bulkFormData.date} onChange={(e)=>setBulkFormData({...bulkFormData, date: e.target.value})} className="w-full p-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">SHIFT</label>
                      <select value={bulkFormData.shift} onChange={(e)=>setBulkFormData({...bulkFormData, shift: e.target.value})} className="w-full p-2 border rounded-lg">
                        <option>Morning</option>
                        <option>Evening</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">TOTAL FARM YIELD (LITERS)</label>
                    <input type="number" step="0.1" required value={bulkFormData.totalLiters} onChange={(e)=>setBulkFormData({...bulkFormData, totalLiters: e.target.value})} className="w-full p-3 border rounded-lg text-3xl font-black text-blue-700 bg-blue-50" placeholder="0.0" />
                  </div>
                  <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-slate-400">
                    <Save size={20} /> {loading ? 'Saving...' : 'Save Farm Total'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLogIndividualYield} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">DATE</label>
                      <input type="date" value={formData.date} onChange={(e)=>setFormData({...formData, date: e.target.value})} className="w-full p-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">SELECT COW</label>
                      <select required value={formData.cowId} onChange={(e)=>setFormData({...formData, cowId: e.target.value})} className="w-full p-2 border rounded-lg">
                        <option value="">-- Tag --</option>
                        {cows.filter(c=>c.gender==='Female' && c.status !== 'Calf').map(cow => (
                          <option key={cow.firestoreDocId} value={cow.id}>{cow.id} {cow.name ? `(${cow.name})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">SHIFT</label>
                      <select value={formData.shift} onChange={(e)=>setFormData({...formData, shift: e.target.value})} className="w-full p-2 border rounded-lg">
                        <option>Morning</option>
                        <option>Evening</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">YIELD (LITERS)</label>
                    <input type="number" step="0.1" required value={formData.yieldLiters} onChange={(e)=>setFormData({...formData, yieldLiters: e.target.value})} className="w-full p-2 border rounded-lg text-2xl font-bold" />
                  </div>
                  <button disabled={loading} className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-700 disabled:bg-slate-400">
                    <Save size={20} /> {loading ? 'Saving...' : 'Save Individual Record'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="mt-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-center mb-4 border-b pb-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="text-blue-600" /> Recent Milking History</h2>
                <button onClick={() => setShowAllMilk(!showAllMilk)} className="text-sm font-bold text-blue-600 hover:text-blue-800 transition">
                   {showAllMilk ? 'Show 10 Days' : 'View Entire History'}
                </button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="border-b-2 text-slate-500 text-xs uppercase">
                         <th className="py-3 px-4">Date</th>
                         <th className="py-3 px-4">Shift</th>
                         <th className="py-3 px-4">Type</th>
                         <th className="py-3 px-4">Cow / Group</th>
                         <th className="py-3 px-4 font-bold text-right">Yield (Liters)</th>
                      </tr>
                   </thead>
                   <tbody>
                      {(showAllMilk ? milkRecords : milkRecords.slice(0, 10)).map(record => (
                         <tr key={record.id} className="border-b hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-700">{record.date}</td>
                            <td className="py-3 px-4 text-sm">{record.shift}</td>
                            <td className="py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-widest">{record.type === 'bulk_total' ? 'Bulk Farm' : 'Individual'}</td>
                            <td className="py-3 px-4 text-sm">{record.type === 'bulk_total' ? 'Entire Herd' : `Tag #${record.cow_id}`}</td>
                            <td className="py-3 px-4 text-right font-black text-blue-700">{record.yield_liters} L</td>
                         </tr>
                      ))}
                      {milkRecords.length === 0 && <tr><td colSpan="5" className="py-8 text-center text-slate-400 font-medium">No milk records found.</td></tr>}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {/* REPRODUCTION MASTER DASHBOARD */}
      {activeTab === 'reproduction' && (
        <div className="space-y-6 animate-in fade-in duration-300">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                 <div>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Confirmed Pregnant</p>
                   <p className="text-3xl font-black text-emerald-600 mt-1">{cows.filter(c => c.pregnancyStatus === 'Pregnant Confirmed' || (c.status === 'Dry' && c.expectedDueDate)).length}</p>
                 </div>
                 <CalendarHeart size={32} className="text-emerald-100" />
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                 <div>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inseminated / Pending PD</p>
                   <p className="text-3xl font-black text-amber-500 mt-1">{cows.filter(c => c.pregnancyStatus === 'Inseminated').length}</p>
                 </div>
                 <Syringe size={32} className="text-amber-100" />
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                 <div>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Open / Repeat Breeders</p>
                   <p className="text-3xl font-black text-blue-600 mt-1">{cows.filter(c => c.gender === 'Female' && c.status !== 'Calf' && c.status !== 'Heifer' && (!c.pregnancyStatus || c.pregnancyStatus === 'Open' || c.pregnancyStatus === 'Repeat Breeder' || c.pregnancyStatus === 'Under Sync Protocol')).length}</p>
                 </div>
                 <AlertTriangle size={32} className="text-blue-100" />
              </div>
           </div>

           <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 shadow-sm mb-6">
             <h2 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2"><Clock size={20}/> Estrus & Action Calendar (Upcoming)</h2>
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse bg-white rounded-lg">
                 <thead>
                   <tr className="border-b-2 border-amber-100 text-amber-800 text-xs uppercase">
                     <th className="py-3 px-4">Tag</th>
                     <th className="py-3 px-4">Current Repro Status</th>
                     <th className="py-3 px-4">Scheduled Action Date</th>
                     <th className="py-3 px-4">Action Required</th>
                     <th className="py-3 px-4 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {upcomingActions.length > 0 ? upcomingActions.map(cow => (
                     <tr key={cow.firestoreDocId} className="border-b border-amber-50 hover:bg-amber-50/50">
                       <td className="py-3 px-4"><span className="font-bold">{cow.id}</span> {cow.name && <span className="text-xs text-slate-500 ml-1">({cow.name})</span>}</td>
                       <td className="py-3 px-4 text-sm">{cow.pregnancyStatus || 'Open'}</td>
                       <td className="py-3 px-4 font-bold text-amber-700">{cow.nextActionDate}</td>
                       <td className="py-3 px-4 text-sm font-bold text-slate-700">{cow.nextActionType}</td>
                       <td className="py-3 px-4 text-right">
                         <button onClick={() => setSelectedCow(cow)} className="text-amber-700 font-bold bg-amber-100 px-3 py-1 rounded">Log Action</button>
                       </td>
                     </tr>
                   )) : <tr><td colSpan="5" className="py-4 text-center text-sm text-amber-700 font-medium">No upcoming estrus or timed AI events scheduled.</td></tr>}
                 </tbody>
               </table>
             </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm mb-6">
               <h2 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2"><Calendar size={20}/> Pending PD Check (Inseminated)</h2>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="border-b-2 text-slate-500 text-xs uppercase">
                       <th className="py-3 px-4">Tag</th>
                       <th className="py-3 px-4">Date Bred</th>
                       <th className="py-3 px-4 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody>
                     {cows.filter(c => c.pregnancyStatus === 'Inseminated').map(cow => (
                       <tr key={cow.firestoreDocId} className="border-b hover:bg-slate-50">
                         <td className="py-3 px-4"><span className="font-bold">{cow.id}</span> {cow.name && <span className="text-xs text-slate-500 ml-1">({cow.name})</span>}</td>
                         <td className="py-3 px-4 text-sm">{cow.lastAIDate || '--'}</td>
                         <td className="py-3 px-4 text-right">
                           <button onClick={() => setSelectedCow(cow)} className="text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded">Log PD Check</button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>

             <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm mb-6">
               <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2"><AlertTriangle size={20}/> Open & Repeat Breeders</h2>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="border-b-2 text-slate-500 text-xs uppercase">
                       <th className="py-3 px-4">Tag</th>
                       <th className="py-3 px-4">Failed AI Count</th>
                       <th className="py-3 px-4 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody>
                     {cows.filter(c => c.gender === 'Female' && c.status !== 'Calf' && c.status !== 'Heifer' && (!c.pregnancyStatus || c.pregnancyStatus === 'Open' || c.pregnancyStatus === 'Repeat Breeder')).map(cow => (
                       <tr key={cow.firestoreDocId} className="border-b hover:bg-slate-50">
                         <td className="py-3 px-4"><span className="font-bold">{cow.id}</span> {cow.name && <span className="text-xs text-slate-500 ml-1">({cow.name})</span>}</td>
                         <td className="py-3 px-4 font-bold text-red-500">{cow.failedAIs || 0}</td>
                         <td className="py-3 px-4 text-right">
                           <button onClick={() => setSelectedCow(cow)} className="text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded">Start Protocol</button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm mb-6">
             <h2 className="text-lg font-bold text-emerald-900 mb-4 flex items-center gap-2"><Check size={20}/> Secured: Confirmed Pregnant</h2>
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b-2 text-slate-500 text-xs uppercase">
                     <th className="py-3 px-4">Tag</th>
                     <th className="py-3 px-4">Current Status</th>
                     <th className="py-3 px-4">Expected Due</th>
                     <th className="py-3 px-4">Sire / AI Used</th>
                     <th className="py-3 px-4 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {cows.filter(c => c.pregnancyStatus === 'Pregnant Confirmed' || (c.status === 'Dry' && c.expectedDueDate)).map(cow => (
                     <tr key={cow.firestoreDocId} className="border-b hover:bg-slate-50">
                       <td className="py-3 px-4"><span className="font-bold">{cow.id}</span> {cow.name && <span className="text-xs text-slate-500 ml-1">({cow.name})</span>}</td>
                       <td className="py-3 px-4 text-sm">{cow.status}</td>
                       <td className="py-3 px-4 font-bold text-emerald-700">{cow.expectedDueDate || '--'}</td>
                       <td className="py-3 px-4 text-sm">{cow.aiSireId || '--'}</td>
                       <td className="py-3 px-4 text-right">
                         <button onClick={() => setSelectedCow(cow)} className="text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded">Open Hub</button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
        </div>
      )}

      {activeTab === 'directory' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">BREED</label>
              <input type="text" list="breed-options" value={filterBreed} onChange={(e)=>setFilterBreed(e.target.value)} className="border p-2 rounded w-32" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">GENDER</label>
              <select value={filterGender} onChange={(e)=>setFilterGender(e.target.value)} className="border p-2 rounded">
                <option value="">All</option>
                <option>Female</option>
                <option>Male</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">STATUS</label>
              <select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)} className="border p-2 rounded">
                <option value="">All</option>
                <option>Active</option>
                <option>Dry</option>
                <option>Heifer</option>
                <option>Calf</option>
                <option>Sick</option>
                <option>Sold</option>
                <option>Dead</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">PARITY</label>
              <input type="number" value={filterParity} onChange={(e)=>setFilterParity(e.target.value)} className="border p-2 rounded w-20" />
            </div>
            <div className="ml-auto text-sm font-bold text-slate-500">Total Found: {filteredCows.length}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 text-slate-500 text-xs uppercase">
                  <th className="py-3 px-4">Tag & Name</th>
                  <th className="py-3 px-4">Breed</th>
                  <th className="py-3 px-4">Gender</th>
                  <th className="py-3 px-4">Auto Group</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCows.map(cow => (
                  <tr key={cow.firestoreDocId} className="border-b hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{cow.id}</div>
                      {cow.name && <div className="text-xs text-slate-500 font-medium">{cow.name}</div>}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{cow.breed}</td>
                    <td className="py-3 px-4 text-sm">{cow.gender}</td>
                    <td className="py-3 px-4 text-xs text-blue-600 font-bold">{getCowGroup(cow).replace('_', ' ')}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${cow.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : cow.status === 'Sold' || cow.status === 'Dead' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>
                        {cow.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => setSelectedCow(cow)} className="text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded">View Profile</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INDIVIDUAL PRECISION NUTRITION */}
      {activeTab === 'nutrition' && (
        <div className="animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              
              <div className="flex items-center justify-between mb-6 border-b pb-4">
                <div className="flex items-center gap-2"><Wheat className="text-emerald-600" /><h2 className="text-lg font-bold text-slate-800">Individual Precision Ration</h2></div>
                <select value={rationCowId} onChange={(e)=>setRationCowId(e.target.value)} className="bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold p-2 rounded-lg outline-none">
                  <option value="">-- Select Animal --</option>
                  {cows.filter(c => c.status !== 'Dead' && c.status !== 'Sold').map(cow => (
                    <option key={cow.id} value={cow.id}>Tag: {cow.id} {cow.name ? `(${cow.name})` : ''}</option>
                  ))}
                </select>
              </div>

              {targetCow && (
                <div className="mb-6 bg-emerald-50/50 p-4 rounded-lg border border-emerald-100 flex justify-between items-center">
                   <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Target Biology</p>
                      <p className="font-bold text-emerald-900 text-lg">Target Yield: {targetCow.expectedYield || 0}L | BW: {targetCow.entryWeight || 0}kg | BCS: {targetCow.bcs || 0}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</p>
                      <p className="font-bold text-slate-700">{targetCow.status} {targetCow.pregnancyStatus !== 'Open' ? `(${targetCow.pregnancyStatus})` : ''}</p>
                   </div>
                </div>
              )}

              {/* INGREDIENT UI BLOCK */}
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <FileText size={12}/> PROTOCOL / EXTRA CARE NOTES FOR THIS COW
                  </label>
                  <textarea value={rationNotes} onChange={(e)=>setRationNotes(e.target.value)} className="w-full border p-2 rounded outline-none h-10 text-sm" placeholder="e.g. Added extra 2kg carrots..."></textarea>
                </div>
                <div className="grid grid-cols-12 gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">
                  <div className="col-span-5">Feed Inventory Batch</div>
                  <div className="col-span-3">Amount (kg)</div>
                  <div className="col-span-3">Batch Unit Cost</div>
                  <div className="col-span-1 text-right"></div>
                </div>
                {rationRows.map((row) => {
                  const selectedInv = inventory.find(i => i.id === row.inventoryId);
                  const rowCost = selectedInv ? (parseFloat(row.amount || 0) * selectedInv.unit_cost).toFixed(2) : '0.00';
                  return (
                    <div key={row.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="col-span-5">
                        <select value={row.inventoryId} onChange={(e) => updateRationRow(row.id, 'inventoryId', e.target.value)} className="w-full border p-1.5 rounded text-sm bg-white outline-none">
                          <option value="">-- Select Feed Batch --</option>
                          {inventory.filter(i => ['Feed', 'Vegetable', 'Supplement'].includes(i.category) && i.current_stock > 0).map(inv => (
                            <option key={inv.id} value={inv.id}>{inv.item_name} {inv.brand ? `(${inv.brand})` : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input type="number" step="0.1" value={row.amount} onChange={(e) => updateRationRow(row.id, 'amount', e.target.value)} className="w-full border p-1.5 rounded text-sm outline-none" placeholder="kg" />
                      </div>
                      <div className="col-span-3 text-sm text-slate-600 flex items-center gap-1">
                        {selectedInv ? `₹${selectedInv.unit_cost.toFixed(2)}` : '--'} 
                        <span className="text-[10px] text-emerald-500 font-bold ml-1">₹{rowCost}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <button onClick={() => removeRationRow(row.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <button onClick={addRationRow} className="w-full mt-4 border-2 border-dashed border-slate-300 text-slate-500 py-2 rounded-lg hover:bg-slate-50 font-bold text-sm">+ Add Ingredient Row</button>
                
              <div className="mt-8 pt-6 border-t border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Brain className="text-purple-600" size={18} /> NooRganic-Vet Nutritionist
                  </h3>
                  <button 
                    type="button"
                    onClick={handleAIAnalysis}
                    disabled={isAiLoading || autoHeadcount === 0}
                    className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition disabled:opacity-50 border border-purple-200"
                  >
                    <Sparkles size={16} /> 
                    {isAiLoading ? 'Analyzing Diet...' : 'Analyze Current Ration'}
                  </button>
                </div>

                {aiNutritionReport && (
                  <div className="bg-white border-2 border-purple-200 rounded-xl p-6 shadow-sm mt-4 print:border-none print:shadow-none print:p-0">
                    <div className="flex justify-between items-center mb-4 border-b border-purple-100 pb-3 print:border-b-2 print:border-black">
                      <div>
                        <p className="text-xs font-bold text-purple-500 uppercase tracking-widest print:text-black">NooRganics FMS</p>
                        <h4 className="text-lg font-bold text-slate-800">AI Nutrition Assessment</h4>
                      </div>
                      <button 
                        onClick={() => window.print()}
                        className="print:hidden bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2"
                      >
                        Print Report
                      </button>
                    </div>
                    <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-medium">
                      {aiNutritionReport.replace(/\*/g, '')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-emerald-900 text-white p-6 rounded-xl shadow-md">
                <div className="flex items-center gap-2 mb-4 border-b border-emerald-700 pb-2"><Calculator size={18} /><h3 className="font-bold text-sm tracking-wider uppercase truncate">Daily Ration Cost</h3></div>
                <div className="text-4xl font-black mb-1">₹ {totalRationCost.toFixed(2)}</div>
                <p className="text-xs text-emerald-300 uppercase tracking-widest mb-6">Base Cost Per Cow</p>
                <div className="bg-emerald-800 p-4 rounded-lg space-y-3">
                  <div className="flex justify-between items-center border-b border-emerald-700 pb-2">
                    <span className="text-xs font-bold text-emerald-100">TARGET ANIMAL</span>
                    <span className="bg-emerald-200 text-emerald-900 font-black px-2 py-1 rounded">Tag {targetCow ? targetCow.id : '--'}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-emerald-200 pt-2">
                    <span>Total Ration Cost:</span>
                    <span>₹ {totalRationCost.toFixed(2)}</span>
                  </div>
                </div>
                <button disabled={loading} onClick={handleLockFeed} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 mt-4 py-3 rounded-lg font-black text-sm transition shadow-sm disabled:bg-slate-400">
                  {loading ? 'Processing...' : 'Lock Feed & Exhaust Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'parturition' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-purple-50 p-6 rounded-xl border border-purple-200 shadow-sm max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6 border-b border-purple-200 pb-4">
              <Baby className="text-purple-600 w-8 h-8" />
              <div>
                <h2 className="text-xl font-bold text-purple-900">Log Calving / Birth</h2>
                <p className="text-sm text-purple-700">Creates calf profile, tracks pedigree, and updates Dam parity.</p>
              </div>
            </div>
            
            <form onSubmit={handleLogBirth} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white rounded-lg border border-purple-100">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Genealogy</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-purple-900 mb-1">DAM ID (Mother) *</label>
                      <select required value={birthForm.damId} onChange={(e)=>setBirthForm({...birthForm, damId: e.target.value})} className="w-full border p-2 rounded outline-none">
                        <option value="">-- Select Dam --</option>
                        {cows.filter(c=>c.gender==='Female').map(c => (
                          <option key={c.firestoreDocId} value={c.id}>{c.id} {c.name ? `(${c.name})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-purple-900 mb-1">SIRE ID (Bull) / SEMEN STRAW ID</label>
                      <input type="text" value={birthForm.sireId} onChange={(e)=>setBirthForm({...birthForm, sireId: e.target.value})} className="w-full border p-2 rounded outline-none" placeholder="Known Sire or Semen details" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Calf Biology</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-purple-900 mb-1">DATE OF BIRTH *</label>
                        <input type="date" required value={birthForm.dob} onChange={(e)=>setBirthForm({...birthForm, dob: e.target.value})} className="w-full border p-2 rounded outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-purple-900 mb-1">GENDER</label>
                        <select value={birthForm.gender} onChange={(e)=>setBirthForm({...birthForm, gender: e.target.value})} className="w-full border p-2 rounded outline-none">
                          <option>Female</option>
                          <option>Male</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-purple-900 mb-1">BREED</label>
                        <input type="text" list="breed-options" value={birthForm.breed} onChange={(e)=>setBirthForm({...birthForm, breed: e.target.value})} className="w-full border p-2 rounded outline-none" placeholder="Inherited breed" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-purple-900 mb-1">BIRTH WEIGHT (kg)</label>
                        <input type="number" step="0.1" value={birthForm.birthWeight} onChange={(e)=>setBirthForm({...birthForm, birthWeight: e.target.value})} className="w-full border p-2 rounded outline-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white rounded-lg border border-purple-100">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Health & Vitality Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-purple-900 mb-1">HEALTH STATUS</label>
                    <select value={birthForm.healthStatus} onChange={(e)=>setBirthForm({...birthForm, healthStatus: e.target.value})} className="w-full border p-2 rounded outline-none">
                      <option value="Healthy">Healthy & Active</option>
                      <option value="Weak">Weak / Needs Care</option>
                      <option value="Dead">Stillborn / Dead</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-purple-900 mb-1">WALKING TIME (Mins)</label>
                    <input type="number" value={birthForm.walkingTimeMins} onChange={(e)=>setBirthForm({...birthForm, walkingTimeMins: e.target.value})} className="w-full border p-2 rounded outline-none" placeholder="Mins to stand" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-purple-900 cursor-pointer">
                      <input type="checkbox" checked={birthForm.colostrumFed} onChange={(e)=>setBirthForm({...birthForm, colostrumFed: e.target.checked})} className="w-5 h-5 accent-purple-600" /> Colostrum Fed
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-900 mb-1">POST-PARTUM NOTES (Dam & Calf)</label>
                  <textarea value={birthForm.notes} onChange={(e)=>setBirthForm({...birthForm, notes: e.target.value})} className="w-full border p-2 rounded outline-none h-16" placeholder="Describe calving difficulty, immediate meds given, etc."></textarea>
                </div>
              </div>

              <div className="flex justify-end gap-4 items-center border-t border-purple-200 pt-4">
                <p className="text-xs text-purple-600 italic">A temporary Tag ID (DDMMYYYY-X) will be auto-generated.</p>
                <button disabled={loading} type="submit" className="bg-purple-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-purple-700 disabled:bg-slate-400 transition flex items-center gap-2">
                  <Save size={18}/> {loading ? 'Logging...' : 'Log Birth & Link Genealogy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}