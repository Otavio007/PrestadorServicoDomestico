import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="signup-prestador" />
        <Stack.Screen name="signup-client" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(provider)" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
