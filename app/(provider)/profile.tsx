import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, LogOut, MessageCircle, Plus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchableSelect, SearchableSelectItem } from '../../components/SearchableSelect';
import { supabase } from '../../lib/supabase';
import { openWhatsAppSupport } from '../../lib/support';

import { fetchAddressByCep } from '../../lib/address';

export default function ProviderProfileScreen() {
    const router = useRouter();
    const [cepLoading, setCepLoading] = useState(false);


    // State for fields
    const [description, setDescription] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [portfolioImages, setPortfolioImages] = useState<string[]>([]);

    // Profile Data
    const [name, setName] = useState('');
    const [nomeFantasia, setNomeFantasia] = useState('');
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
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    useEffect(() => {
        fetchProfileData();
    }, []);

    useEffect(() => {
        const cleanedZip = zip.replace(/\D/g, '');
        if (cleanedZip.length === 8) {
            handleCepLookup(cleanedZip);
        }
    }, [zip]);

    async function handleCepLookup(cleanedZip: string) {
        try {
            setCepLoading(true);
            const address = await fetchAddressByCep(cleanedZip);
            if (address) {
                setStreet(address.logradouro || '');
                setDistrict(address.bairro || '');
                setState(address.uf || '');

                if (citiesList.length > 0) {
                    const cityMatch = citiesList.find(c =>
                        c.label.toLowerCase().includes(address.localidade.toLowerCase())
                    );
                    if (cityMatch) {
                        setSelectedCity(cityMatch.value as number);
                    }
                }
            }
        } catch (error) {
            console.error('CEP Lookup error:', error);
        } finally {
            setCepLoading(false);
        }
    }

    async function removePortfolioImage(index: number) {
        const newImages = [...portfolioImages];
        newImages.splice(index, 1);
        setPortfolioImages(newImages);
    }

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
                setNomeFantasia(providerData.nome_fantasia || '');
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
                setStreet(providerData.logradouro || '');
                setNumber(providerData.num_logradouro || '');
                setDistrict(providerData.bairro || '');
                setZip(providerData.cep ? String(providerData.cep) : '');
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

            try {
                const response = await fetch(uri);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result as string;
                    if (type === 'profile') {
                        setProfileImage(base64data);
                    } else {
                        setPortfolioImages([...portfolioImages, base64data]);
                    }
                };
                reader.readAsDataURL(blob);
            } catch (err) {
                console.error('Error converting image to base64:', err);
                // Fallback to URI if conversion fails (though it shouldn't)
                if (type === 'profile') {
                    setProfileImage(uri);
                } else {
                    setPortfolioImages([...portfolioImages, uri]);
                }
            }
        }
    };

    async function handleSave() {
        if (!currentUserId) {
            Alert.alert('Erro', 'Usuário não identificado. Por favor, faça login novamente.');
            return;
        }

        try {
            setSaving(true);
            const numUserId = Number(currentUserId);
            console.log('Iniciando salvamento completo do perfil para ID:', numUserId);

            // 1. Update Provider Basic Info & Address
            // CEP in DB is bigint, CPF/Phone are limited length strings
            const numericZip = zip ? parseInt(zip.replace(/\D/g, ''), 10) : null;
            const cleanedCpf = cpf ? cpf.replace(/\D/g, '').substring(0, 14) : '';
            const cleanedPhone = phone ? phone.replace(/\D/g, '').substring(0, 11) : '';
            const numCity = selectedCity ? Number(selectedCity) : null;

            console.log('Dados formatados para envio (prestador):', {
                nome: name,
                nome_fantasia: nomeFantasia,
                fone1: cleanedPhone,
                email: email,
                cpf_cnpj: cleanedCpf,
                id_cidade: numCity,
            });

            const { error: pError, count } = await supabase
                .from('prestador')
                .update({
                    nome: name,
                    nome_fantasia: nomeFantasia,
                    fone1: cleanedPhone,
                    email: email,
                    cpf_cnpj: cleanedCpf,
                    texto_meuperfil: (description || '').trim(),
                    logradouro: street,
                    num_logradouro: number || null,
                    bairro: district,
                    cep: numericZip,
                    id_cidade: numCity,
                    uf: state,
                }, { count: 'exact' })
                .eq('id_prestador', numUserId);

            if (pError) {
                console.error('Database Update Error:', pError);
                throw new Error(`Erro nos dados básicos: [${pError.code}] ${pError.message} `);
            }

            if (count === 0) {
                console.warn('Nenhum registro atualizado. ID do prestador não encontrado:', currentUserId);
                throw new Error('Nenhum dado foi alterado. Verifique se seu perfil existe ou tente logar novamente.');
            }

            console.log('Update de dados básicos realizado com sucesso! Linhas afetadas:', count);

            // 1.5. Update Login Info (CPF) in 'acesso' table
            const { error: aError } = await supabase
                .from('acesso')
                .update({ CPF: cleanedCpf })
                .eq('login', numUserId);

            if (aError) console.warn('Erro ao sincronizar CPF no acesso:', aError);

            // 2. Update Services (Always clear and re-insert if needed)
            await supabase.from('servico_prestador').delete().eq('id_prestador', numUserId);
            if (selectedServices.length > 0) {
                const serviceInserts = selectedServices.map(serviceId => ({
                    id_prestador: numUserId,
                    id_servico: Number(serviceId)
                }));
                const { error: sError } = await supabase.from('servico_prestador').insert(serviceInserts);
                if (sError) throw sError;
            }

            // 3. Update Cities of Operation (Always clear and re-insert if needed)
            await supabase.from('cidade_atuacao').delete().eq('id_prestador', numUserId);
            if (selectedCities.length > 0) {
                const cityInserts = selectedCities.map(cityId => ({
                    id_prestador: numUserId,
                    id_cidade: Number(cityId)
                }));
                const { error: cError = {} as any } = await supabase.from('cidade_atuacao').insert(cityInserts);
                if (cError && cError.message) throw cError;
            }

            // 4. Update Portfolio Images
            await supabase.from('imagem_portfolio').delete().eq('id_prestador', currentUserId);
            if (portfolioImages.length > 0) {
                const portfolioInserts = portfolioImages.map(imgUri => ({
                    id_imagem: Date.now() + Math.floor(Math.random() * 100000),
                    id_prestador: currentUserId,
                    imagem: imgUri,
                }));
                const { error: portfolioError } = await supabase.from('imagem_portfolio').insert(portfolioInserts);
                if (portfolioError) throw new Error(`Erro ao salvar portfólio: ${portfolioError.message} `);
            }

            // 5. Update Profile Image
            if (profileImage) {
                await supabase.from('imagem_perfil').delete().eq('id_usuario', currentUserId);
                const { error: imgError } = await supabase.from('imagem_perfil').insert({
                    id_usuario: currentUserId,
                    img: profileImage
                });
                if (imgError) throw new Error(`Erro ao salvar foto de perfil: ${imgError.message} `);
            }

            setShowSuccessModal(true);
        } catch (error: any) {
            console.error('Erro crítico no salvamento:', error);
            Alert.alert('Erro ao Salvar', error.message || 'Ocorreu um erro inesperado.');
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
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Image
                            source={require('../../assets/images/logo.png')}
                            style={{ width: 40, height: 40 }}
                            resizeMode="contain"
                        />
                        <Text style={[styles.headerTitle, { marginLeft: 8 }]}>ConsertJá - Meu Perfil</Text>
                    </View>
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
                    <Text style={styles.labelSmall}>Nome Completo</Text>
                    <TextInput
                        style={styles.nameInput}
                        value={name}
                        onChangeText={setName}
                        placeholder="Seu Nome"
                        textAlign="center"
                    />

                    <Text style={styles.labelSmall}>Nome Fantasia / Comercial</Text>
                    <TextInput
                        style={[styles.nameInput, { fontSize: 18, color: '#4F46E5' }]}
                        value={nomeFantasia}
                        onChangeText={setNomeFantasia}
                        placeholder="Ex: Refromas e Pinturas"
                        textAlign="center"
                    />

                    <Text style={styles.userRole}>{currentServiceLabel}</Text>

                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        <Text style={styles.saveButtonText}>
                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </Text>
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
                                <TouchableOpacity
                                    style={styles.removePortfolioButton}
                                    onPress={() => removePortfolioImage(index)}
                                >
                                    <X size={14} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* Save Button */}

                {/* Support Button */}
                <TouchableOpacity style={styles.supportButton} onPress={openWhatsAppSupport}>
                    <MessageCircle size={20} color="#4F46E5" style={{ marginRight: 8 }} />
                    <Text style={styles.supportButtonText}>Suporte via WhatsApp</Text>
                </TouchableOpacity>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <LogOut size={20} color="#EF4444" style={{ marginRight: 8 }} />
                    <Text style={styles.logoutText}>Sair da Conta</Text>
                </TouchableOpacity>


            </ScrollView>

            {/* Success Modal */}
            <Modal
                visible={showSuccessModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSuccessModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.successCard}>
                        <View style={styles.successIconContainer}>
                            <Text style={{ fontSize: 40 }}>🎉</Text>
                        </View>
                        <Text style={styles.successTitle}>Sucesso!</Text>
                        <Text style={styles.successMessage}>
                            Seus dados foram atualizados com sucesso!
                        </Text>
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setShowSuccessModal(false)}
                        >
                            <Text style={styles.modalButtonText}>Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    labelSmall: { fontSize: 12, color: '#9CA3AF', marginBottom: 2, marginTop: 8 },

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
    supportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EEF2FF',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#C7D2FE',
        marginTop: 16,
    },
    supportButtonText: { color: '#4F46E5', fontSize: 16, fontWeight: '600' },

    // Success Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    successCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10
    },
    successIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F0FDF4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20
    },
    successTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 12
    },
    successMessage: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24
    },
    modalButton: {
        backgroundColor: '#4F46E5',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center'
    },
    modalButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold'
    },
    removePortfolioButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4
    }
});
