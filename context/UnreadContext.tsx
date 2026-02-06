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
            let userId = await AsyncStorage.getItem('user_id');
            let userType = await AsyncStorage.getItem('user_type'); // 'cliente' or 'prestador'

            if (!userId) return;

            // If userType is missing, try to fetch it from the database once
            if (!userType) {
                const { data: accessData } = await supabase
                    .from('acesso')
                    .select('tipo_login')
                    .eq('login', userId)
                    .single();

                if (accessData) {
                    const type = accessData.tipo_login?.toLowerCase();
                    if (type === 'prestador' || type === 'prestador de serviço') {
                        userType = 'prestador';
                    } else if (type === 'cliente' || type === 'client') {
                        userType = 'cliente';
                    }
                    if (userType) {
                        await AsyncStorage.setItem('user_type', userType);
                    }
                }
            }

            if (!userType) return;

            // Determine if the user is receiving messages as a client (from provider) or as a provider (from client)
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
