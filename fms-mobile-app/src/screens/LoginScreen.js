import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      return Platform.OS === 'web' 
        ? window.alert('Please enter both username and password.') 
        : Alert.alert('Error', 'Please enter both username and password.');
    }

    setLoading(true);

    try {
      // Expanded to 8000ms to ensure normal online paths are never cut off prematurely
      const networkTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Cloud verification timeout")), 8000)
      );

      // 1. ATTEMPT ONLINE LOGIN VIA FIRESTORE (RACED AGAINST 8-SECOND TIMEOUT)
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username), where('password', '==', password), where('role', '==', 'admin'));
      
      // Races the live database call against the extended fallback timer
      const querySnapshot = await Promise.race([
        getDocs(q),
        networkTimeout
      ]);

      if (!querySnapshot.empty) {
        // Online Success: Cache the credentials for future offline use
        await AsyncStorage.setItem('@cached_admin_creds', JSON.stringify({ username, password }));
        setLoading(false);
        navigation.replace('AdminDashboard');
      } else {
        setLoading(false);
        if (Platform.OS === 'web') window.alert('Login Failed: Invalid credentials or not an Admin account.');
        else Alert.alert('Login Failed', 'Invalid credentials or not an Admin account.');
      }

    } catch (error) {
      // 2. TIMEOUT OR NETWORK FAILED - ATTEMPT OFFLINE AUTH VIA ASYNC STORAGE
      console.warn("Cloud path unavailable or timed out, authenticating via local vault context...", error);
      
      const cachedCreds = await AsyncStorage.getItem('@cached_admin_creds');
      if (cachedCreds) {
        const { username: cachedUser, password: cachedPass } = JSON.parse(cachedCreds);
        
        if (username === cachedUser && password === cachedPass) {
          setLoading(false);
          if (Platform.OS === 'web') {
            window.alert('Offline Mode: Logged in using cached credentials. Cloud sync is paused.');
          } else {
            Alert.alert('Offline Mode', 'Logged in using cached credentials. Cloud sync is paused.');
          }
          navigation.replace('AdminDashboard');
        } else {
          setLoading(false);
          if (Platform.OS === 'web') window.alert('Offline Auth Failed: Credentials do not match the last saved session.');
          else Alert.alert('Offline Auth Failed', 'Credentials do not match the last saved session.');
        }
      } else {
        setLoading(false);
        if (Platform.OS === 'web') {
          window.alert('No Network Connection: You must log in online at least once to cache credentials locally.');
        } else {
          Alert.alert('No Network', 'Cannot log in. You must log in online at least once to cache credentials.');
        }
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>NooRganics</Text>
        <Text style={styles.subtitle}>Mainframe Edge Client</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>ADMIN USERNAME</Text>
        <TextInput 
          style={styles.input} 
          value={username} 
          onChangeText={setUsername} 
          autoCapitalize="none" 
        />

        <Text style={styles.label}>PASSWORD</Text>
        <TextInput 
          style={styles.input} 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginBtnText}>AUTHENTICATE</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', padding: 20 },
  headerBox: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 14, fontWeight: 'bold', color: '#2563EB', marginTop: 4, letterSpacing: 1 },
  form: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 16, elevation: 4 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#64748B', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: '#F8FAFC', color: '#1E293B', fontWeight: 'bold' },
  loginBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 30 },
  loginBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16, letterSpacing: 1 }
});