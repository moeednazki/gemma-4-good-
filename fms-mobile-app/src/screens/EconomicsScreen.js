import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';

export default function EconomicsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Inventory');
  const [loading, setLoading] = useState(false);
  
  // Inventory Data
  const [inventoryList, setInventoryList] = useState([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);

  // Purchase Form State
  const [purchase, setPurchase] = useState({
    itemName: '', category: 'Medicine', brand: '', vendor: '', totalQuantity: '', unit: 'ml', totalCost: '', paymentStatus: 'Paid in Full'
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setIsLoadingInventory(true);
    try {
      const q = query(collection(db, 'inventory'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInventoryList(items);
    } catch (error) {
      console.error("Error fetching inventory: ", error);
    } finally {
      setIsLoadingInventory(false);
    }
  };

  const handleLogPurchase = async () => {
    if (!purchase.itemName || !purchase.totalQuantity || !purchase.totalCost) {
      return Platform.OS === 'web' ? window.alert('Please fill out all required fields.') : Alert.alert('Error', 'Please fill out all required fields.');
    }

    setLoading(true);
    const qty = parseFloat(purchase.totalQuantity); 
    const cost = parseFloat(purchase.totalCost); 
    const unitCost = (cost / qty).toFixed(2); 

    try {
      // 1. Add to Master Inventory
      await addDoc(collection(db, 'inventory'), { 
        item_name: purchase.itemName, 
        category: purchase.category, 
        brand: purchase.brand, 
        vendor: purchase.vendor, 
        total_quantity: qty, 
        current_stock: qty, 
        unit: purchase.unit, 
        total_cost: cost, 
        unit_cost: parseFloat(unitCost), 
        receipt_file: 'Edge App Entry', 
        timestamp: serverTimestamp() 
      });

      // 2. If Paid in Cash, Log to Vendor Payments instantly
      if (purchase.paymentStatus === 'Paid in Full') {
        await addDoc(collection(db, 'vendor_payments'), {
          vendor: purchase.vendor || 'Unknown Walk-in', 
          amount: cost, 
          date: new Date().toISOString().split('T')[0], 
          method: 'Cash', 
          notes: `Auto-Paid for ${purchase.itemName}`, 
          proof_file: 'N/A', 
          recorded_at: serverTimestamp()
        });
      }

      if (Platform.OS === 'web') window.alert(`Success: Added INR ${cost} to Inventory.`);
      else Alert.alert('Logged Successfully', 'Inventory & Ledgers updated.');

      setPurchase({ itemName: '', category: 'Medicine', brand: '', vendor: '', totalQuantity: '', unit: 'ml', totalCost: '', paymentStatus: 'Paid in Full' });
      fetchInventory();
      setActiveTab('Inventory');
    } catch (error) {
      console.error(error);
      if (Platform.OS === 'web') window.alert('Failed to log purchase to cloud.');
      else Alert.alert('Network Error', 'Failed to connect to cloud ledgers.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalInventoryValue = () => {
    return inventoryList.reduce((acc, item) => acc + (parseFloat(item.total_cost) || 0), 0);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>BACK</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edge Economics</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flexDirection: 'row', marginTop: 15 }}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'Snapshot' && styles.tabBtnActive]} onPress={() => setActiveTab('Snapshot')}><Text style={[styles.tabText, activeTab === 'Snapshot' && styles.tabTextActive]}>Snapshot</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'Inventory' && styles.tabBtnActive]} onPress={() => setActiveTab('Inventory')}><Text style={[styles.tabText, activeTab === 'Inventory' && styles.tabTextActive]}>Stock</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'Purchase' && styles.tabBtnActive]} onPress={() => setActiveTab('Purchase')}><Text style={[styles.tabText, activeTab === 'Purchase' && styles.tabTextActive]}>Buy/Restock</Text></TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        
        {/* SNAPSHOT TAB */}
        {activeTab === 'Snapshot' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>FINANCIAL SNAPSHOT</Text>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>TOTAL HISTORICAL INVENTORY VALUE</Text>
              <Text style={styles.metricValue}>INR {calculateTotalInventoryValue().toLocaleString()}</Text>
              <Text style={styles.metricSub}>Value of all logged physical goods</Text>
            </View>
            <View style={styles.metricBoxAlt}>
              <Text style={styles.metricLabel}>ACTIVE DATABASE ENTRIES</Text>
              <Text style={styles.metricValueAlt}>{inventoryList.length} Item Lots</Text>
              <Text style={styles.metricSub}>Currently synced from cloud</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>[ i ] For deep analytics, employee ledgers, and ITR generation, please access the NooRganics Mainframe via desktop web browser.</Text>
            </View>
          </View>
        )}

        {/* INVENTORY LIST TAB */}
        {activeTab === 'Inventory' && (
          <View style={styles.card}>
            <View style={styles.flexBetween}>
              <Text style={styles.sectionTitle}>LIVE STOCK LEDGER</Text>
              <TouchableOpacity onPress={fetchInventory}><Text style={styles.refreshText}>[ REFRESH ]</Text></TouchableOpacity>
            </View>
            
            {isLoadingInventory ? (
              <ActivityIndicator color="#2563EB" style={{ margin: 20 }} />
            ) : (
              <View style={styles.tableContainer}>
                {inventoryList.map((item, i) => (
                  <View key={i} style={styles.tableRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.itemName}>{item.item_name}</Text>
                      <Text style={styles.itemVendor}>{item.vendor || 'Unknown Vendor'} - {item.category}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.itemStock}>{parseFloat(item.current_stock).toFixed(2)} {item.unit}</Text>
                      <Text style={styles.itemCost}>INR {parseFloat(item.unit_cost).toFixed(2)} / {item.unit}</Text>
                    </View>
                  </View>
                ))}
                {inventoryList.length === 0 && (
                  <Text style={styles.emptyText}>No inventory records found.</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* LOG PURCHASE TAB */}
        {activeTab === 'Purchase' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>LOG MARKET PURCHASE</Text>

            <Text style={styles.label}>CATEGORY</Text>
            <View style={styles.chipContainer}>
              {['Medicine', 'Supplement', 'Feed', 'Equipment'].map(cat => (
                <TouchableOpacity key={cat} style={[styles.choiceChip, purchase.category === cat && styles.choiceChipActive]} onPress={() => setPurchase({...purchase, category: cat})}>
                  <Text style={[styles.choiceChipText, purchase.category === cat && styles.choiceChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>ITEM NAME *</Text>
            <TextInput style={styles.input} value={purchase.itemName} onChangeText={t => setPurchase({...purchase, itemName: t})} placeholder="e.g. Enrofloxacin 10%" />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>BRAND</Text>
                <TextInput style={styles.input} value={purchase.brand} onChangeText={t => setPurchase({...purchase, brand: t})} placeholder="e.g. Virbac" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>VENDOR</Text>
                <TextInput style={styles.input} value={purchase.vendor} onChangeText={t => setPurchase({...purchase, vendor: t})} placeholder="e.g. SS Traders" />
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>TOTAL QUANTITY *</Text>
                <TextInput style={styles.input} value={purchase.totalQuantity} onChangeText={t => setPurchase({...purchase, totalQuantity: t})} keyboardType="numeric" placeholder="0" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>UNIT</Text>
                <View style={styles.chipContainer}>
                  {['ml', 'L', 'kg', 'vial'].map(u => (
                    <TouchableOpacity key={u} style={[styles.choiceChip, {paddingVertical: 10}, purchase.unit === u && styles.choiceChipActive]} onPress={() => setPurchase({...purchase, unit: u})}>
                      <Text style={[styles.choiceChipText, {fontSize: 10}, purchase.unit === u && styles.choiceChipTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.label}>TOTAL VALUE OF GOODS (INR) *</Text>
            <TextInput style={[styles.input, styles.highlightInput]} value={purchase.totalCost} onChangeText={t => setPurchase({...purchase, totalCost: t})} keyboardType="numeric" placeholder="0.00" />

            <Text style={styles.label}>PAYMENT STATUS</Text>
            <View style={styles.chipContainer}>
              <TouchableOpacity style={[styles.choiceChip, purchase.paymentStatus === 'Paid in Full' && styles.choiceChipActive]} onPress={() => setPurchase({...purchase, paymentStatus: 'Paid in Full'})}>
                <Text style={[styles.choiceChipText, purchase.paymentStatus === 'Paid in Full' && styles.choiceChipTextActive]}>Paid in Full (Cash)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.choiceChip, purchase.paymentStatus === 'Bought on Credit' && styles.choiceChipActive]} onPress={() => setPurchase({...purchase, paymentStatus: 'Bought on Credit'})}>
                <Text style={[styles.choiceChipText, purchase.paymentStatus === 'Bought on Credit' && styles.choiceChipTextActive]}>On Credit (Debt)</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleLogPurchase} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>ADD TO INVENTORY</Text>}
            </TouchableOpacity>
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
  tabBtnActive: { backgroundColor: '#10B981' }, 
  tabText: { color: '#94A3B8', fontWeight: 'bold', fontSize: 12 }, 
  tabTextActive: { color: '#FFF' }, 
  content: { flex: 1 },
  card: { backgroundColor: '#FFFFFF', margin: 16, padding: 20, borderRadius: 16, elevation: 4 }, 
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 8 },
  flexBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refreshText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  label: { fontSize: 10, fontWeight: '900', color: '#64748B', marginBottom: 8, marginTop: 18, letterSpacing: 1 }, 
  input: { borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#F8FAFC', color: '#1E293B', fontWeight: 'bold' }, 
  highlightInput: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', color: '#065F46' },
  row: { flexDirection: 'row', gap: 10 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  choiceChipActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  choiceChipText: { color: '#475569', fontWeight: 'bold', fontSize: 11 },
  choiceChipTextActive: { color: '#1E40AF' },
  saveButton: { backgroundColor: '#10B981', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 30 }, 
  saveButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  tableContainer: { marginTop: 10 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemName: { fontSize: 14, fontWeight: '900', color: '#1E293B' },
  itemVendor: { fontSize: 11, fontWeight: 'bold', color: '#64748B', marginTop: 2 },
  itemStock: { fontSize: 14, fontWeight: '900', color: '#2563EB' },
  itemCost: { fontSize: 10, fontWeight: 'bold', color: '#10B981', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 20, fontWeight: 'bold' },
  metricBox: { backgroundColor: '#0F172A', padding: 20, borderRadius: 12, marginBottom: 12 },
  metricBoxAlt: { backgroundColor: '#EFF6FF', padding: 20, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  metricLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 4 },
  metricValue: { fontSize: 28, fontWeight: '900', color: '#34D399' },
  metricValueAlt: { fontSize: 28, fontWeight: '900', color: '#1E40AF' },
  metricSub: { fontSize: 11, color: '#64748B', fontWeight: 'bold', marginTop: 4 },
  infoBox: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#FDE68A' },
  infoText: { fontSize: 11, color: '#B45309', fontWeight: 'bold', lineHeight: 16 }
});