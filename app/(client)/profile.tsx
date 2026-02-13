import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, LogOut, MessageCircle, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { openWhatsAppSupport } from '../../lib/support';

export default function ClientProfileScreen() {
    const router = useRouter();

    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [userName, setUserName] = useState('Cliente Usuário');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const id = await AsyncStorage.getItem('user_id');
            if (id) {
                setUserId(id);

                // Fetch User Name
                const { data: userData } = await supabase
                    .from('cliente')
                    .select('nome')
                    .eq('id_cliente', id)
                    .single();
                if (userData) setUserName(userData.nome);

                // Fetch Profile Image
                const { data: imgData } = await supabase
                    .from('imagem_perfil')
                    .select('img')
                    .eq('id_usuario', id)
                    .maybeSingle();
                if (imgData) setProfileImage(imgData.img);
            }
        } catch (err) {
            console.error('Error loading profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('user_id');
        router.replace('/');
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permissão', 'Necessário acesso à galeria.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            try {
                const response = await fetch(uri);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    setProfileImage(reader.result as string);
                };
                reader.readAsDataURL(blob);
            } catch (err) {
                console.error('Error converting image:', err);
                setProfileImage(uri);
            }
        }
    };

    const handleSave = async () => {
        if (!userId) return;
        setSaving(true);
        try {
            await supabase.from('imagem_perfil').delete().eq('id_usuario', userId);
            if (profileImage) {
                const { error } = await supabase.from('imagem_perfil').insert({
                    id_usuario: userId,
                    img: profileImage
                });
                if (error) throw error;
            }
            Alert.alert('Sucesso', 'Perfil atualizado!');
        } catch (err) {
            console.error('Error saving image:', err);
            Alert.alert('Erro', 'Não foi possível salvar a imagem.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Image
                        source={require('../../assets/images/logo.png')}
                        style={{ width: 40, height: 40 }}
                        resizeMode="contain"
                    />
                    <Text style={[styles.title, { marginLeft: 8 }]}>ConsertJá - Meu Perfil</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.profileCard}>
                    <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
                        {profileImage ? (
                            <Image source={{ uri: profileImage }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <User size={40} color="#4F46E5" />
                            </View>
                        )}
                        <View style={styles.editBadge}>
                            <Camera size={14} color="#FFF" />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.userName}>{userName}</Text>
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar Perfil'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.supportButton}
                    onPress={openWhatsAppSupport}
                >
                    <MessageCircle size={20} color="#4F46E5" style={{ marginRight: 8 }} />
                    <Text style={styles.supportButtonText}>Suporte via WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <LogOut size={20} color="#EF4444" style={{ marginRight: 8 }} />
                    <Text style={styles.logoutText}>Sair da Conta</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { padding: 24, backgroundColor: '#FFFFFF' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
    content: { padding: 24 },
    profileCard: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#4F46E5',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    userName: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    saveButton: {
        backgroundColor: '#4F46E5',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    logoutText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
    supportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EEF2FF',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#C7D2FE',
        marginBottom: 16,
    },
    supportButtonText: { color: '#4F46E5', fontSize: 16, fontWeight: '600' },
});
