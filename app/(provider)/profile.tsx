import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, LogOut, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchableSelect, SearchableSelectItem } from '../../components/SearchableSelect';
import { supabase } from '../../lib/supabase';

export default function ProviderProfileScreen() {
    const router = useRouter();


    // State for fields
    const [description, setDescription] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [portfolioImages, setPortfolioImages] = useState<string[]>([]);

    // Profile Data
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [cpf, setCpf] = useState('');

    // Address Data
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [district, setDistrict] = useState('');
    const [zip, setZip] = useState('');
    const [state, setState] = useState('');

    // Services & Cities (Dynamic)
    const [servicesList, setServicesList] = useState<SearchableSelectItem[]>([]);
    const [citiesList, setCitiesList] = useState<SearchableSelectItem[]>([]);

    const [selectedServices, setSelectedServices] = useState<number[]>([]);
    const [selectedCities, setSelectedCities] = useState<number[]>([]);

    // Loading State
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedCity, setSelectedCity] = useState<number | null>(null);

    useEffect(() => {
        fetchProfileData();
    }, []);

    async function fetchProfileData() {
        try {
            const userId = await AsyncStorage.getItem('user_id');
            if (!userId) {
                Alert.alert('Erro', 'Usuário não identificado.');
                router.replace('/');
                return;
            }
            setCurrentUserId(userId);

            console.log('Fetching profile for user:', userId);

            // 1. Fetch All Services & Cities for Selectors
            const { data: allServices } = await supabase.from('servico').select('id_servico, nome');
            if (allServices) {
                setServicesList(allServices.map((s: any) => ({ label: s.nome, value: s.id_servico })));
            }

            const { data: allCities } = await supabase.from('cidade').select('id, descricao');
            if (allCities) {
                setCitiesList(allCities.map((c: any) => ({ label: c.descricao, value: c.id })));
            }

            // 2. Fetch Provider Basic Info
            const { data: providerData, error: providerError } = await supabase
                .from('prestador')
                .select('*')
                .eq('id_prestador', userId)
                .single();

            if (providerError) throw providerError;

            if (providerData) {
                setName(providerData.nome || '');
                setPhone(providerData.fone1 || '');
                setEmail(providerData.email || '');
                setCpf(providerData.cpf_cnpj || '');
                setDescription(providerData.texto_meuperfil || '');

                // Address fields
                setStreet(providerData.logradouro || '');
                setNumber(providerData.num_logradouro || '');
                setDistrict(providerData.bairro || '');
                setZip(providerData.cep || '');
                setState(providerData.uf || '');
                setSelectedCity(providerData.id_cidade || null);
                // Note: signup-prestador inserted 'logradouro', 'num_logradouro', 'bairro' etc.
                // Let's verify mapping: 'logradouro'->street, 'num_logradouro'->number.
                // Checking previous files, signup used 'num_logradouro'.
                // I will assume standard naming or check carefully.
                // In signup-prestador.tsx, it inserts: { nome, email, cpf_cnpj, fone1, logradouro: street, num_logradouro: number, bairro: district, cep, ... }
                // So I will map correctly.
                setStreet(providerData.logradouro || '');
                setNumber(providerData.num_logradouro || '');
                setDistrict(providerData.bairro || '');
                setZip(providerData.cep || '');
                // 'uf' or 'estado' wasn't explicitly mentioned in signup insert in the summaries, but common.
                // If column missing, it will just be undefined.
            }

            // 3. Fetch Selected Services
            const { data: serviceData } = await supabase
                .from('servico_prestador')
                .select('id_servico')
                .eq('id_prestador', userId);

            if (serviceData) {
                setSelectedServices(serviceData.map((s: any) => s.id_servico));
            }

            // 4. Fetch Selected Cities
            const { data: cityData } = await supabase
                .from('cidade_atuacao')
                .select('id_cidade')
                .eq('id_prestador', userId);

            if (cityData) {
                setSelectedCities(cityData.map((c: any) => c.id_cidade));
            }

            // 5. Fetch Portfolio Images
            const { data: portfolioData } = await supabase
                .from('imagem_portfolio')
                .select('imagem')
                .eq('id_prestador', userId);

            if (portfolioData) {
                setPortfolioImages(portfolioData.map((img: any) => img.imagem));
            }

            // 6. Fetch Profile Image
            const { data: profileImgData } = await supabase
                .from('imagem_perfil')
                .select('img')
                .eq('id_usuario', userId)
                .maybeSingle();

            if (profileImgData) {
                setProfileImage(profileImgData.img);
            }

        } catch (error: any) {
            console.error('Error loading profile:', error);
            Alert.alert('Erro', 'Erro ao carregar dados.');
        } finally {
            setLoading(false);
        }
    }

    const pickImage = async (type: 'profile' | 'portfolio') => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Permissão', 'Necessário acesso à galeria.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: type === 'profile' ? [1, 1] : [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            if (type === 'profile') {
                // For profile, we'll convert to base64 to save directly in the DB as requested
                try {
                    const response = await fetch(uri);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        setProfileImage(reader.result as string);
                    };
                    reader.readAsDataURL(blob);
                } catch (err) {
                    console.error('Error converting image to base64:', err);
                    setProfileImage(uri);
                }
            } else {
                setPortfolioImages([...portfolioImages, uri]);
            }
        }
    };

    async function handleSave() {
        if (!currentUserId) return;

        try {
            setSaving(true);

            // 1. Update Provider Basic Info & Address
            const { error: pError } = await supabase
                .from('prestador')
                .update({
                    nome: name,
                    fone1: phone,
                    email: email,
                    cpf_cnpj: cpf,
                    texto_meuperfil: description,
                    logradouro: street,
                    num_logradouro: number || null, // Ensure empty string becomes null
                    bairro: district,
                    cep: zip ? parseInt(zip.replace(/\D/g, ''), 10) : null, // Convert to bigint/int
                    id_cidade: selectedCity,
                })
                .eq('id_prestador', currentUserId);

            if (pError) throw pError;

            // 1.5. Update Login Info (CPF) in 'acesso' table
            const { error: aError } = await supabase
                .from('acesso')
                .update({
                    CPF: cpf
                })
                .eq('login', currentUserId);

            if (aError) {
                console.warn('Error updating login info:', aError);
                // We don't necessarily throw here if the prestador update worked, but it's good to know
            }

            // 2. Update Services
            if (selectedServices.length > 0) {
                // Delete old and insert new
                await supabase.from('servico_prestador').delete().eq('id_prestador', currentUserId);

                const serviceInserts = selectedServices.map(serviceId => ({
                    id_prestador: currentUserId,
                    id_servico: serviceId
                }));

                await supabase.from('servico_prestador').insert(serviceInserts);
            }

            // 3. Update Cities of Operation
            if (selectedCities.length > 0) {
                await supabase.from('cidade_atuacao').delete().eq('id_prestador', currentUserId);
                const cityInserts = selectedCities.map(cityId => ({
                    id_prestador: currentUserId,
                    id_cidade: cityId
                }));
                await supabase.from('cidade_atuacao').insert(cityInserts);
            }

            // 4. Update Portfolio Images
            // Simple sync: delete existing for this provider and insert current list
            await supabase.from('imagem_portfolio').delete().eq('id_prestador', currentUserId);

            if (portfolioImages.length > 0) {
                const portfolioInserts = portfolioImages.map(imgUri => ({
                    id_imagem: Date.now() + Math.floor(Math.random() * 1000), // Random ID approach as bigint
                    id_prestador: currentUserId,
                    imagem: imgUri,
                }));
                const { error: portfolioError } = await supabase.from('imagem_portfolio').insert(portfolioInserts);
                if (portfolioError) throw portfolioError;
            }

            // 5. Update Profile Image
            if (profileImage) {
                // Delete old and insert new (or upsert if possible)
                await supabase.from('imagem_perfil').delete().eq('id_usuario', currentUserId);
                const { error: imgError } = await supabase.from('imagem_perfil').insert({
                    id_usuario: currentUserId,
                    img: profileImage
                });
                if (imgError) throw imgError;
            }

            Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
        } catch (error: any) {
            console.error('Error saving profile:', error);
            Alert.alert('Erro', 'Falha ao salvar alterações: ' + error.message);
        } finally {
            setSaving(false);
        }
    }


    if (loading) {
        return (
            <SafeAreaView style={[styles.container, styles.center]}>
                <Text>Carregando...</Text>
            </SafeAreaView>
        );
    }

    // Determine Role Label for UI
    const currentServiceLabel = selectedServices.length > 0
        ? servicesList.filter(s => selectedServices.includes(s.value as number)).map(s => s.label).join(', ')
        : 'Prestador';

    const handleLogout = async () => {
        await AsyncStorage.removeItem('user_id');
        router.replace('/');
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Header */}
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>Meu Perfil</Text>
                </View>

                {/* 1. Header / Avatar Section */}
                <View style={styles.profileSection}>
                    <TouchableOpacity onPress={() => pickImage('profile')}>
                        {profileImage ? (
                            <Image source={{ uri: profileImage }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Camera size={40} color="#9CA3AF" />
                                <Text style={styles.avatarPlaceholderText}>Adicionar Foto</Text>
                            </View>
                        )}
                        <View style={styles.editIconBadge}>
                            <Plus size={16} color="#FFF" />
                        </View>
                    </TouchableOpacity>

                    {/* Editable Name */}
                    <TextInput
                        style={styles.nameInput}
                        value={name}
                        onChangeText={setName}
                        placeholder="Seu Nome"
                        textAlign="center"
                    />
                    <Text style={styles.userRole}>{currentServiceLabel}</Text>

                    {/* Save Button (Moved here) */}
                    <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                        {saving ? (
                            <Text style={styles.saveButtonText}>Salvando...</Text>
                        ) : (
                            <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* 2. About Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sobre</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        multiline
                        placeholder="Descreva suas habilidades..."
                        value={description}
                        onChangeText={setDescription}
                    />
                </View>

                {/* 3. Contact Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Contato</Text>

                    <Text style={styles.label}>Email</Text>
                    <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

                    <Text style={styles.label}>Telefone</Text>
                    <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

                    <Text style={styles.label}>CPF/CNPJ</Text>
                    <TextInput style={styles.input} value={cpf} onChangeText={setCpf} keyboardType="numeric" />
                </View>

                {/* 4. Services and Cities */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Serviço e Atuação</Text>
                    <SearchableSelect
                        items={servicesList}
                        selectedValues={selectedServices}
                        onSelectionChange={setSelectedServices}
                        multiSelect={true}
                        placeholder="Selecione os serviços..."
                        title="Serviços"
                    />
                    <View style={{ height: 16 }} />
                    <SearchableSelect
                        items={citiesList}
                        selectedValues={selectedCities}
                        onSelectionChange={setSelectedCities}
                        multiSelect={true}
                        placeholder="Selecione as cidades..."
                        title="Cidades de Atuação"
                    />
                </View>

                {/* 5. Address Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Endereço</Text>

                    <Text style={styles.label}>CEP</Text>
                    <TextInput style={styles.input} value={zip} onChangeText={setZip} placeholder="00000-000" />

                    <Text style={styles.label}>Logradouro</Text>
                    <TextInput style={styles.input} value={street} onChangeText={setStreet} placeholder="Rua, Av..." />

                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.label}>Número</Text>
                            <TextInput style={styles.input} value={number} onChangeText={setNumber} placeholder="123" />
                        </View>
                        <View style={{ flex: 2 }}>
                            <Text style={styles.label}>Bairro</Text>
                            <TextInput style={styles.input} value={district} onChangeText={setDistrict} placeholder="Centro" />
                        </View>
                    </View>

                    <View style={{ marginTop: 12 }}>
                        <SearchableSelect
                            items={citiesList}
                            selectedValue={selectedCity!}
                            onSelectionChange={setSelectedCity}
                            placeholder="Selecione a cidade..."
                            title="Cidade"
                        />
                    </View>

                    <Text style={styles.label}>Estado (UF)</Text>
                    <TextInput style={styles.input} value={state} onChangeText={setState} placeholder="SP" maxLength={2} />
                </View>

                {/* 6. Portfolio Section (Last & Modernized) */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Portfólio</Text>
                        <TouchableOpacity onPress={() => pickImage('portfolio')}>
                            <Text style={styles.addLink}>+ Adicionar</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.sectionSubtitle}>Adicione fotos dos seus trabalhos realizados.</Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolioScroll}>
                        <TouchableOpacity style={styles.modernAddButton} onPress={() => pickImage('portfolio')}>
                            <View style={styles.modernAddIcon}>
                                <Plus size={24} color="#4F46E5" />
                            </View>
                            <Text style={styles.modernAddText}>Nova Foto</Text>
                        </TouchableOpacity>

                        {portfolioImages.map((uri, index) => (
                            <View key={index} style={styles.portfolioCard}>
                                <Image source={{ uri }} style={styles.modernPortfolioImage} />
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* Save Button */}

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <LogOut size={20} color="#EF4444" style={{ marginRight: 8 }} />
                    <Text style={styles.logoutText}>Sair da Conta</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    center: { justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 24, paddingBottom: 120 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },

    // Avatar
    profileSection: { alignItems: 'center', marginBottom: 32 },
    avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 8 },
    avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    avatarPlaceholderText: { fontSize: 10, color: '#6B7280', marginTop: 4, fontWeight: '500' },
    editIconBadge: { position: 'absolute', bottom: 8, right: 0, backgroundColor: '#4F46E5', borderRadius: 12, padding: 4, borderWidth: 2, borderColor: '#FFFFFF' },
    nameInput: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', minWidth: 200, textAlign: 'center' },
    userRole: { fontSize: 16, color: '#6B7280' },

    // Sections
    section: { marginBottom: 24, backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    sectionSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
    addLink: { fontSize: 14, color: '#4F46E5', fontWeight: '600' },

    // Inputs
    input: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 15, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB' },
    textArea: { height: 120, textAlignVertical: 'top' },
    label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6, marginTop: 12 },
    row: { flexDirection: 'row' },

    // Modern Portfolio
    portfolioScroll: { flexDirection: 'row', paddingVertical: 4 },
    modernAddButton: { width: 120, height: 160, backgroundColor: '#F3F4F6', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: '#D1D5DB' },
    modernAddIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    modernAddText: { fontSize: 14, fontWeight: '600', color: '#4F46E5' },
    portfolioCard: { width: 120, height: 160, borderRadius: 16, marginRight: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, backgroundColor: 'white' },
    modernPortfolioImage: { width: 120, height: 160, borderRadius: 16, resizeMode: 'cover', backgroundColor: '#E5E7EB' },

    // Save Button
    saveButton: { backgroundColor: '#4F46E5', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, alignItems: 'center', marginTop: 16, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, width: '100%', maxWidth: 300 },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    // Logout
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FEE2E2',
        marginTop: 16,
    },
    logoutText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
});
