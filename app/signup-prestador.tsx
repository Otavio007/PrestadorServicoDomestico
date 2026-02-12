import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ArrowLeft, Briefcase, Calendar, FileText, Mail, MapPin, Phone, Shield, TrendingUp, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ResponsiveView } from '../components/ResponsiveView';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { SearchableSelect, SearchableSelectItem } from '../components/SearchableSelect';
import { Palette } from '../constants/theme';
import { supabase } from '../lib/supabase';

import { fetchAddressByCep } from '../lib/address';

export default function SignupPrestadorScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [cepLoading, setCepLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [cpf, setCpf] = useState('');

    // Dynamic Data State
    const [services, setServices] = useState<SearchableSelectItem[]>([]);
    const [cities, setCities] = useState<SearchableSelectItem[]>([]);

    // Selections
    const [selectedServices, setSelectedServices] = useState<(number | string)[]>([]);
    const [selectedCities, setSelectedCities] = useState<(number | string)[]>([]); // Array of City IDs
    const [selectedCity, setSelectedCity] = useState<number | string | null>(null);

    // Address State
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [district, setDistrict] = useState('');
    const [zip, setZip] = useState('');
    const [state, setState] = useState('');

    // Password for Auth
    const [password, setPassword] = useState('');

    useEffect(() => {
        fetchData();
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

                // Fetch cities if not loaded yet or just match
                if (cities.length > 0) {
                    const cityMatch = cities.find(c =>
                        c.label.toLowerCase().includes(address.localidade.toLowerCase())
                    );
                    if (cityMatch) {
                        setSelectedCity(cityMatch.value);
                    }
                }
            }
        } catch (error) {
            console.error('CEP Lookup error:', error);
        } finally {
            setCepLoading(false);
        }
    }

    async function fetchData() {
        try {
            // Fetch Services
            const { data: servicesData, error: servicesError } = await supabase
                .from('servico')
                .select('id_servico, nome');

            if (servicesError) throw servicesError;

            if (servicesData) {
                setServices(servicesData.map((s: any) => ({
                    label: s.nome,
                    value: s.id_servico
                })));
            }

            // Fetch Cities
            const { data: citiesData, error: citiesError } = await supabase
                .from('cidade')
                .select('id, descricao');

            if (citiesError) throw citiesError;

            if (citiesData) {
                setCities(citiesData.map((c: any) => ({
                    label: c.descricao,
                    value: c.id
                })));
            }

        } catch (error: any) {
            console.error('Error fetching data:', error);
            // Alert.alert('Erro', 'Falha ao carregar serviços e cidades.');
        }
    }

    async function handleSignup() {
        if (!email || !password || !name || !cpf || selectedServices.length === 0) {
            Alert.alert('Erro', 'Por favor preencha os campos obrigatórios e selecione pelo menos um serviço.');
            return;
        }

        setLoading(true);

        try {
            // 0. Verify CPF Uniqueness
            const { data: existingAcesso, error: cpfCheckError } = await supabase
                .from('acesso')
                .select('login')
                .eq('CPF', cpf)
                .maybeSingle();

            if (cpfCheckError) {
                console.error('Error checking CPF:', cpfCheckError);
                throw new Error('Falha ao verificar CPF.');
            }

            if (existingAcesso) {
                throw new Error('CPF já cadastrado no sistema.');
            }

            // 1. Insert into 'acesso' table and get Login ID
            const { data: acessoData, error: acessoError } = await supabase
                .from('acesso')
                .insert({
                    CPF: cpf,
                    senha: password,
                    tipo_login: 'prestador'
                })
                .select('login')
                .single();

            if (acessoError) throw new Error(`Erro no acesso: ${acessoError.message} `);
            if (!acessoData?.login) throw new Error('Falha ao gerar ID de login.');

            const loginId = acessoData.login;

            // 2. Insert into 'prestador' table
            const { error: prestadorError } = await supabase
                .from('prestador')
                .insert({
                    id_prestador: loginId,
                    nome: name,
                    cpf_cnpj: cpf,
                    fone1: phone,
                    email: email,
                    logradouro: street,
                    num_logradouro: number,
                    bairro: district,
                    cep: zip,
                    id_cidade: selectedCity ? Number(selectedCity) : null,
                });

            if (prestadorError) throw new Error(`Erro no prestador: ${prestadorError.message} `);

            // 3. Insert into 'servico_prestador' table
            if (selectedServices.length > 0) {
                const serviceInserts = selectedServices.map(serviceId => ({
                    id_prestador: loginId,
                    id_servico: Number(serviceId)
                }));

                const { error: servicoError } = await supabase
                    .from('servico_prestador')
                    .insert(serviceInserts);

                if (servicoError) throw new Error(`Erro ao vincular serviços: ${servicoError.message} `);
            }

            // 4. Insert Selected Cities into 'cidade_atuacao'
            if (selectedCities.length > 0) {
                const cityInserts = selectedCities.map(cityId => ({
                    id_prestador: loginId,
                    id_cidade: Number(cityId)
                }));

                const { error: cityError } = await supabase
                    .from('cidade_atuacao')
                    .insert(cityInserts);

                if (cityError) throw new Error(`Erro ao vincular cidades de atuação: ${cityError.message} `);
            }

            // Save session ID for auto-login behavior
            await AsyncStorage.setItem('user_id', String(loginId));
            await AsyncStorage.setItem('user_type', 'prestador');

            Alert.alert('Sucesso!', 'Cadastro realizado com sucesso.');
            router.replace('/(provider)/profile');

        } catch (error: any) {
            Alert.alert('Erro no cadastro', error.message);
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const renderLeftPanel = () => (
        <View style={styles.leftPanel}>
            <View style={styles.leftPanelContent}>
                <Text style={styles.leftTitle}>Seja um Parceiro</Text>
                <Text style={styles.leftSubtitle}>
                    Expandia seu negócio e encontre novos clientes todos os dias.
                </Text>

                <View style={styles.featureList}>
                    <View style={styles.featureItem}>
                        <TrendingUp color="#A5B4FC" size={24} />
                        <Text style={styles.featureText}>Aumente sua renda</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Calendar color="#A5B4FC" size={24} />
                        <Text style={styles.featureText}>Gerencie sua agenda</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Shield color="#A5B4FC" size={24} />
                        <Text style={styles.featureText}>Pagamento seguro</Text>
                    </View>
                </View>
            </View>
            <View style={styles.decorativeCircle} />
        </View>
    );

    return (
        <ScreenWrapper contentContainerStyle={styles.screenContainer}>
            <ResponsiveView
                leftComponent={renderLeftPanel()}
                style={styles.responsiveContainer}
                leftRatio={0.4}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                >
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <ArrowLeft color={Palette.text} size={24} />
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Image
                                source={require('../assets/images/logo.png')}
                                style={{ width: 40, height: 40 }}
                                resizeMode="contain"
                            />
                            <Text style={[styles.headerTitle, { marginBottom: 0, marginLeft: 8 }]}>ConcertJá - Prestador</Text>
                        </View>
                        <Text style={styles.headerSubtitle}>Junte-se a nós e ofereça seus serviços.</Text>

                        {/* Dados Pessoais */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Dados Pessoais</Text>

                            <View style={styles.inputGroup}>
                                <View style={styles.inputIconContainer}>
                                    <User color={Palette.icon} size={20} />
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Nome Completo"
                                    value={name}
                                    onChangeText={setName}
                                    placeholderTextColor={Palette.textPlaceholder}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.inputIconContainer}>
                                    <Mail color={Palette.icon} size={20} />
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    placeholderTextColor={Palette.textPlaceholder}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.inputIconContainer}>
                                    <Phone color={Palette.icon} size={20} />
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Telefone"
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                    placeholderTextColor={Palette.textPlaceholder}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.inputIconContainer}>
                                    <FileText color={Palette.icon} size={20} />
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="CPF"
                                    value={cpf}
                                    onChangeText={setCpf}
                                    keyboardType="numeric"
                                    placeholderTextColor={Palette.textPlaceholder}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.inputIconContainer}>
                                    <FileText color={Palette.icon} size={20} />
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Senha"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    placeholderTextColor={Palette.textPlaceholder}
                                />
                            </View>
                        </View>

                        {/* Serviços */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Serviço e Atuação</Text>

                            <View style={{ marginBottom: 12 }}>
                                <SearchableSelect
                                    title="Selecione os Serviços"
                                    placeholder="Selecione um ou mais serviços..."
                                    items={services}
                                    selectedValues={selectedServices}
                                    onSelectionChange={setSelectedServices}
                                    multiSelect={true}
                                    icon={<Briefcase color={Palette.icon} size={20} />}
                                />
                            </View>

                            <View>
                                <SearchableSelect
                                    title="Cidades de Atuação"
                                    placeholder="Selecione as cidades..."
                                    items={cities}
                                    selectedValues={selectedCities}
                                    onSelectionChange={setSelectedCities}
                                    multiSelect={true}
                                    icon={<MapPin color={Palette.icon} size={20} />}
                                />
                            </View>
                        </View>

                        {/* Endereço */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Endereço Completo</Text>

                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={[styles.input, styles.inputNoIcon]}
                                    placeholder="CEP"
                                    value={zip}
                                    onChangeText={setZip}
                                    keyboardType="numeric"
                                    placeholderTextColor={Palette.textPlaceholder}
                                />
                            </View>
                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 2, marginRight: 10 }]}>
                                    <TextInput
                                        style={[styles.input, styles.inputNoIcon]}
                                        placeholder="Rua"
                                        value={street}
                                        onChangeText={setStreet}
                                        placeholderTextColor={Palette.textPlaceholder}
                                    />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <TextInput
                                        style={[styles.input, styles.inputNoIcon]}
                                        placeholder="Nº"
                                        value={number}
                                        onChangeText={setNumber}
                                        placeholderTextColor={Palette.textPlaceholder}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={[styles.input, styles.inputNoIcon]}
                                    placeholder="Bairro"
                                    value={district}
                                    onChangeText={setDistrict}
                                    placeholderTextColor={Palette.textPlaceholder}
                                />
                            </View>

                            <View style={{ marginBottom: 10 }}>
                                <SearchableSelect
                                    title="Cidade"
                                    placeholder="Selecione a cidade de residência..."
                                    items={cities}
                                    selectedValue={selectedCity!}
                                    onSelectionChange={setSelectedCity}
                                    multiSelect={false}
                                    icon={<MapPin color={Palette.icon} size={20} />}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={[styles.input, styles.inputNoIcon]}
                                    placeholder="Estado (UF)"
                                    value={state}
                                    onChangeText={setState}
                                    placeholderTextColor={Palette.textPlaceholder}
                                />
                            </View>
                        </View>

                        <TouchableOpacity style={styles.submitButton} onPress={handleSignup} disabled={loading}>
                            <Text style={styles.submitButtonText}>{loading ? 'Cadastrando...' : 'Finalizar Cadastro'}</Text>
                        </TouchableOpacity>

                    </ScrollView>
                </KeyboardAvoidingView>
            </ResponsiveView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    screenContainer: {
        height: '100%',
    },
    responsiveContainer: {
        backgroundColor: Palette.surface,
        borderRadius: Platform.OS === 'web' ? 24 : 0,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
        marginVertical: Platform.OS === 'web' ? 40 : 0,
        minHeight: Platform.OS === 'web' ? 600 : '100%',
    },
    keyboardView: {
        flex: 1,
        backgroundColor: Palette.background,
    },
    scrollContent: {
        padding: 32,
        paddingBottom: 40,
    },
    backButton: {
        marginBottom: 20,
        alignSelf: 'flex-start',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Palette.text,
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 16,
        color: Palette.textSecondary,
        marginBottom: 32,
    },
    section: {
        marginBottom: 24,
        backgroundColor: Palette.surface,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Palette.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Palette.text,
        marginBottom: 16,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Palette.background, // Light gray for input bg
        borderRadius: 12,
        marginBottom: 12,
        paddingHorizontal: 12,
        height: 50,
        borderWidth: 1,
        borderColor: Palette.border,
    },
    inputIconContainer: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: Palette.text,
        height: '100%',
    },
    inputNoIcon: {
        paddingLeft: 4
    },
    row: {
        flexDirection: 'row',
    },
    submitButton: {
        backgroundColor: Palette.primary,
        borderRadius: 12,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        shadowColor: Palette.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },

    // Left Panel Styles
    leftPanel: {
        flex: 1,
        backgroundColor: Palette.secondary,
        padding: 40,
        justifyContent: 'center',
        position: 'relative',
    },
    leftPanelContent: {
        zIndex: 2,
    },
    leftTitle: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 16,
    },
    leftSubtitle: {
        fontSize: 18,
        color: '#E5E7EB', // Gray-200
        marginBottom: 48,
        maxWidth: '80%',
    },
    featureList: {
        gap: 24,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    featureText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
    },
    decorativeCircle: {
        position: 'absolute',
        bottom: -100,
        right: -100,
        width: 400,
        height: 400,
        borderRadius: 200,
        backgroundColor: 'rgba(255,255,255,0.05)',
        zIndex: 1,
    },
});
