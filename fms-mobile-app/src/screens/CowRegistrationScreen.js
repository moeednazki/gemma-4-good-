import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';

export default function CowRegistrationScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  
  // State elements mapped directly to your production Firestore schema
  const [tagId, setTagId] = useState('');
  const [nickname, setNickname] = useState('');
  const [breed, setBreed] = useState('hf'); // Default matching your Firestore console entry
  const [gender, setGender] = useState('Female');
  const [status, setStatus] = useState('Active');
  const [expectedYield, setExpectedYield] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [entryWeight, setEntryWeight] = useState('');
  const [bcs, setBcs] = useState('0');
  const [damId, setDamId] = useState('');
  const [sireId, setSireId] = useState('');
  const [description, setDescription] = useState('');

  const handleRegisterAsset = async () => {
    if (!tagId) {
      return Platform.OS === 'web' ? window.alert('Animal Tag ID is strictly required.') : Alert.alert('Validation Error', 'Animal Tag ID is strictly required.');
    }

    setLoading(true);

    try {
      // Enforce duplicate tag validation across the network layer
      const checkQuery = query(collection(db, 'cows'), where('id', '==', tagId));
      const checkSnapshot = await getDocs(checkQuery);
      
      if (!checkSnapshot.empty) {
        setLoading(false);
        return Platform.OS === 'web' ? window.alert(`Tag ID #${tagId} already exists in the system.`) : Alert.alert('Duplicate Guard', `Tag ID #${tagId} already exists in the system.`);
      }

      // Build structured payload matching production parameters
      const cowPayload = {
        id: tagId,
        name: nickname,
        breed: breed.toLowerCase(),
        gender: gender,
        status: status,
        expectedYield: parseFloat(expectedYield) || 0,
        birthDate: birthDate,
        entryWeight: parseFloat(entryWeight) || 0,
        bcs: parseFloat(bcs) || 0,
        damId: damId,
        sireId: sireId,
        description: description,
        pregnancyStatus: 'Open',
        failedAIs: 0,
        registered_at: serverTimestamp()
      };

      await addDoc(collection(db, 'cows'), cowPayload);
      
      if (Platform.OS === 'web') window.alert(`Asset Tag #${tagId} successfully written to cloud index.`);
      else Alert.alert('Success', `Asset Tag #${tagId} logged successfully.`);
      
      navigation.goBack();
    } catch (error) {
      console.error("Cloud write failed: ", error);
      if (Platform.OS === 'web') window.alert('Database write timeout. Checked your network connectivity?');
      else Alert.alert('Database Write Failure', 'Could not sync file parameters with remote Firestore nodes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Asset Profiling Registry</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>ANIMAL TAG CODE *</Text>
        <TextInput style={[styles.input, styles.requiredInput]} value={tagId} onChangeText={setTagId} placeholder="e.g. NX-088" autoCapitalize="characters" />

        <Text style={styles.label}>NICKNAME / ANIMAL NAME</Text>
        <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="e.g. Bella" />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>BREED</Text>
            <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="e.g. hf" autoCapitalize="none" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>EXPECTED YIELD (L/DAY)</Text>
            <TextInput style={styles.input} value={expectedYield} onChangeText={setExpectedYield} keyboardType="numeric" placeholder="15" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>GENDER</Text>
            <View style={styles.toggleGroup}>
              {['Female', 'Male'].map(g => (
                <TouchableOpacity key={g} style={[styles.toggleBtn, gender === g && styles.toggleBtnActive]} onPress={() => setGender(g)}>
                  <Text style={[styles.toggleText, gender === g && styles.toggleTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>CURRENT STATUS</Text>
            <View style={styles.toggleGroup}>
              {['Active', 'Dry'].map(s => (
                <TouchableOpacity key={s} style={[styles.toggleBtn, status === s && styles.toggleBtnActive]} onPress={() => setStatus(s)}>
                  <Text style={[styles.toggleText, status === s && styles.toggleTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.label}>BIRTH DATE (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={birthDate} onChangeText={setBirthDate} placeholder="e.g. 2024-03-12" />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>ENTRY WEIGHT (kg)</Text>
            <TextInput style={styles.input} value={entryWeight} onChangeText={setTarget => setEntryWeight(target)} keyboardType="numeric" placeholder="450" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>INITIAL BCS</Text>
            <TextInput style={styles.input} value={bcs} onChangeText={setBcs} keyboardType="numeric" placeholder="3.25" />
          </View>
        </View>

        <Text style={styles.label}>LINEAGE / PEDIGREE METRICS</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} value={damId} onChangeText={setDamId} placeholder="Dam ID (Mother)" autoCapitalize="characters" />
          <TextInput style={[styles.input, { flex: 1 }]} value={sireId} onChangeText={setSireId} placeholder="Sire ID (Father)" autoCapitalize="characters" />
        </View>

        <Text style={styles.label}>DESCRIPTIVE REMARKS</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Enter physical markings, procurement source records or health observations..." multiline numberOfLines={3} />

        <TouchableOpacity style={styles.submitBtn} onPress={handleRegisterAsset} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>COMMIT ANIMAL TO CLOUD PROFILE</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { backgroundColor: '#0F172A', padding: 24, paddingTop: 60, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: '#38BDF8', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  card: { backgroundColor: '#FFFFFF', margin: 16, padding: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  label: { fontSize: 10, fontWeight: '900', color: '#64748B', marginBottom: 6, marginTop: 14, letterSpacing: 1 },
  input: { borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#F8FAFC', color: '#1E293B', fontWeight: 'bold' },
  requiredInput: { borderColor: '#CBD5E1', backgroundColor: '#FFFBEB' },
  row: { flexDirection: 'row', gap: 10 },
  toggleGroup: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 4, marginTop: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  toggleBtnActive: { backgroundColor: '#2563EB' },
  toggleText: { color: '#64748B', fontWeight: 'bold', fontSize: 13 },
  toggleBtnActive: { backgroundColor: '#0F172A' },
  toggleTextActive: { color: '#FFF' },
  textArea: { height: 70, textAlignVertical: 'top', fontWeight: 'normal' },
  submitBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 26 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 }
});