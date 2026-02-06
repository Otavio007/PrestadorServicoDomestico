import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as DocumentPicker from 'expo-document-picker'; // Removed due to installation issues
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnread } from '../../../context/UnreadContext';
import { supabase } from '../../../lib/supabase';

interface Message {
    id_mensagem: number;
    id_prestador: string;
    id_cliente: string;
    texto: string;
    data_mensagem: string;
    sent_by_me: boolean;
}

export default function ChatDetailScreen() {
    const { id: providerId } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [userId, setUserId] = useState<string | null>(null);
    const [providerName, setProviderName] = useState('Conversa');
    const [providerImage, setProviderImage] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const { refreshUnreadCount } = useUnread();

    useEffect(() => {
        loadData();
    }, [providerId]);

    useEffect(() => {
        if (!userId || !providerId) return;

        const subscription = subscribeToMessages(userId);

        // Polling fallback: Fetch messages every 20 seconds
        const interval = setInterval(() => {
            fetchMessages(userId);
        }, 20000);

        return () => {
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [userId, providerId]);

    async function loadData() {
        const id = await AsyncStorage.getItem('user_id');
        if (!id) return;
        setUserId(id);

        // Fetch Provider Name and Messages in parallel for faster load
        fetchMessages(id);

        const { data: pData } = await supabase
            .from('prestador')
            .select('nome')
            .eq('id_prestador', providerId)
            .single();
        if (pData) setProviderName(pData.nome);

        // Mark messages as read
        markMessagesAsRead(id);

        // Fetch profile image
        const { data: imgData } = await supabase
            .from('imagem_perfil')
            .select('img')
            .eq('id_usuario', providerId)
            .maybeSingle();
        if (imgData) setProviderImage(imgData.img);
    }

    async function fetchMessages(clientId: string) {
        const { data, error } = await supabase
            .from('mensagem')
            .select('*')
            .or(`and(id_cliente.eq.${clientId},id_prestador.eq.${providerId})`)
            .order('data_mensagem', { ascending: true });

        if (data) {
            setMessages(data.map((m: any) => ({
                ...m,
                sent_by_me: m.enviado_por === 'cliente'
            })));
        }
    }

    async function markMessagesAsRead(clientId: string) {
        if (!clientId || !providerId) return;

        const { error } = await supabase
            .from('mensagem')
            .update({ lida: true })
            .eq('id_cliente', clientId)
            .eq('id_prestador', providerId)
            .eq('enviado_por', 'prestador') // Messages sent by provider
            .eq('lida', false);

        if (!error) {
            refreshUnreadCount();
        }
    }

    function subscribeToMessages(currentUserId: string) {
        return supabase
            .channel('public:mensagem')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagem' }, (payload) => {
                const newMessage = payload.new as any;

                // Only add if it's for this conversation AND NOT sent by me 
                if (newMessage.id_prestador === providerId &&
                    newMessage.id_cliente === currentUserId &&
                    newMessage.enviado_por !== 'cliente') {
                    setMessages(prev => {
                        if (prev.some(m => m.id_mensagem === newMessage.id_mensagem)) return prev;
                        return [...prev, { ...newMessage, sent_by_me: false }];
                    });

                    // Mark this new message as read immediately if I'm viewing the chat
                    markMessagesAsRead(currentUserId);
                }
            })
            .subscribe();
    }

    async function handleSend() {
        if (!inputText.trim() || !userId) return;

        const messageText = inputText.trim();
        const msgId = Date.now();
        const tempMessage: Message = {
            id_mensagem: msgId,
            id_prestador: providerId,
            id_cliente: userId,
            texto: messageText,
            data_mensagem: new Date().toISOString(),
            sent_by_me: true
        };

        // 1. Optimistic Update (Show message immediately)
        setMessages(prev => [...prev, tempMessage]);
        setInputText('');

        // 2. Persist to DB
        const { error } = await supabase
            .from('mensagem')
            .insert({
                id_mensagem: msgId,
                texto: messageText,
                id_prestador: providerId,
                id_cliente: userId,
                enviado_por: 'cliente'
            });

        if (error) {
            console.error('Error sending message:', error);
            // Optional: Remove the message or show error state if it fails
            Alert.alert('Erro ao enviar', 'Não foi possível enviar sua mensagem.');
            setMessages(prev => prev.filter(m => m.id_mensagem !== msgId));
        }
    }


    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.sent_by_me;
        return (
            <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
                <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
                    {item.texto}
                </Text>
                <Text style={[styles.messageTime, isMe ? styles.myTime : styles.theirTime]}>
                    {new Date(item.data_mensagem).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/(client)/chats')} style={styles.backButton}>
                    <ArrowLeft color="#1F2937" size={24} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Image
                        source={{ uri: providerImage || `https://ui-avatars.com/api/?name=${providerName}&background=random` }}
                        style={styles.headerAvatar}
                    />
                    <Text style={styles.providerName}>{providerName}</Text>
                </View>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id_mensagem.toString()}
                renderItem={renderMessage}
                contentContainerStyle={styles.messageList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.inputContainer}>

                    <TextInput
                        style={styles.input}
                        placeholder="Mensagem..."
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />

                    <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                        <Send color="#FFFFFF" size={20} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: { marginRight: 12 },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
    },
    providerName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
    statusText: { fontSize: 12, color: '#10B981' },
    messageList: { padding: 16, paddingBottom: 24 },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8,
    },
    myBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#4F46E5',
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
    },
    messageText: { fontSize: 16 },
    myText: { color: '#FFFFFF' },
    theirText: { color: '#111827' },
    messageTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
    myTime: { color: 'rgba(255,255,255,0.7)' },
    theirTime: { color: '#9CA3AF' },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    input: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginHorizontal: 8,
        fontSize: 16,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: '#4F46E5',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
