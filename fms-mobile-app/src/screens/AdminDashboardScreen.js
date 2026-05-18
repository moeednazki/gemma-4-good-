import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';

export default function AdminDashboardScreen({ navigation }) {
  const [activeModule, setActiveModule] = useState('portal'); 
  const [offlineLogs, setOfflineLogs] = useState([]);

  useEffect(() => { 
    const unsubscribe = navigation.addListener('focus', fetchNoSqlData); 
    fetchNoSqlData(); 
    return unsubscribe; 
  }, [navigation, activeModule]);

  const fetchNoSqlData = async () => {
    try {
      const existingData = await AsyncStorage.getItem('@offline_logs');
      setOfflineLogs(existingData ? JSON.parse(existingData) : []);
    } catch (e) { console.error(e); }
  };

  const handleApproveAndSyncItem = async (item) => {
    try {
      if (item.table === 'Farm_Bulk') {
        // Sync bulk yield log to central production ledger
        await addDoc(collection(db, 'milk_records'), {
          type: 'bulk_total',
          date: item.timestamp.split('T')[0],
          yield_liters: parseFloat(item.yield) || 0,
          shift: item.shift || 'Morning',
          recorded_at: serverTimestamp()
        });
      } else {
        // Sync individual metrics based on specific entry modes
        if (item.logType === 'Individual') {
          await addDoc(collection(db, 'milk_records'), {
            type: 'individual',
            date: item.timestamp.split('T')[0],
            cow_id: item.tagNumber,
            yield_liters: parseFloat(item.yield) || 0,
            shift: item.shift || 'Morning',
            health_status: 'Healthy',
            recorded_at: serverTimestamp()
          });
        } else if (item.logType === 'Clinical') {
          await addDoc(collection(db, 'medical_records'), {
            cow_id: item.tagNumber,
            disease_class: item.diagnostics?.userObservations?.pathologySigns ? 'Clinical_Alert' : 'Routine_Check',
            symptoms: item.diagnostics?.aiFlaggedAlert || 'Routine screening',
            recorded_at: serverTimestamp()
          });
        }

        // Locate animal document inside core registry matching its specific Tag code
        const cowQuery = query(collection(db, 'cows'), where('id', '==', item.tagNumber));
        const cowSnapshot = await getDocs(cowQuery);
        if (!cowSnapshot.empty) {
          const cowDocRef = doc(db, 'cows', cowSnapshot.docs[0].id);
          const updatePayload = {};
          
          if (item.weight && item.weight !== 'N/A') updatePayload.entryWeight = parseFloat(item.weight);
          if (item.bcs && item.bcs !== 'N/A') updatePayload.bcs = parseFloat(item.bcs);
          
          if (Object.keys(updatePayload).length > 0) {
            await updateDoc(cowDocRef, updatePayload);
          }
        }
      }

      // Evict items from offline cache array only after cloud transactions resolve
      const currentLogs = await AsyncStorage.getItem('@offline_logs');
      let logsArray = currentLogs ? JSON.parse(currentLogs) : [];
      logsArray = logsArray.filter(log => log.id !== item.id);
      await AsyncStorage.setItem('@offline_logs', JSON.stringify(logsArray));
      
      if (Platform.OS === 'web') window.alert("Record successfully synchronized to live cloud mainframe.");
      else Alert.alert("Sync Complete", "Record successfully synchronized to live cloud mainframe.");
      
      fetchNoSqlData();
    } catch (error) {
      console.error("Cloud synchronization failure: ", error);
      if (Platform.OS === 'web') window.alert("Sync Failure: Connection error to remote database paths.");
      else Alert.alert("Sync Failure", "Could not complete cloud write loops.");
    }
  };

  if (activeModule === 'sync') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setActiveModule('portal')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← BACK TO COCKPIT</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quarantine Vault</Text>
          <Text style={styles.headerSubtitle}>{offlineLogs.length} Pending Records</Text>
        </View>
        <FlatList 
          data={offlineLogs} 
          keyExtractor={(item) => item.id} 
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.tagText}>TAG ID: {item.tagNumber}</Text>
              <Text style={styles.infoText}>Mode: {item.logType} | Weight: {item.weight || 'N/A'} kg</Text>
              <TouchableOpacity style={styles.syncBtn} onPress={() => handleApproveAndSyncItem(item)}>
                <Text style={styles.syncBtnText}>APPROVE AND COMMIT TO CLOUD</Text>
              </TouchableOpacity>
            </View>
          )} 
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NooRganics Mainframe</Text>
        <Text style={styles.headerSubtitle}>Universal Admin Cockpit</Text>
      </View>
      
      <View style={styles.grid}>
        <TouchableOpacity style={styles.tile} onPress={() => navigation.navigate('BarnEntry')}>
          <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
            <Feather name="plus-square" size={28} color="#2563EB" />
          </View>
          <Text style={styles.tileTitle}>Barn Data Entry</Text>
          <Text style={styles.tileSub}>Clinical & Production</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tile} onPress={() => navigation.navigate('HerdDirectory')}>
          <View style={[styles.iconContainer, { backgroundColor: '#F8FAFC' }]}>
            <Feather name="database" size={28} color="#475569" />
          </View>
          <Text style={styles.tileTitle}>Herd Directory</Text>
          <Text style={styles.tileSub}>Live Cloud Registry</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity style={styles.tile} onPress={() => navigation.navigate('CowRegistration')}>
          <View style={[styles.iconContainer, { backgroundColor: '#F0FDF4' }]}>
            <Feather name="tag" size={28} color="#10B981" />
          </View>
          <Text style={styles.tileTitle}>Register Asset</Text>
          <Text style={styles.tileSub}>Profile New Stock</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tile} onPress={() => navigation.navigate('Economics')}>
          <View style={[styles.iconContainer, { backgroundColor: '#FEF2F2' }]}>
            <Feather name="pie-chart" size={28} color="#EF4444" />
          </View>
          <Text style={styles.tileTitle}>Edge Economics</Text>
          <Text style={styles.tileSub}>Inventory & Ledgers</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity style={styles.tile} onPress={() => navigation.navigate('Logistics')}>
          <View style={[styles.iconContainer, { backgroundColor: '#FFF7ED' }]}>
            <Feather name="truck" size={28} color="#EA580C" />
          </View>
          <Text style={styles.tileTitle}>Logistics Hub</Text>
          <Text style={styles.tileSub}>Route Deliveries</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tile} onPress={() => setActiveModule('sync')}>
          {offlineLogs.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{offlineLogs.length}</Text>
            </View>
          )}
          <View style={[styles.iconContainer, { backgroundColor: '#FAF5FF' }]}>
            <Feather name="refresh-cw" size={28} color="#9333EA" />
          </View>
          <Text style={styles.tileTitle}>Quarantine Hub</Text>
          <Text style={styles.tileSub}>Sync Edge Packets</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}>
        <Feather name="power" size={18} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={styles.logoutText}>TERMINATE SESSION</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ 
  container: { flex: 1, backgroundColor: '#F1F5F9' }, 
  header: { backgroundColor: '#0F172A', padding: 32, paddingTop: 60, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 }, 
  headerTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: 0.5 }, 
  headerSubtitle: { color: '#38BDF8', fontSize: 13, fontWeight: 'bold', marginTop: 6, letterSpacing: 1.5, textTransform: 'uppercase' }, 
  backBtn: { marginBottom: 12, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#1E293B', borderRadius: 8 }, 
  backBtnText: { color: '#38BDF8', fontWeight: '900', fontSize: 12 }, 
  grid: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, justifyContent: 'space-between' }, 
  tile: { backgroundColor: '#FFFFFF', width: '48%', padding: 20, borderRadius: 16, alignItems: 'flex-start', shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4, borderWidth: 1, borderColor: '#E2E8F0' }, 
  iconContainer: { padding: 12, borderRadius: 12, marginBottom: 16 },
  tileTitle: { fontSize: 15, fontWeight: '900', color: '#1E293B', letterSpacing: 0.5 }, 
  tileSub: { fontSize: 11, color: '#64748B', fontWeight: 'bold', marginTop: 4 },
  badge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#EF4444', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', zIndex: 10, borderWidth: 2, borderColor: '#FFF' }, 
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '900' }, 
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 5, borderLeftColor: '#2563EB' }, 
  tagText: { fontSize: 16, fontWeight: '900', color: '#0F172A' }, 
  infoText: { fontSize: 13, color: '#64748B', marginVertical: 6, fontWeight: 'bold' }, 
  syncBtn: { backgroundColor: '#10B981', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 }, 
  syncBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 }, 
  logoutBtn: { margin: 20, backgroundColor: '#EF4444', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginTop: 30, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 }, 
  logoutText: { color: '#FFF', fontWeight: '900', letterSpacing: 1.5 } 
});