import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './src/screens/LoginScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import CowAssessmentScreen from './src/screens/CowAssessmentScreen';
import HerdDirectoryScreen from './src/screens/HerdDirectoryScreen';
import CowRegistrationScreen from './src/screens/CowRegistrationScreen';
import EconomicsScreen from './src/screens/EconomicsScreen';
import LogisticsScreen from './src/screens/LogisticsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="BarnEntry" component={CowAssessmentScreen} />
        <Stack.Screen name="HerdDirectory" component={HerdDirectoryScreen} />
        <Stack.Screen name="CowRegistration" component={CowRegistrationScreen} />
        <Stack.Screen name="Economics" component={EconomicsScreen} />
        <Stack.Screen name="Logistics" component={LogisticsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}