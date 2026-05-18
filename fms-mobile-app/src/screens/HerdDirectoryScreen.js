import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
// Modified: Replaced getDocs with onSnapshot for real-time offline/online resilience
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';

export default function HerdDirectoryScreen({ navigation }) {
  const [cows, setCows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'cows'), orderBy('id', 'asc'));
    
    // Native listener automatically manages local disk cache vs remote cloud lookups
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stockList = snapshot.docs.map(doc => ({
        firestoreId: doc.id,
        ...doc.data()
      }));
      setCows(stockList);
      setLoading(false);
    }, (error) => {
      console.error("Inventory stream error: ", error);
      setLoading(false);
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, []);

  const handleDisplayAnimalDetails = (item) => {
    const contextContent = 
      `Breed: ${item.breed?.toUpperCase() || 'HF'}\n` +
      `Gender: ${item.gender || 'Female'}\n` +
      `Current Status: ${item.status || 'Active'}\n` +
      `Reproduction Status: ${item.pregnancyStatus || 'Open'}\n` +
      `Expected Production: ${item.expectedYield || 0} L/day\n` +
      `Failed AI Index: ${item.failedAIs || 0}\n\n` +
      `Dam Identification: ${item.damId || 'Unrecorded'}\n` +
      `Sire Identification: ${item.sireId || 'Unrecorded'}\n` +
      `Remarks: ${item.description || 'No notes saved'}`;

    if (Platform.OS === 'web') {
      window.alert(`ANIMAL DATA SHEET: ${item.id}\n\n${contextContent}`);
    } else {
      Alert.alert(`Animal Profile: ${item.id}`, contextContent, [{ text: 'Close' }]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← COCKPIT</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Herd Inventory</Text>
        <Text style={styles.subtitle}>{cows.length} Productive Heads Active</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Syncing Live Inventory Matrix...</Text>
        </View>
      ) : (
        <FlatList
          data={cows}
          keyExtractor={(item) => item.firestoreId}
          contentContainerStyle={{ padding: 16 }}
          // Removed manual onRefresh as onSnapshot handles real-time updates automatically
          renderItem={({ item }) => (
            // Upgraded View to TouchableOpacity to trigger the animal details overlay
            <TouchableOpacity style={styles.cowCard} onPress={() => handleDisplayAnimalDetails(item)}>
              <View style={styles.cardMain}>
                <View>
                  <Text style={styles.tagText}>TAG: {item.id || 'Un-tagged'}</Text>
                  {item.name ? <Text style={styles.nameText}>"{item.name}"</Text> : null}
                  <Text style={styles.metaText}>Breed: {item.breed?.toUpperCase()} • Target: {item.expectedYield || 0} L/day</Text>
                </View>
                <View style={styles.badgeContainer}>
                  <View style={[styles.statusBadge, item.status === 'Active' ? styles.bgActive : styles.bgDry]}>
                    <Text style={styles.badgeText}>{item.status?.toUpperCase() || 'ACTIVE'}</Text>
                  </View>
                  <View style={styles.reproBadge}>
                    <Text style={styles.reproBadgeText}>{item.pregnancyStatus || 'Open'}</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.cardFooter}>
                <Text style={styles.footerStat}>Weight: <Text style={{color: '#1E293B'}}>{item.entryWeight || '--'} kg</Text></Text>
                <Text style={styles.footerStat}>BCS Assessed: <Text style={{color: '#2563EB'}}>{item.bcs || '0.00'}</Text></Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No indexed records found in collection 'cows'.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#0F172A', padding: 24, paddingTop: 60, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  backBtn: { marginBottom: 6 },
  backBtnText: { color: '#38BDF8', fontWeight: '900', fontSize: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#94A3B8', fontSize: 13, fontWeight: 'bold', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: 'bold', fontSize: 13 },
  cowCard: { backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, overflow: 'hidden' },
  // Fixed typo: removed redundant "pading: 16"
  cardMain: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagText: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  nameText: { fontSize: 13, fontWeight: 'bold', color: '#64748B', fontStyle: 'italic', marginTop: 1 },
  metaText: { fontSize: 12, color: '#64748B', marginTop: 6, fontWeight: 'bold' },
  badgeContainer: { alignItems: 'flex-end', gap: 6 },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  bgActive: { backgroundColor: '#DCFCE7' },
  bgDry: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#14532D' },
  reproBadge: { backgroundColor: '#EFF6FF', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  reproBadgeText: { fontSize: 10, fontWeight: '900', color: '#1E40AF' },
  cardFooter: { backgroundColor: '#F8FAFC', paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between' },
  footerStat: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#94A3B8', fontWeight: 'bold', fontSize: 14 }
});