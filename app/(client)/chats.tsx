import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { MessageSquare, Search } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

interface ChatItem {
    id_prestador: string;
    prestador_name: string;
    last_message: string;
    time: string;
    avatar: string | null;
    unread_count: number;
}

export default function ChatsScreen() {
    const router = useRouter();
    const [chats, setChats] = useState<ChatItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        loadUserId();
    }, []);

    async function loadUserId() {
        const id = await AsyncStorage.getItem('user_id');
        setUserId(id);
        if (id) fetchChats(id);
    }

    useFocusEffect(
        useCallback(() => {
            if (userId) {
                fetchChats(userId);
            }
        }, [userId])
    );

    async function fetchChats(clientId: string) {
        try {
            // 1. Fetch messages for the client
            const { data: messagesData, error: messagesError } = await supabase
                .from('mensagem')
                .select('id_prestador, texto, data_mensagem')
                .eq('id_cliente', clientId)
                .order('data_mensagem', { ascending: false });

            if (messagesError) throw messagesError;

            if (messagesData && messagesData.length > 0) {
                // 2. Get unique provider IDs
                const providerIds = [...new Set(messagesData.map(m => m.id_prestador))];

                // 3. Fetch provider names
                const { data: providersData, error: providersError } = await supabase
                    .from('prestador')
                    .select('id_prestador, nome')
                    .in('id_prestador', providerIds);

                if (providersError) throw providersError;

                // 3.5 Fetch provider images
                const { data: imagesData } = await supabase
                    .from('imagem_perfil')
                    .select('id_usuario, img')
                    .in('id_usuario', providerIds);

                const imageMap = (imagesData || []).reduce((acc: any, curr: any) => {
                    acc[curr.id_usuario] = curr.img;
                    return acc;
                }, {});

                const providerMap = (providersData || []).reduce((acc: any, curr: any) => {
                    acc[curr.id_prestador] = curr.nome;
                    return acc;
                }, {});

                // 3.6 Fetch Unread Counts per Provider
                const { data: unreadData } = await supabase
                    .from('mensagem')
                    .select('id_prestador')
                    .eq('id_cliente', clientId)
                    .eq('enviado_por', 'prestador')
                    .eq('lida', false);

                const unreadMap = (unreadData || []).reduce((acc: any, curr: any) => {
                    acc[curr.id_prestador] = (acc[curr.id_prestador] || 0) + 1;
                    return acc;
                }, {});

                // 4. Aggregate by provider to show latest message
                const uniqueChats: Record<string, ChatItem> = {};
                messagesData.forEach((m: any) => {
                    if (!uniqueChats[m.id_prestador]) {
                        uniqueChats[m.id_prestador] = {
                            id_prestador: m.id_prestador,
                            prestador_name: providerMap[m.id_prestador] || 'Prestador',
                            last_message: m.texto || 'Anexo',
                            time: new Date(m.data_mensagem).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }),
                            avatar: imageMap[m.id_prestador] || null,
                            unread_count: unreadMap[m.id_prestador] || 0
                        };
                    }
                });
                setChats(Object.values(uniqueChats));
            }
        } catch (err) {
            console.error('Error fetching chats:', err);
        } finally {
            setLoading(false);
        }
    }

    const renderChatItem = ({ item }: { item: ChatItem }) => (
        <TouchableOpacity
            style={styles.chatCard}
            onPress={() => router.push({ pathname: '/(client)/chat/[id]', params: { id: item.id_prestador } })}
        >
            {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
            ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: '#E0E7FF' }]}>
                    <Text style={styles.avatarText}>{item.prestador_name.substring(0, 2).toUpperCase()}</Text>
                </View>
            )}
            <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                    <Text style={styles.providerName}>{item.prestador_name}</Text>
                    <Text style={styles.timeText}>{item.time}</Text>
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>{item.last_message}</Text>
            </View>
            {item.unread_count > 0 && (
                <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    const [searchQuery, setSearchQuery] = useState('');

    const filteredChats = chats.filter(chat =>
        chat.prestador_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Image
                        source={require('../../assets/images/logo.png')}
                        style={{ width: 40, height: 40 }}
                        resizeMode="contain"
                    />
                    <Text style={[styles.title, { marginLeft: 8 }]}>ConsertJá - Mensagens</Text>
                </View>
            </View>

            <View style={styles.searchContainer}>
                <Search color="#9CA3AF" size={20} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar conversas..."
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <FlatList
                data={filteredChats}
                keyExtractor={item => item.id_prestador}
                renderItem={renderChatItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MessageSquare size={48} color="#D1D5DB" />
                        <Text style={styles.emptyText}>
                            {loading ? 'Carregando...' : (searchQuery ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa iniciada.')}
                        </Text>
                    </View>
                }
                refreshing={loading}
                onRefresh={() => userId && fetchChats(userId)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { padding: 24, backgroundColor: '#FFFFFF' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 24,
        marginTop: -15,
        marginBottom: 16,
        paddingHorizontal: 12,
        height: 48,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 16, color: '#1F2937' },
    listContent: { paddingHorizontal: 24 },
    chatCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    avatarText: { color: '#4F46E5', fontWeight: 'bold', fontSize: 16 },
    chatInfo: { flex: 1, marginLeft: 16 },
    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    providerName: { fontSize: 16, fontWeight: '600', color: '#111827' },
    timeText: { fontSize: 12, color: '#9CA3AF' },
    lastMessage: { fontSize: 14, color: '#6B7280' },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { marginTop: 12, fontSize: 16, color: '#9CA3AF' },
    unreadBadge: {
        backgroundColor: '#4F46E5',
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginLeft: 8,
    },
    unreadBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
