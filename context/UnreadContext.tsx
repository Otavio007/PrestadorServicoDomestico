import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface UnreadContextType {
    unreadCount: number;
    refreshUnreadCount: () => Promise<void>;
}

const UnreadContext = createContext<UnreadContextType>({
    unreadCount: 0,
    refreshUnreadCount: async () => { },
});

export const UnreadProvider = ({ children }: { children: React.ReactNode }) => {
    const [unreadCount, setUnreadCount] = useState(0);

    const refreshUnreadCount = async () => {
        try {
            const userId = await AsyncStorage.getItem('user_id');
            const userType = await AsyncStorage.getItem('user_type'); // 'cliente' or 'prestador'

            if (!userId || !userType) return;

            // Determine if the user is receiving messages as a client (from provider) or as a provider (from client)
            // If I am a client, I want to count messages sent by 'prestador' that are not read.
            // If I am a provider, I want to count messages sent by 'cliente' that are not read.

            // The 'enviado_por' field helps us. 
            // If userType === 'cliente', we look for messages where id_cliente === userId AND enviado_por === 'prestador' AND lida === false
            // If userType === 'prestador', we look for messages where id_prestador === userId AND enviado_por === 'cliente' AND lida === false

            let query = supabase
                .from('mensagem')
                .select('*', { count: 'exact', head: true })
                .eq('lida', false);

            if (userType === 'cliente') {
                query = query
                    .eq('id_cliente', userId) // Messages belonging to this client conversation
                    .eq('enviado_por', 'prestador'); // Sent by the other party
            } else {
                query = query
                    .eq('id_prestador', userId) // Messages belonging to this provider conversation
                    .eq('enviado_por', 'cliente'); // Sent by the other party
            }

            const { count, error } = await query;

            if (error) {
                console.error('Error fetching unread count:', error);
                return;
            }

            setUnreadCount(count || 0);

        } catch (error) {
            console.error('Error in refreshUnreadCount:', error);
        }
    };

    useEffect(() => {
        refreshUnreadCount();

        // Subscribe to changes in the 'mensagem' table to update count in real-time
        const subscription = supabase
            .channel('public:mensagem_unread')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagem' }, () => {
                refreshUnreadCount();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return (
        <UnreadContext.Provider value={{ unreadCount, refreshUnreadCount }}>
            {children}
        </UnreadContext.Provider>
    );
};

export const useUnread = () => useContext(UnreadContext);
