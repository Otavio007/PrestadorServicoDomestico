import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// TODO: Replace with your actual Supabase URL and Anon Key
const supabaseUrl = 'https://xoiflkavwimjpenhxnij.supabase.co';
const supabaseAnonKey = 'sb_publishable_uQTtwUdGrgZOkgQtVKIk0g_oC6LTizk';

// Custom Storage Adapter for Web/Native compatibility
const ExpoStorage = {
    getItem: (key: string) => {
        if (typeof window !== 'undefined') {
            return AsyncStorage.getItem(key);
        }
        return Promise.resolve(null);
    },
    setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') {
            return AsyncStorage.setItem(key, value);
        }
        return Promise.resolve();
    },
    removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
            return AsyncStorage.removeItem(key);
        }
        return Promise.resolve();
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
