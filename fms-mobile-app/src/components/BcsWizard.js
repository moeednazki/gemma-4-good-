import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function BcsWizard({ onComplete }) {
  const [score, setScore] = useState(3.0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Adjust Body Condition Score</Text>
      <Text style={styles.scoreDisplay}>{score.toFixed(2)}</Text>
      
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => setScore(Math.max(1, score - 0.25))}>
          <Text style={styles.btnText}>-</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => setScore(Math.min(5, score + 0.25))}>
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.confirmBtn} onPress={() => onComplete(score)}>
        <Text style={styles.confirmText}>Confirm BCS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10, alignItems: 'center', marginTop: 10 },
  title: { fontSize: 12, fontWeight: 'bold', color: '#64748B', marginBottom: 10 },
  scoreDisplay: { fontSize: 36, fontWeight: '900', color: '#2563EB', marginBottom: 15 },
  row: { flexDirection: 'row', gap: 24, marginBottom: 20 },
  btn: { backgroundColor: '#E2E8F0', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  confirmBtn: { backgroundColor: '#10B981', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  confirmText: { color: '#FFF', fontWeight: '900', fontSize: 16 }
});