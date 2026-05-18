import { useState, useEffect } from 'react';
import { 
  LineChart as ChartIcon, ThermometerSun, Wheat, Activity, 
  IndianRupee, TrendingDown, TrendingUp, AlertTriangle, 
  Calculator, Settings2, RefreshCcw, Save, Droplets, HeartPulse,
  CheckCircle, FileText, Brain, Sparkles, Syringe, Stethoscope 
} from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { 
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ReferenceLine 
} from 'recharts';
import { askGemma } from "../../services/AIEngine";

export default function Forecaster() {
  const [loading, setLoading] = useState(true);
  
  // Real Baseline Data (Fetched from Firebase)
  const [baselines, setBaselines] = useState({
    activeCows: 0,
    dailyYieldLiters: 0,
    monthlyFeedCost: 0,
    monthlyMedCost: 0,
    monthlyLaborCost: 0,
    monthlyUtilityCost: 0,
    currentMilkPrice: 60,
    averageSpoilageRate: 2
  });

  // The Simulation Parameters
  const [simParams, setSimParams] = useState({
    milkPrice: 60,
    feedInflation: 0,      
    heatStressDrop: 0,      
    diseaseSpike: 0,        
    spoilageRate: 2,        
    utilityInflation: 0,    
    routeExpansion: 0,      
    repeaterRate: 0         // NEW: Simulating reproductive failure rate
  });

  // AI State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [cfoForecast, setCfoForecast] = useState(null);
  const [vetForecast, setVetForecast] = useState(null);

  useEffect(() => {
    const fetchBaselines = async () => {
      setLoading(true);
      try {
        const currentMonthStr = new Date().toISOString().slice(0, 7);
        
        const cSnap = await getDocs(collection(db, "cows")).catch(()=>({docs:[]}));
        const hSnap = await getDocs(collection(db, "herd")).catch(()=>({docs:[]}));
        const lSnap = await getDocs(collection(db, "livestock")).catch(()=>({docs:[]}));
        const allAnimals = [...cSnap.docs, ...hSnap.docs, ...lSnap.docs].map(d => d.data());
        const activeLactating = allAnimals.filter(a => a.status !== 'Sold' && a.status !== 'Dead' && (a.stage === 'Lactating' || a.status === 'Lactating')).length || 15;

        const milkSnap = await getDocs(query(collection(db, "milk_records"), orderBy("date", "desc"))).catch(()=>({docs:[]}));
        const recentMilk = milkSnap.docs.map(d => d.data()).filter(m => (m.date || '').startsWith(currentMonthStr));
        const dailyYield = recentMilk.reduce((sum, m) => sum + (Number(m.yield_liters) || 0), 0) / (new Date().getDate() || 1);
        const fallbackYield = activeLactating * 12;

        const feedSnap = await getDocs(collection(db, "group_feed_logs")).catch(()=>({docs:[]}));
        const medSnap = await getDocs(collection(db, "medical_records")).catch(()=>({docs:[]}));
        const currentFeed = feedSnap.docs.map(d => d.data()).reduce((sum, f) => sum + (Number(f.total_cost) || 0), 0) || 45000;
        const currentMeds = medSnap.docs.map(d => d.data()).reduce((sum, m) => sum + (Number(m.cost_incurred) || 0), 0) || 5000;

        const empSnap = await getDocs(collection(db, "employees")).catch(()=>({docs:[]}));
        const utilSnap = await getDocs(collection(db, "utility_logs")).catch(()=>({docs:[]}));
        const totalLabor = empSnap.docs.map(d => d.data()).reduce((sum, e) => sum + (Number(e.baseSalary) || 0), 0) || 25000;
        const totalUtils = utilSnap.docs.map(d => d.data()).filter(u => (u.date || '').startsWith(currentMonthStr)).reduce((sum, u) => sum + (Number(u.amount) || 0), 0) || 8000;

        const currentPrice = Number(localStorage.getItem('fms_milk_sale_price')) || 60;

        setBaselines({
          activeCows: activeLactating,
          dailyYieldLiters: dailyYield > 0 ? dailyYield : fallbackYield,
          monthlyFeedCost: currentFeed,
          monthlyMedCost: currentMeds,
          monthlyLaborCost: totalLabor,
          monthlyUtilityCost: totalUtils,
          currentMilkPrice: currentPrice,
          averageSpoilageRate: 2
        });

        setSimParams(prev => ({ ...prev, milkPrice: currentPrice }));

      } catch (error) {
        console.error("Error fetching simulation baselines", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBaselines();
  }, []);

  // =========================================================================
  // SIMULATION ENGINE CORE MATH
  // =========================================================================

  const baseMonthlyYield = (Number(baselines.dailyYieldLiters) || 0) * 30;
  const baseGrossRevenue = baseMonthlyYield * (Number(baselines.currentMilkPrice) || 0);
  const baseSpoilageLoss = baseGrossRevenue * ((Number(baselines.averageSpoilageRate) || 0) / 100);
  const baseNetRevenue = baseGrossRevenue - baseSpoilageLoss;
  const baseTotalOpex = (Number(baselines.monthlyFeedCost) || 0) + (Number(baselines.monthlyLaborCost) || 0) + (Number(baselines.monthlyUtilityCost) || 0) + (Number(baselines.monthlyMedCost) || 0);
  const baseNetProfit = baseNetRevenue - baseTotalOpex;
  const baseCpl = baseMonthlyYield > 0 ? (baseTotalOpex / baseMonthlyYield) : 0;

  const simYieldModifier = 1 - ((Number(simParams.heatStressDrop) || 0) / 100);
  const simDemandModifier = 1 + ((Number(simParams.routeExpansion) || 0) / 100);
  
  // Apply a synthetic yield penalty based on the repeater breeder rate 
  // (Assuming each % of repeater rate causes a 0.5% drop in long-term herd yield due to extended open days)
  const repeaterPenalty = 1 - (((Number(simParams.repeaterRate) || 0) * 0.5) / 100);

  const simMonthlyYield = baseMonthlyYield * simYieldModifier * repeaterPenalty;
  const simEffectiveYield = simMonthlyYield * simDemandModifier; 
  
  const simGrossRevenue = simEffectiveYield * (Number(simParams.milkPrice) || 0);
  const simSpoilageLoss = simGrossRevenue * ((Number(simParams.spoilageRate) || 0) / 100);
  const simNetRevenue = simGrossRevenue - simSpoilageLoss;

  const simFeedCost = (Number(baselines.monthlyFeedCost) || 0) * (1 + ((Number(simParams.feedInflation) || 0) / 100));
  const simUtilCost = (Number(baselines.monthlyUtilityCost) || 0) * (1 + ((Number(simParams.utilityInflation) || 0) / 100));
  
  // Extra medical costs compound if repeater rate is high (hormones, extra vet visits)
  const repeaterMedCost = (Number(simParams.repeaterRate) || 0) * 500; 
  const simMedCost = (Number(baselines.monthlyMedCost) || 0) + (Number(simParams.diseaseSpike) || 0) + repeaterMedCost;
  
  const simTotalOpex = simFeedCost + (Number(baselines.monthlyLaborCost) || 0) + simUtilCost + simMedCost;

  const simNetProfit = simNetRevenue - simTotalOpex;
  const simCpl = simEffectiveYield > 0 ? (simTotalOpex / simEffectiveYield) : 0;

  const generateProjectionData = () => {
    const months = ['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6'];
    let data = [];
    
    for (let i = 0; i < 6; i++) {
      const compoundedFeed = simFeedCost * Math.pow(1.01, i); 
      const compoundedUtil = simUtilCost * Math.pow(1.005, i);
      const dynamicMed = i === 0 ? simMedCost : (baselines.monthlyMedCost + repeaterMedCost); 
      
      const monthlyOpex = compoundedFeed + baselines.monthlyLaborCost + compoundedUtil + dynamicMed;
      const monthlyProfit = simNetRevenue - monthlyOpex;

      data.push({
        name: months[i],
        BaselineProfit: baseNetProfit,
        SimulatedProfit: monthlyProfit,
        SimulatedRevenue: simNetRevenue,
        SimulatedExpense: monthlyOpex
      });
    }
    return data;
  };

  const chartData = generateProjectionData();

  const handleReset = () => {
    setSimParams({
      milkPrice: baselines.currentMilkPrice,
      feedInflation: 0,
      heatStressDrop: 0,
      diseaseSpike: 0,
      spoilageRate: baselines.averageSpoilageRate,
      utilityInflation: 0,
      routeExpansion: 0,
      repeaterRate: 0
    });
    setCfoForecast(null);
    setVetForecast(null);
  };

  // =========================================================================
  // DUAL AI ENGINE INTEGRATION
  // =========================================================================
  const generateAIForecasts = async () => {
    setIsAiLoading(true);
    setCfoForecast(null);
    setVetForecast(null);

    const payload = {
      simulation_inputs: {
        milk_price: simParams.milkPrice,
        feed_inflation_percent: simParams.feedInflation,
        heat_stress_yield_drop_percent: simParams.heatStressDrop,
        disease_spike_cost: simParams.diseaseSpike,
        repeater_breeder_percent: simParams.repeaterRate
      },
      projected_outcomes: {
        baseline_net_profit: baseNetProfit,
        simulated_net_profit: simNetProfit,
        baseline_cost_per_liter: baseCpl,
        simulated_cost_per_liter: simCpl
      }
    };

    const payloadStr = JSON.stringify(payload, null, 2);

    const cfoContext = `You are NooRganicCFO, an expert agricultural Chief Financial Officer AI. 
    Analyze the provided simulation JSON data. 
    1. Assess the financial impact of the simulated variables on the net profit and cost per liter. 
    2. Provide strict financial mitigation strategies (e.g., hedging feed costs, price restructuring) if the projection is negative.
    Keep your response concise and professional.`;

    const vetContext = `You are Gemma, an expert dairy veterinary and theriogenology AI. 
    Analyze the provided simulation JSON data. 
    1. Assess the clinical impact of the 'heat_stress_yield_drop_percent' and 'disease_spike_cost'. 
    2. Specifically analyze the 'repeater_breeder_percent'. Explain how heat stress or metabolic issues link to this repeater problem, and suggest precise veterinary protocols (e.g., Ovsynch adjustments, cooling management, trace mineral supplementation) to correct it.
    Keep your response concise and clinically actionable.`;

    try {
      const [cfoResponse, vetResponse] = await Promise.all([
        askGemma(payloadStr, cfoContext),
        askGemma(payloadStr, vetContext)
      ]);
      
      setCfoForecast(cfoResponse);
      setVetForecast(vetResponse);
    } catch (error) {
      console.error("Error generating AI Forecasts:", error);
      setCfoForecast("Connection Error: Unable to reach the CFO AI Engine.");
      setVetForecast("Connection Error: Unable to reach the Vet AI Engine.");
    } finally {
      setIsAiLoading(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-slate-500 font-bold">Initializing Economic Simulation Engine...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="bg-slate-900 p-8 rounded-xl shadow-xl text-white border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3 tracking-tight">
              <ChartIcon className="text-emerald-400 w-8 h-8"/> Predictive Economic Forecaster
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Stress-test your dairy farm's business model. Manipulate biological, environmental, and macroeconomic variables below to simulate how your P&L and Cash Flow will react over the next 6 months.
            </p>
          </div>
          <div className="text-right bg-slate-800 p-4 rounded-lg border border-slate-700">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Baseline Engine Status</p>
            <p className="text-emerald-400 font-black flex items-center justify-end gap-1"><CheckCircle size={14}/> Synced to Live Ledger</p>
          </div>
        </div>
        <Activity size={120} className="absolute -right-10 -bottom-10 text-slate-800 opacity-30 z-0"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: THE CONTROL PANEL (SLIDERS) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Settings2 size={18} className="text-blue-600"/> Simulation Controls
              </h2>
              <button onClick={handleReset} className="text-xs font-bold text-slate-400 hover:text-blue-600 flex items-center gap-1 transition"><RefreshCcw size={12}/> Reset</button>
            </div>

            <div className="space-y-8">
              {/* Variable 1: Pricing */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1"><IndianRupee size={12}/> Market Milk Price</label>
                  <span className="text-xs font-black text-blue-600">₹{simParams.milkPrice}/L</span>
                </div>
                <input 
                  type="range" min="30" max="120" step="1" 
                  value={simParams.milkPrice} 
                  onChange={(e) => setSimParams({...simParams, milkPrice: Number(e.target.value)})}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Simulate price elasticity and market pushback.</p>
              </div>

              {/* Variable 2: Environmental Heat Stress */}
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1"><ThermometerSun size={12}/> Summer Heat Stress</label>
                  <span className="text-xs font-black text-red-600">-{simParams.heatStressDrop}% Yield</span>
                </div>
                <input 
                  type="range" min="0" max="40" step="1" 
                  value={simParams.heatStressDrop} 
                  onChange={(e) => setSimParams({...simParams, heatStressDrop: Number(e.target.value)})}
                  className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <p className="text-[10px] text-amber-700 mt-1 leading-tight">Simulate biological yield drops caused by extreme heat or humidity without cooling systems.</p>
              </div>

              {/* NEW: Variable 3: Repeater Breeder Problem */}
              <div className="p-4 bg-rose-50 rounded-lg border border-rose-200">
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1"><Syringe size={12}/> Repeater Breeder Rate</label>
                  <span className="text-xs font-black text-rose-700">{simParams.repeaterRate}% Herd</span>
                </div>
                <input 
                  type="range" min="0" max="50" step="1" 
                  value={simParams.repeaterRate} 
                  onChange={(e) => setSimParams({...simParams, repeaterRate: Number(e.target.value)})}
                  className="w-full h-2 bg-rose-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
                <p className="text-[10px] text-rose-700 mt-1 leading-tight">Simulate the compounding financial and yield loss of failed pregnancies and delayed lactations.</p>
              </div>

              {/* Variable 4: Feed Market Inflation */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1"><Wheat size={12}/> Feed Cost Inflation</label>
                  <span className="text-xs font-black text-rose-600">+{simParams.feedInflation}%</span>
                </div>
                <input 
                  type="range" min="-20" max="100" step="5" 
                  value={simParams.feedInflation} 
                  onChange={(e) => setSimParams({...simParams, feedInflation: Number(e.target.value)})}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Simulate drought impact on Silage and Concentrate costs.</p>
              </div>

              {/* Variable 5: Operational Spoilage */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1"><Droplets size={12}/> Route Spoilage Rate</label>
                  <span className="text-xs font-black text-slate-800">{simParams.spoilageRate}%</span>
                </div>
                <input 
                  type="range" min="0" max="15" step="0.5" 
                  value={simParams.spoilageRate} 
                  onChange={(e) => setSimParams({...simParams, spoilageRate: Number(e.target.value)})}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Simulate handler volatility or transit cooling failures.</p>
              </div>

              {/* Variable 6: Disease Outbreak (One-Time Hit) */}
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1"><HeartPulse size={12}/> Disease Outbreak Cost</label>
                  <span className="text-xs font-black text-purple-700">+ ₹{simParams.diseaseSpike.toLocaleString()}</span>
                </div>
                <input 
                  type="range" min="0" max="100000" step="5000" 
                  value={simParams.diseaseSpike} 
                  onChange={(e) => setSimParams({...simParams, diseaseSpike: Number(e.target.value)})}
                  className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <p className="text-[10px] text-purple-700 mt-1 leading-tight">Simulate a sudden spike in veterinary expenses for Month 1 (Mastitis/FMD).</p>
              </div>

            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: THE DASHBOARD & CHARTS */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Top KPI Cards (Comparison) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Baseline Card */}
            <div className="bg-white p-6 rounded-xl border-2 border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Live Current Baseline (30-Day)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                  <span className="text-sm font-bold text-slate-600">Net Revenue</span>
                  <span className="text-lg font-black text-slate-800">₹{baseNetRevenue.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                </div>
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                  <span className="text-sm font-bold text-slate-600">Total OpEx</span>
                  <span className="text-lg font-black text-rose-600">₹{baseTotalOpex.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">Net Profit</span>
                  <span className={`text-2xl font-black ${baseNetProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>₹{baseNetProfit.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                </div>
                <div className="mt-4 bg-slate-50 p-2 rounded flex justify-between text-xs font-bold text-slate-500">
                  <span>Farm CPL: ₹{baseCpl.toFixed(2)}</span>
                  <span>Yield: {baseMonthlyYield.toLocaleString(undefined, {maximumFractionDigits:0})} L</span>
                </div>
              </div>
            </div>

            {/* Simulated Card */}
            <div className={`p-6 rounded-xl border-2 shadow-md relative overflow-hidden transition-colors duration-500 ${simNetProfit > baseNetProfit ? 'bg-emerald-50 border-emerald-300' : simNetProfit < 0 ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-300'}`}>
              <div className={`absolute top-0 left-0 w-1 h-full ${simNetProfit > baseNetProfit ? 'bg-emerald-500' : simNetProfit < 0 ? 'bg-red-500' : 'bg-blue-500'}`}></div>
              <h3 className={`text-xs font-black uppercase tracking-widest mb-4 ${simNetProfit > baseNetProfit ? 'text-emerald-700' : simNetProfit < 0 ? 'text-red-700' : 'text-blue-700'}`}>Simulated Projection (Month 1)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-end border-b border-black/5 pb-2">
                  <span className="text-sm font-bold opacity-70">Net Revenue</span>
                  <span className="text-lg font-black opacity-90">₹{simNetRevenue.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                </div>
                <div className="flex justify-between items-end border-b border-black/5 pb-2">
                  <span className="text-sm font-bold opacity-70">Total OpEx</span>
                  <span className="text-lg font-black text-rose-600">₹{simTotalOpex.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <span className="text-sm font-bold uppercase tracking-wider opacity-90">Net Profit</span>
                  <div className="text-right">
                    <span className="text-3xl font-black">₹{simNetProfit.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      {simNetProfit > baseNetProfit ? <TrendingUp size={14} className="text-emerald-600"/> : <TrendingDown size={14} className="text-red-600"/>}
                      <span className={`text-xs font-bold ${simNetProfit > baseNetProfit ? 'text-emerald-600' : 'text-red-600'}`}>
                        {Math.abs(simNetProfit - baseNetProfit).toLocaleString(undefined, {maximumFractionDigits:0})} variance
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 bg-white/50 p-2 rounded flex justify-between text-xs font-bold opacity-80">
                  <span className={simCpl > baseCpl ? 'text-red-600' : 'text-emerald-600'}>Farm CPL: ₹{simCpl.toFixed(2)}</span>
                  <span className={simMonthlyYield < baseMonthlyYield ? 'text-red-600' : ''}>Yield: {simMonthlyYield.toLocaleString(undefined, {maximumFractionDigits:0})} L</span>
                </div>
              </div>
            </div>
          </div>

          {/* The Master Trajectory Chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Activity className="text-indigo-600"/> 6-Month Simulated Trajectory</h2>
            <div style={{ width: '100%', height: 400, minHeight: 400, minWidth: 300 }}>
              <ResponsiveContainer width="99%" height="100%" minWidth={300} minHeight={400}>
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b', fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                  <RechartsTooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold'}} 
                    formatter={(val) => `₹${val.toLocaleString(undefined, {maximumFractionDigits:0})}`} 
                  />
                  <Legend wrapperStyle={{fontSize: '12px', fontWeight: 'bold', paddingTop: '20px'}}/>
                  
                  <ReferenceLine y={baseNetProfit} stroke="#94a3b8" strokeDasharray="3 3" label={{ position: 'top', value: 'Current Baseline Profit', fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} />

                  <Bar dataKey="SimulatedRevenue" name="Projected Revenue" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="SimulatedExpense" name="Projected OpEx" fill="#fca5a5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  
                  <Line type="monotone" dataKey="SimulatedProfit" name="Simulated Net Profit" stroke="#059669" strokeWidth={4} activeDot={{ r: 8 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DUAL AI EXECUTIVE SUMMARY ENGINE */}
          <div className="bg-slate-900 rounded-xl shadow-xl overflow-hidden border border-slate-800">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white uppercase tracking-widest text-sm flex items-center gap-2"><Brain size={18} className="text-purple-400"/> AI Executive Simulation Summary</h3>
                <p className="text-xs text-slate-400 mt-1">Cross-referencing financial impact with veterinary health protocols.</p>
              </div>
              <button 
                onClick={generateAIForecasts}
                disabled={isAiLoading}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-lg transition flex items-center gap-2 disabled:bg-slate-700 disabled:text-slate-500"
              >
                <Sparkles size={16}/> {isAiLoading ? 'Synthesizing...' : 'Generate AI Forecast'}
              </button>
            </div>
            
            <div className="p-6">
              {!cfoForecast && !vetForecast && !isAiLoading ? (
                <div className="text-center py-8 text-slate-500 text-sm font-bold">
                  Click 'Generate AI Forecast' to process the current slider metrics through the Gemma Intelligence network.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* CFO Panel */}
                  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <h4 className="text-emerald-400 font-bold mb-3 flex items-center gap-2"><IndianRupee size={16}/> NooRganicCFO Financial Audit</h4>
                    {isAiLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-2 bg-slate-700 rounded w-3/4"></div>
                        <div className="h-2 bg-slate-700 rounded w-full"></div>
                        <div className="h-2 bg-slate-700 rounded w-5/6"></div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {cfoForecast?.replace(/\*/g, '') || "Analysis failed."}
                      </div>
                    )}
                  </div>

                  {/* VET Panel */}
                  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <h4 className="text-blue-400 font-bold mb-3 flex items-center gap-2"><Stethoscope size={16}/> Gemma Clinical Risk Assessment</h4>
                    {isAiLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-2 bg-slate-700 rounded w-full"></div>
                        <div className="h-2 bg-slate-700 rounded w-4/6"></div>
                        <div className="h-2 bg-slate-700 rounded w-full"></div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {vetForecast?.replace(/\*/g, '') || "Analysis failed."}
                      </div>
                    )}
                  </div>
                  
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}