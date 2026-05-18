import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, Droplets, Wallet, Truck, 
  Users, PackageMinus, Stethoscope, 
  ListPlus, Leaf, ShieldAlert, HeartPulse, Baby,
  Banknote, CalendarDays, CheckCircle, AlertOctagon, 
  Info, TrendingUp, Star, Target, Send, Bot, 
  MessageSquare, Clock, CalendarRange, Sparkles
} from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { askGemma } from '../../services/AIEngine';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  const [cows, setCows] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [farmNews, setFarmNews] = useState([]);
  const [milkRecords, setMilkRecords] = useState([]);
  const [revenueLogs, setRevenueLogs] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [dispatchLogs, setDispatchLogs] = useState([]);

  // AI Chat State
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);

  const safeFetch = async (collectionName, q) => {
    try {
      const snap = await getDocs(q || collection(db, collectionName));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn(`Failed to fetch ${collectionName}`, e);
      return [];
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      
      try {
        const [cowData, invData, waitlistData, custData, delData, payData, spoilData, vpData, milkData, revData, medData, farmNewsData, dispatchData] = await Promise.all([
          safeFetch("cows"), safeFetch("inventory"), safeFetch("waitlist"),
          safeFetch("customers"), safeFetch("milk_deliveries"), safeFetch("customer_payments"),
          safeFetch("spoilage_logs"), safeFetch("vendor_payments"), safeFetch("milk_records"), 
          safeFetch("revenue_logs"), safeFetch("medical_records"), safeFetch("farm_news"),
          safeFetch("dispatch_logs", query(collection(db, "dispatch_logs"), orderBy("timestamp", "desc")))
        ]);

        setCows(cowData);
        setInventory(invData);
        setWaitlist(waitlistData);
        setCustomers(custData);
        setDeliveries(delData);
        setPayments(payData);
        setMilkRecords(milkData);
        setRevenueLogs(revData);
        setMedicalRecords(medData);
        setDispatchLogs(dispatchData);

        let newsStream = [];
        const now = new Date();
        
        invData.forEach(item => {
          if(item.timestamp?.seconds) {
            newsStream.push({
              id: `inv_${item.id}`, date: new Date(item.timestamp.seconds * 1000),
              type: 'purchase', icon: PackageMinus, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200',
              title: 'Inventory Purchased', desc: `${item.total_quantity || 0} ${item.unit || ''} of ${item.item_name || 'Item'} from ${item.vendor || 'Vendor'}.`
            });
          }
          if((parseFloat(item.current_stock) || 0) < 15) {
            newsStream.push({
              id: `low_stock_${item.id}`, date: now,
              type: 'alert', icon: AlertOctagon, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200',
              title: 'Low Stock Alert', desc: `${item.item_name} is running critically low (${item.current_stock} remaining).`
            });
          }
        });

        cowData.forEach(cow => {
          if(cow.source === 'Farm Born' && cow.registered_at?.seconds) {
            newsStream.push({
              id: `birth_${cow.id}`, date: new Date(cow.registered_at.seconds * 1000),
              type: 'birth', icon: Baby, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200',
              title: 'New Calf Born', desc: `Tag #${cow.id || 'N/A'} (${cow.gender || 'Unknown'} ${cow.breed || ''}) was successfully registered.`
            });
          }
        });

        revData.forEach(rev => {
          if(rev.recorded_at?.seconds) {
            newsStream.push({
              id: `rev_${rev.id}`, date: new Date(rev.recorded_at.seconds * 1000),
              type: 'revenue', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200',
              title: 'Asset Revenue Logged', desc: `${rev.type || 'Revenue'} - INR ${parseFloat(rev.amount || 0).toLocaleString()} logged for Tag #${rev.cow_id || 'N/A'}.`
            });
          }
        });

        medData.forEach(med => {
          if(med.recorded_at?.seconds) {
            const conditionName = med.disease_class ? med.disease_class.replace('_', ' ') : (med.condition || 'Unknown Condition');
            const medsGiven = med.medicine_name || med.treatment || 'Medication';
            
            newsStream.push({
              id: `med_${med.id}`, date: new Date(med.recorded_at.seconds * 1000),
              type: 'medical', icon: Stethoscope, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200',
              title: 'Medical Treatment Logged', desc: `Tag #${med.cow_id || 'N/A'} treated for ${conditionName} with ${medsGiven}.`
            });
          }
        });

        waitlistData.forEach(w => {
           if(w.status === 'Pending') {
             newsStream.push({
               id: `lead_${w.id}`, date: now,
               type: 'lead', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200',
               title: 'New Customer Lead', desc: `${w.name || 'A customer'} is waiting for approval to join routes.`
             });
           }
        });

        farmNewsData.forEach(news => {
          if(news.recorded_at?.seconds) {
            newsStream.push({
              id: `news_${news.id}`, date: new Date(news.recorded_at.seconds * 1000),
              type: 'milestone', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200',
              title: news.title || 'System Alert', desc: news.message || 'No details provided.'
            });
          }
        });

        newsStream.sort((a, b) => b.date - a.date);
        setFarmNews(newsStream.slice(0, 15));
      } catch (error) {
        console.error("Dashboard Data Assembly Failed:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date();
  
  const liveHerd = cows.filter(c => !['Sold', 'Dead'].includes(c.status || ''));
  const totalHeadcount = liveHerd.length;
  
  const activeMilkers = liveHerd.filter(c => c.status === 'Active' && c.gender === 'Female').length;
  const dryCows = liveHerd.filter(c => c.status === 'Dry').length;
  const youngStock = liveHerd.filter(c => ['Calf', 'Heifer'].includes(c.status || '')).length;
  const sickCows = liveHerd.filter(c => c.status === 'Sick');
  
  const pregnantCows = liveHerd.filter(c => c.pregnancyStatus === 'Pregnant Confirmed' || (c.status === 'Dry' && c.expectedDueDate));
  const heatCows = liveHerd.filter(c => ['Open', 'Repeat Breeder', 'Under Sync Protocol'].includes(c.pregnancyStatus || '') && !['Calf', 'Heifer'].includes(c.status || ''));

  const activeTreatments = medicalRecords.filter(record => {
    if (!record.recorded_at?.seconds || !record.course_duration) return false;
    const startDate = new Date(record.recorded_at.seconds * 1000);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + parseInt(record.course_duration));
    return endDate >= today;
  });

  const herdPieData = [
    { name: 'Active Milkers', value: activeMilkers, color: '#3b82f6' },
    { name: 'Dry', value: dryCows, color: '#f59e0b' },
    { name: 'Young Stock', value: youngStock, color: '#10b981' }
  ].filter(d => d.value > 0);

  const todaysMilkRecords = milkRecords.filter(m => m.date === todayStr);
  const totalYieldToday = todaysMilkRecords.reduce((sum, record) => sum + parseFloat(record.yield_liters || 0), 0);
  
  let starMilker = { id: 'N/A', yield: 0 };
  todaysMilkRecords.filter(m => m.type === 'individual').forEach(record => {
     if (parseFloat(record.yield_liters || 0) > starMilker.yield) {
       starMilker = { id: record.cow_id || 'N/A', yield: parseFloat(record.yield_liters || 0) };
     }
  });

  // Delivery & Fulfillment Logic
  const activeCustomerList = customers.filter(c => c.status === 'Active');
  const totalRequiredToday = activeCustomerList.reduce((sum, c) => sum + (parseFloat(c.dailyRequirement || c.subscriptionLiters || 1)), 0);
  
  const todaysDispatches = dispatchLogs.filter(d => {
    if (!d.timestamp?.seconds) return false;
    const dDate = new Date(d.timestamp.seconds * 1000).toISOString().split('T')[0];
    return dDate === todayStr;
  });
  const totalDispatchedToday = todaysDispatches.reduce((sum, d) => sum + (parseFloat(d.qty) || 0), 0);

  const totalDeliveredToday = deliveries.filter(d => d.date === todayStr).reduce((sum, d) => sum + parseFloat(d.liters_delivered || d.liters || 0), 0);
  const pendingDeliveryToday = Math.max(0, totalRequiredToday - totalDeliveredToday);

  const lowStockItems = inventory.filter(i => (parseFloat(i.current_stock) || 0) < 15);
  const activeCustomers = activeCustomerList.length;
  const pendingLeads = waitlist.filter(w => w.status === 'Pending');

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
  let cumulativePendency = 0;
  let currentMonthBilled = 0;
  let currentMonthPaid = 0;
  let defaultersCount = 0;

  customers.forEach(cust => {
    const custDels = deliveries.filter(d => d.customer_id === cust.id);
    const custPays = payments.filter(p => p.customer_id === cust.id);
    
    const billedAllTime = custDels.reduce((sum, d) => sum + (parseFloat(d.total_value) || 0), 0);
    const paidAllTime = custPays.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const netBalance = billedAllTime - paidAllTime;
    
    if (netBalance > 0 && !cust.isStaff) {
      cumulativePendency += netBalance;
      defaultersCount++;
    }

    const thisMonthDels = custDels.filter(d => (d.date || '').startsWith(currentMonth));
    const thisMonthPays = custPays.filter(p => (p.date || '').startsWith(currentMonth));
    
    currentMonthBilled += thisMonthDels.reduce((sum, d) => sum + (parseFloat(d.total_value) || 0), 0);
    currentMonthPaid += thisMonthPays.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  });

  const thisMonthAssetRevenue = revenueLogs
    .filter(r => (r.date || '').startsWith(currentMonth))
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const totalMonthRevenue = currentMonthPaid + thisMonthAssetRevenue;
  const currentMonthPendency = currentMonthBilled - currentMonthPaid;
  const collectionRate = currentMonthBilled > 0 ? Math.round((currentMonthPaid / currentMonthBilled) * 100) : 0;

  // AI Agent Handler
  const handleAskFarmAI = async (e) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    
    setIsAiTyping(true);
    setAiResponse('');
    
    const systemContext = `You are the NooRganics Farm Central AI. 
    You have direct access to the live mainframe data:
    - Total Herd Count: ${totalHeadcount} cows (${activeMilkers} lactating, ${dryCows} dry, ${sickCows.length} sick).
    - Today's Milk Yield: ${totalYieldToday.toFixed(1)} Liters.
    - Delivery Status: ${totalRequiredToday} L required today. ${totalDeliveredToday} L delivered so far. ${pendingDeliveryToday} L pending.
    - Outstanding Finances: INR ${cumulativePendency.toLocaleString()} pending from ${defaultersCount} customers. Current month revenue is INR ${totalMonthRevenue.toLocaleString()}.
    - Operational Alerts: ${lowStockItems.length} inventory items are low stock. ${pendingLeads.length} new customer leads are pending.

    The user is going to ask you a question. Answer the user directly, concisely, and professionally using ONLY the facts provided in this prompt.`;

    try {
      const result = await askGemma(aiQuery, systemContext);
      setAiResponse(result);
    } catch (error) {
      setAiResponse("System Alert: Unable to reach the AI Engine. Please check your connection.");
    } finally {
      setIsAiTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[80vh] text-slate-400">
        <Activity className="animate-spin mb-4 text-blue-500" size={40} />
        <p className="font-black tracking-widest uppercase text-slate-500">Syncing Mainframe...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-20">
      
      {/* COMMAND HEADER */}
      <div className="bg-slate-900 p-8 rounded-2xl shadow-xl text-white relative overflow-hidden flex flex-col lg:flex-row justify-between lg:items-center gap-6">
        <div className="relative z-10">
          <h1 className="text-3xl font-black tracking-tight mb-2 flex items-center gap-3">
            <Activity className="text-emerald-400" size={32}/> Command Dashboard
          </h1>
          <p className="text-slate-400 font-medium">System auto-synced. Overview of farm health, logistics, and critical operations.</p>
        </div>
        
        {/* LIVE AI AGENT TERMINAL IN HEADER */}
        <div className="relative z-10 w-full lg:w-1/2 bg-slate-800/80 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-inner">
          <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
            <span className="text-[10px] font-black tracking-widest uppercase text-purple-400 flex items-center gap-2">
              <Bot size={14}/> Farm Intelligence Agent
            </span>
            <span className="text-[9px] uppercase tracking-widest text-slate-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Listening
            </span>
          </div>
          
          <form onSubmit={handleAskFarmAI} className="flex gap-2">
            <input 
              type="text" 
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="Ask about yields, deliveries, or finances..."
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white outline-none focus:border-purple-500 transition"
            />
            <button 
              type="submit" 
              disabled={isAiTyping || !aiQuery.trim()}
              className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg transition disabled:bg-slate-700"
            >
              <Send size={16}/>
            </button>
          </form>

          {/* AI Response Area */}
          {(isAiTyping || aiResponse) && (
            <div className="mt-3 bg-slate-900/50 rounded p-3 border border-slate-700/50">
              {isAiTyping ? (
                <div className="flex items-center gap-2 text-xs text-purple-300 font-mono">
                  <Sparkles size={12} className="animate-spin"/> Processing telemetry...
                </div>
              ) : (
                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
                  <span className="text-purple-400 font-bold mr-2">AI:</span>
                  {aiResponse.replace(/\*/g, '')}
                </div>
              )}
            </div>
          )}
        </div>
        <Leaf className="absolute -left-10 -bottom-10 w-64 h-64 text-slate-800 opacity-20 z-0 pointer-events-none" />
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div onClick={() => navigate('/production', { state: { activeTab: 'directory' } })} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Live Headcount</p>
            <Target size={16} className="text-slate-400"/>
          </div>
          <p className="text-3xl font-black text-slate-800">{totalHeadcount}</p>
          <p className="text-xs font-bold text-emerald-600 mt-2 bg-emerald-50 inline-block px-2 py-0.5 rounded">{activeMilkers} Active Milkers</p>
        </div>

        <div onClick={() => navigate('/production', { state: { activeTab: 'daily' } })} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Today's Yield</p>
            <Droplets size={16} className="text-blue-500"/>
          </div>
          <p className="text-3xl font-black text-blue-700">{totalYieldToday.toFixed(1)} <span className="text-lg">L</span></p>
          <div className="flex items-center gap-2 mt-2">
             <p className="text-xs font-bold text-slate-600 bg-slate-100 inline-flex items-center gap-1 px-2 py-0.5 rounded">
               <Star size={10}/> {starMilker.yield > 0 ? `#${starMilker.id} (${starMilker.yield}L)` : 'No Star'}
             </p>
             <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 inline-flex items-center gap-1 px-2 py-0.5 rounded">
               <Truck size={10}/> Sent: {totalDispatchedToday}L
             </p>
          </div>
        </div>

        <div onClick={() => navigate('/production', { state: { activeTab: 'reproduction' } })} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Secured Pregnancies</p>
            <Baby size={16} className="text-purple-500"/>
          </div>
          <p className="text-3xl font-black text-purple-700">{pregnantCows.length}</p>
          <p className="text-xs font-bold text-purple-600 mt-2 bg-purple-50 inline-block px-2 py-0.5 rounded">{youngStock} Calves/Heifers on Farm</p>
        </div>

        <div onClick={() => navigate('/economics', { state: { activeTab: 'reports' } })} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Month Revenue</p>
            <Wallet size={16} className="text-emerald-500"/>
          </div>
          <p className="text-3xl font-black text-emerald-700">₹{totalMonthRevenue.toLocaleString()}</p>
          <p className="text-xs font-bold text-slate-500 mt-2">Milk + Asset Sales</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT & CENTER COLUMNS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Operations Alerts Banner */}
          {(sickCows.length > 0 || lowStockItems.length > 0 || pendingLeads.length > 0 || heatCows.length > 0) && (
            <div className="bg-white border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm border-y border-r border-slate-200">
              <h2 className="text-red-800 font-black flex items-center gap-2 mb-4">
                <ShieldAlert size={20} /> Actionable Operations Alerts
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {sickCows.length > 0 && (
                  <div onClick={() => navigate('/production', { state: { activeTab: 'directory', filterStatus: 'Sick' } })} className="bg-red-50 p-4 rounded-xl border border-red-100 cursor-pointer hover:shadow-md transition group text-center">
                    <div className="mx-auto bg-red-100 text-red-600 w-10 h-10 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition"><Stethoscope size={20}/></div>
                    <p className="text-2xl font-black text-red-700">{sickCows.length}</p>
                    <p className="text-[10px] font-bold text-red-900 uppercase mt-1 tracking-wider">Sick / Rx</p>
                  </div>
                )}
                {heatCows.length > 0 && (
                  <div onClick={() => navigate('/production', { state: { activeTab: 'reproduction' } })} className="bg-pink-50 p-4 rounded-xl border border-pink-100 cursor-pointer hover:shadow-md transition group text-center">
                    <div className="mx-auto bg-pink-100 text-pink-600 w-10 h-10 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition"><HeartPulse size={20}/></div>
                    <p className="text-2xl font-black text-pink-700">{heatCows.length}</p>
                    <p className="text-[10px] font-bold text-pink-900 uppercase mt-1 tracking-wider">Estrus / AI Hub</p>
                  </div>
                )}
                {lowStockItems.length > 0 && (
                  <div onClick={() => navigate('/economics', { state: { activeTab: 'inventory' } })} className="bg-amber-50 p-4 rounded-xl border border-amber-100 cursor-pointer hover:shadow-md transition group text-center">
                    <div className="mx-auto bg-amber-100 text-amber-600 w-10 h-10 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition"><PackageMinus size={20}/></div>
                    <p className="text-2xl font-black text-amber-700">{lowStockItems.length}</p>
                    <p className="text-[10px] font-bold text-amber-900 uppercase mt-1 tracking-wider">Low Stock</p>
                  </div>
                )}
                {pendingLeads.length > 0 && (
                  <div onClick={() => navigate('/logistics', { state: { activeTab: 'waitlist' } })} className="bg-blue-50 p-4 rounded-xl border border-blue-100 cursor-pointer hover:shadow-md transition group text-center">
                    <div className="mx-auto bg-blue-100 text-blue-600 w-10 h-10 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition"><Users size={20}/></div>
                    <p className="text-2xl font-black text-blue-700">{pendingLeads.length}</p>
                    <p className="text-[10px] font-bold text-blue-900 uppercase mt-1 tracking-wider">Pending Leads</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active Medical Treatments */}
          {activeTreatments.length > 0 && (
            <div onClick={() => navigate('/production', { state: { activeTab: 'directory' } })} className="bg-white border-l-4 border-rose-500 p-6 rounded-r-xl shadow-sm border-y border-r border-slate-200 cursor-pointer hover:shadow-md transition">
              <h2 className="text-rose-800 font-black flex items-center gap-2 mb-4">
                <Stethoscope size={20} /> Active Medical Treatments & Courses
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeTreatments.map(treatment => {
                   const startDate = new Date(treatment.recorded_at?.seconds * 1000);
                   const endDate = new Date(startDate);
                   endDate.setDate(endDate.getDate() + parseInt(treatment.course_duration || 0));
                   const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                   
                   const conditionName = treatment.disease_class ? treatment.disease_class.replace('_', ' ') : (treatment.condition || 'Unknown Condition');
                   
                   return (
                     <div key={treatment.id} className="bg-rose-50 p-4 rounded-lg border border-rose-100">
                       <div className="flex justify-between items-start mb-2">
                         <span className="font-black text-rose-700 text-lg">Tag #{treatment.cow_id || 'N/A'}</span>
                         <span className="bg-rose-200 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">{daysRemaining} Days Left</span>
                       </div>
                       <p className="font-bold text-slate-800 text-sm">{conditionName}</p>
                       <p className="text-xs text-slate-600 mt-1">Administer: <span className="font-bold text-emerald-600">{treatment.medicine_name || treatment.treatment || 'Medication'}</span> ({treatment.dose_given || '?'} units)</p>
                       <p className="text-[10px] text-slate-400 mt-2 italic line-clamp-1">Prognosis: {treatment.prognosis || 'Monitoring'}</p>
                     </div>
                   );
                })}
              </div>
            </div>
          )}

          {/* Accounts Receivable & Billing */}
          <div onClick={() => navigate('/logistics', { state: { activeTab: 'billing' } })} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6"><Banknote className="text-emerald-600"/> Accounts Receivable & Billing</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-center relative overflow-hidden">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 relative z-10">All-Time Cumulative Due</p>
                <p className="text-3xl font-black text-red-600 relative z-10">₹ {cumulativePendency.toLocaleString()}</p>
                <p className="text-xs font-bold text-red-800 bg-red-100 inline-block px-2 py-0.5 rounded mt-2 relative z-10">{defaultersCount} Customers</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-center">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Current Month Billed</p>
                <p className="text-3xl font-black text-slate-800">₹ {currentMonthBilled.toLocaleString()}</p>
                <p className="text-xs font-bold text-slate-500 mt-2">For Current Period</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl flex flex-col justify-center">
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 text-center">Month Collection Rate</p>
                 <div className="w-full bg-slate-200 rounded-full h-4 mb-2 overflow-hidden border border-slate-300">
                    <div className="bg-emerald-500 h-4 rounded-full transition-all duration-1000" style={{ width: `${collectionRate}%` }}></div>
                 </div>
                 <div className="flex justify-between text-xs font-bold text-slate-600">
                   <span>{collectionRate}% Collected</span>
                   <span className="text-red-500">₹{currentMonthPendency > 0 ? currentMonthPendency.toLocaleString() : 0} Due</span>
                 </div>
              </div>
            </div>
          </div>

          {/* Module Navigators */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div onClick={() => navigate('/production', { state: { activeTab: 'directory' } })} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-300 transition cursor-pointer group flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2"><Droplets size={20} className="text-blue-500" /><h3 className="font-bold text-slate-800 text-lg">Production</h3></div>
                <div className="text-sm text-slate-500 font-medium">Active Milkers: <span className="font-black text-blue-600">{activeMilkers}</span></div>
                <div className="text-sm text-slate-500 font-medium">Dry Herd: <span className="font-black text-amber-600">{dryCows}</span></div>
              </div>
              <div className="w-24 h-24">
                {herdPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={herdPieData} cx="50%" cy="50%" innerRadius={25} outerRadius={40} dataKey="value" stroke="none">
                        {herdPieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400 text-center">No Data</div>
                )}
              </div>
            </div>

            <div onClick={() => navigate('/economics', { state: { activeTab: 'inventory' } })} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-emerald-300 transition cursor-pointer group flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2"><Wallet size={20} className="text-emerald-500" /><h3 className="font-bold text-slate-800 text-lg">Economics</h3></div>
                <div className="text-sm text-slate-500 font-medium">Inv Items: <span className="font-black text-slate-700">{inventory.length}</span></div>
                <div className="text-sm text-slate-500 font-medium">Unpaid A/P: <span className="font-black text-amber-600">Check Ledger</span></div>
              </div>
              <div className="w-24 h-24 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center bg-emerald-50">
                  <Wallet size={24} className="text-emerald-600"/>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DISPATCH & NEWS FEED */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* UPDATED LOGISTICS & FULFILLMENT HUB */}
          <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-700 overflow-hidden relative">
            <Truck className="absolute -right-4 -bottom-4 w-32 h-32 text-slate-800 opacity-50 z-0" />
            <div className="p-5 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center relative z-10">
              <h2 className="font-black text-white flex items-center gap-2"><Truck size={18} className="text-emerald-400"/> Logistics & Fulfillment Hub</h2>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-900/50 px-2 py-0.5 rounded border border-emerald-700">Live</span>
            </div>
            
            <div className="p-5 space-y-4 relative z-10">
              <div className="flex justify-between items-end border-b border-slate-700 pb-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Required Today</p>
                  <p className="text-[10px] text-slate-500">Based on active subscriptions</p>
                </div>
                <p className="text-2xl font-black text-white">{totalRequiredToday.toFixed(1)} L</p>
              </div>
              
              <div className="flex justify-between items-end border-b border-slate-700 pb-3">
                <div>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Dispatched / Sent</p>
                  <p className="text-[10px] text-slate-500">Left the farm gate</p>
                </div>
                <p className="text-2xl font-black text-blue-300">{totalDispatchedToday.toFixed(1)} L</p>
              </div>

              <div className="flex justify-between items-end border-b border-slate-700 pb-3">
                <div>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Successfully Delivered</p>
                  <p className="text-[10px] text-slate-500">Logged by delivery managers</p>
                </div>
                <p className="text-2xl font-black text-emerald-400">{totalDeliveredToday.toFixed(1)} L</p>
              </div>

              <div className="flex justify-between items-end pb-1">
                <div>
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Pending Fulfillment</p>
                </div>
                <p className="text-xl font-black text-rose-400">{pendingDeliveryToday.toFixed(1)} L</p>
              </div>
            </div>

            <div className="bg-slate-800/80 p-4 border-t border-slate-700 relative z-10 flex justify-between items-center">
               <p className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><CalendarRange size={14} className="text-indigo-400"/> Required Tomorrow:</p>
               <p className="text-lg font-black text-white">{totalRequiredToday.toFixed(1)} L</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[650px]">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-black text-slate-800 flex items-center gap-2"><CalendarDays className="text-indigo-600"/> Live Farm News & Alerts</h2>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto space-y-6">
              {farmNews.length > 0 ? farmNews.map((news) => (
                <div key={news.id} className="relative pl-6 before:absolute before:left-[11px] before:top-8 before:bottom-[-24px] before:w-0.5 before:bg-slate-200 last:before:hidden">
                  <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${news.bg} ${news.border}`}>
                    <news.icon size={12} className={news.color} />
                  </div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{news.title}</span>
                    <span className="text-[9px] font-bold text-slate-400">{news.date.toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">{news.desc}</p>
                </div>
              )) : (
                <div className="text-center py-12">
                  <Info size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-500">No recent activity.</p>
                  <p className="text-xs text-slate-400 mt-1">Log operations to see them stream here.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}