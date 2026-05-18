import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { Feather } from '@expo/vector-icons';
import { askGemma } from '../services/AIEngine';

export default function LogisticsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Route'); // Route, Roster, AI Strategy
  const [loading, setLoading] = useState(false);

  // Core Arrays
  const [customers, setCustomers] = useState([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [routeLogs, setRouteLogs] = useState({});

  // Route Filters
  const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('Morning');
  const [routeFilterArea, setRouteFilterArea] = useState('');
  const [uniqueAreas, setUniqueAreas] = useState([]);

  // AI Analytics States
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState(null);

  useEffect(() => {
    fetchHerdAndRosterContext();
  }, []);

  const fetchHerdAndRosterContext = async () => {
    try {
      const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(list);

      // Extract unique geographical delivery zones dynamically
      const areas = [...new Set(list.map(c => c.areaCircle).filter(Boolean))];
      setUniqueAreas(areas);
      if (areas.length > 0) setRouteFilterArea(areas[0]);
    } catch (e) {
      console.error("Fulfillment sync error: ", e);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const handleRouteLogChange = (customerId, field, value) => {
    setRouteLogs(prev => ({
      ...prev,
      [customerId]: { ...(prev[customerId] || { qty: '', broken: '' }), [field]: value }
    }));
  };

  const handleSaveDailyRoute = async () => {
    const entries = Object.entries(routeLogs).filter(([_, data]) => parseFloat(data.qty) > 0 || parseInt(data.broken) > 0);
    if (entries.length === 0) {
      return Platform.OS === 'web' ? window.alert('No active distribution parameters typed.') : Alert.alert('Error', 'No data entered.');
    }

    setLoading(true);
    try {
      for (const [customerId, data] of entries) {
        const targetCust = customers.find(c => c.id === customerId);
        if (!targetCust) continue;

        const liters = parseFloat(data.qty) || 0;
        const broken = parseInt(data.broken) || 0;
        const price = parseFloat(targetCust.pricePerLiter) || 60;
        const totalValue = (liters * price) + (broken * 50);

        await addDoc(collection(db, 'milk_deliveries'), {
          customer_id: customerId,
          customer_name: targetCust.name,
          area_circle: targetCust.areaCircle || 'Unassigned',
          date: routeDate,
          shift: shift,
          liters_delivered: liters,
          bottles_broken: broken,
          price_per_liter: price,
          total_value: totalValue,
          status: 'Billed',
          recorded_at: serverTimestamp()
        });
      }

      if (Platform.OS === 'web') window.alert('Route transactions written safely to remote ledger!');
      else Alert.alert('Success', 'Route sheet committed safely.');
      setRouteLogs({});
      navigation.goBack();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogisticsAIAnalysis = async () => {
    setIsAiLoading(true);
    setAiReport(null);
    try {
      const activeDefaulters = customers.filter(c => (parseFloat(c.openingBalance) || 0) > 0);
      const totalArrears = activeDefaulters.reduce((sum, c) => sum + (parseFloat(c.openingBalance) || 0), 0);

      const payload = {
        active_customers: customers.length,
        geographical_routes: uniqueAreas.length,
        filter_period: 'Live Route Framework',
        number_of_defaulters: activeDefaulters.length,
        total_arrears_inr: totalArrears
      };

      const systemContext = `You are the NooRganic Logistics AI, an expert supply chain and fulfillment manager for a dairy farm. 
      Analyze the provided parameters and give 3 precise, actionable recommendations to improve delivery times and cash collections. 
      Format currency explicitly as INR / Rs. Keep the tone completely professional and crisp.`;

      const response = await askGemma(JSON.stringify(payload, null, 2), systemContext);
      setAiReport(response);
    } catch (e) {
      setAiReport("Connection Error: Unable to compute strategy vector.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => !routeFilterArea || c.areaCircle === routeFilterArea);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>BACK</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Route & Logistics</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flexDirection: 'row', marginTop: 15 }}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'Route' && styles.tabBtnActive]} onPress={() => setActiveTab('Route')}><Text style={[styles.tabText, activeTab === 'Route' && styles.tabTextActive]}>Daily Route</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'Roster' && styles.tabBtnActive]} onPress={() => setActiveTab('Roster')}><Text style={[styles.tabText, activeTab === 'Roster' && styles.tabTextActive]}>Client Roster</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'AI' && styles.tabBtnActive]} onPress={() => setActiveTab('AI')}><Text style={[styles.tabText, activeTab === 'AI' && styles.tabTextActive]}>AI Strategy</Text></TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} nestedScrollEnabled={true}>
        
        {/* DAILY ROUTE ENTRY TAB */}
        {activeTab === 'Route' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>ROUTE DISPATCH PROTOCOL</Text>
            
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>DATE</Text>
                <TextInput style={styles.input} value={routeDate} onChangeText={setRouteDate} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>SHIFT</Text>
                <View style={styles.toggleRow}>
                  {['Morning', 'Evening'].map(s => (
                    <TouchableOpacity key={s} style={[styles.miniToggle, shift === s && styles.miniToggleActive]} onPress={() => setShift(s)}>
                      <Text style={[styles.toggleText, shift === s && styles.toggleTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.label}>ACTIVE ROUTE FILTERS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginVertical: 8 }}>
              <TouchableOpacity style={[styles.areaChip, !routeFilterArea && styles.areaChipActive]} onPress={() => setRouteFilterArea('')}>
                <Text style={[styles.areaChipText, !routeFilterArea && styles.areaChipTextActive]}>ALL ROUTES</Text>
              </TouchableOpacity>
              {uniqueAreas.map(area => (
                <TouchableOpacity key={area} style={[styles.areaChip, routeFilterArea === area && styles.areaChipActive]} onPress={() => setRouteFilterArea(area)}>
                  <Text style={[styles.areaChipText, routeFilterArea === area && styles.areaChipTextActive]}>{area.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>ROUTING DISTRIBUTION MATRIX</Text>
            {isLoadingCustomers ? (
              <ActivityIndicator color="#2563EB" style={{ margin: 20 }} />
            ) : (
              <View style={styles.matrixContainer}>
                {filteredCustomers.map((customer, idx) => {
                  const data = routeLogs[customer.id] || {};
                  return (
                    <View key={idx} style={styles.matrixRow}>
                      <View style={{ flex: 2 }}>
                        <Text style={styles.clientName}>{customer.name}</Text>
                        <Text style={styles.clientMeta}>{customer.displayId} - Rate: Rs.{customer.pricePerLiter}</Text>
                      </View>
                      <View style={styles.inputMatrixControls}>
                        <TextInput 
                          style={styles.matrixInput} 
                          placeholder="Liters" 
                          keyboardType="numeric" 
                          value={data.qty || ''} 
                          onChangeText={val => handleRouteLogChange(customer.id, 'qty', val)} 
                        />
                        <TextInput 
                          style={[styles.matrixInput, styles.borderDanger]} 
                          placeholder="Loss" 
                          keyboardType="numeric" 
                          value={data.broken || ''} 
                          onChangeText={val => handleRouteLogChange(customer.id, 'broken', val)} 
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <TouchableOpacity style={styles.commitBtn} onPress={handleSaveDailyRoute} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.commitBtnText}>COMMIT ROUTE TO CLOUD</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* CUSTOMER ROSTER DIRECTORY */}
        {activeTab === 'Roster' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>ROSTER BALANCES DIRECTORY</Text>
            {customers.map((c, idx) => (
              <View key={idx} style={styles.rosterRow}>
                <View>
                  <Text style={styles.rosterName}>{c.name}</Text>
                  <Text style={styles.rosterSub}>{c.displayId} - Route: {c.areaCircle || 'Unassigned'}</Text>
                </View>
                <View style={styles.balanceContainer}>
                  <Text style={styles.balanceLabel}>ARREARS STATUS</Text>
                  <Text style={[styles.balanceValue, (parseFloat(c.openingBalance) || 0) > 0 ? styles.textWarning : styles.textNominal]}>
                    Rs. {parseFloat(c.openingBalance || 0).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* AI LOGISTICS MANAGER STRATEGY TAB */}
        {activeTab === 'AI' && (
          <View style={styles.card}>
            <View style={styles.flexBetween}>
              <Text style={styles.sectionTitle}>AI DISTRIBUTION MODELER</Text>
              <TouchableOpacity style={styles.aiTriggerRow} onPress={handleLogisticsAIAnalysis} disabled={isAiLoading}>
                <Feather name="cpu" size={16} color="#2563EB" />
                <Text style={styles.aiTriggerText}>{isAiLoading ? ' COMPUTING...' : ' RUN MODEL'}</Text>
              </TouchableOpacity>
            </View>

            {aiReport ? (
              <View style={styles.reportOutput}>
                <Text style={styles.reportText}>{aiReport.replace(/\*/g, '')}</Text>
              </View>
            ) : (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>Trigger the parameters suite to analyze supply-chain inefficiencies.</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' }, 
  header: { backgroundColor: '#0F172A', padding: 24, paddingTop: 60, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }, 
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  backBtn: { paddingVertical: 4, paddingHorizontal: 12, backgroundColor: '#1E293B', borderRadius: 8 },
  backBtnText: { color: '#38BDF8', fontSize: 14, fontWeight: '900' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', textAlign: 'center', flex: 1, marginRight: 20 }, 
  tabBtn: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 8, marginHorizontal: 4 }, 
  tabBtnActive: { backgroundColor: '#2563EB' }, 
  tabText: { color: '#94A3B8', fontWeight: 'bold', fontSize: 12 }, 
  tabTextActive: { color: '#FFF' },
  content: { flex: 1 },
  card: { backgroundColor: '#FFFFFF', margin: 16, padding: 20, borderRadius: 16, borderSize: 1, borderWidth: 1, borderColor: '#E2E8F0', elevation: 3 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A', marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#F1F5F9', paddingBottom: 8, letterSpacing: 0.5 },
  label: { fontSize: 10, fontWeight: '900', color: '#64748B', marginBottom: 6, marginTop: 14, letterSpacing: 1 }, 
  input: { borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#F8FAFC', color: '#1E293B', fontWeight: 'bold' }, 
  row: { flexDirection: 'row', gap: 10 },
  toggleRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 4, marginTop: 2, borderSize: 1, borderWidth: 1, borderColor: '#E2E8F0' },
  miniToggle: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  miniToggleActive: { backgroundColor: '#0F172A' },
  toggleText: { color: '#64748B', fontWeight: 'bold', fontSize: 12 },
  toggleTextActive: { color: '#FFF' },
  areaChip: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#F1F5F9', borderRadius: 20, marginRight: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  areaChipActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  areaChipText: { color: '#475569', fontSize: 11, fontWeight: 'bold' },
  areaChipTextActive: { color: '#1E40AF', fontWeight: '900' },
  matrixContainer: { marginTop: 10 },
  matrixRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  clientName: { fontSize: 14, fontWeight: '900', color: '#1E293B' },
  clientMeta: { fontSize: 11, color: '#64748B', fontWeight: 'bold', marginTop: 2 },
  inputMatrixControls: { flexDirection: 'row', gap: 8 },
  matrixInput: { borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 8, width: 65, padding: 8, textAlign: 'center', fontSize: 13, fontWeight: 'bold', backgroundColor: '#F8FAFC' },
  borderDanger: { borderColor: '#FCA5A5' },
  commitBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  commitBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  rosterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rosterName: { fontSize: 14, fontWeight: '900', color: '#1E293B' },
  rosterSub: { fontSize: 11, color: '#64748B', fontStyle: 'italic', marginTop: 1 },
  balanceContainer: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 8, fontWeight: '900', color: '#94A3B8' },
  balanceValue: { fontSize: 15, fontWeight: '900', marginTop: 2 },
  textWarning: { color: '#D97706' },
  textNominal: { color: '#10B981' },
  flexBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  aiTriggerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  aiTriggerText: { color: '#1E40AF', fontSize: 11, fontWeight: '900' },
  placeholderBox: { padding: 30, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', alignItems: 'center' },
  placeholderText: { fontSize: 12, color: '#94A3B8', fontWeight: 'bold', textAlign: 'center', lineHeight: 18 },
  reportOutput: { backgroundColor: '#0F172A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  reportText: { color: '#F8FAFC', fontSize: 13, lineHeight: 22, fontWeight: '500' }
});