import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, FileText, Mail, MapPin, Phone, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ResponsiveView } from '../components/ResponsiveView';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { SearchableSelect, SearchableSelectItem } from '../components/SearchableSelect';
import { Palette } from '../constants/theme';
import { supabase } from '../lib/supabase';

export default function SignupClientScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [cpf, setCpf] = useState('');

    // Address State
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [district, setDistrict] = useState('');
    const [zip, setZip] = useState('');
    const [state, setState] = useState('');

    // Dynamic Data State
    const [cities, setCities] = useState<SearchableSelectItem[]>([]);
    const [selectedCity, setSelectedCity] = useState<number | string | null>(null);

    // Password for Auth
    const [password, setPassword] = useState('');

    useEffect(() => {
        fetchCities();
    }, []);

    async function fetchCities() {
        try {
            const { data, error } = await supabase
                .from('cidade')
                .select('id, descricao');

            if (error) throw error;

            if (data) {
                setCities(data.map((c: any) => ({
                    label: c.descricao,
                    value: c.id
                })));
            }
        } catch (error) {
            console.error('Error fetching cities:', error);
        }
    }

    async function handleSignup() {
        if (!email || !password || !name) {
            Alert.alert('Erro', 'Por favor preencha os campos obrigatórios.');
            return;
        }

        // 0. Verify CPF Uniqueness
        setLoading(true);

        const { data: existingAcesso, error: cpfCheckError } = await supabase
            .from('acesso')
            .select('login')
            .eq('CPF', cpf)
            .maybeSingle();

        if (cpfCheckError) {
            console.error('Error checking CPF:', cpfCheckError);
            Alert.alert('Erro', 'Falha ao verificar CPF.');
            setLoading(false);
            return;
        }

        if (existingAcesso) {
            Alert.alert('Erro', 'CPF já cadastrado no sistema.');
            setLoading(false);
            return;
        }

        const { data: acessoData, error: acessoError } = await supabase
            .from('acesso')
            .insert({
                CPF: cpf,
                senha: password,
                tipo_login: 'cliente'
            })
            .select('login')
            .single();

        if (acessoError) {
            Alert.alert('Erro no cadastro (Acesso)', acessoError.message);
            setLoading(false);
            return;
        }

        if (!acessoData || !acessoData.login) {
            Alert.alert('Erro', 'Falha ao gerar ID de login.');
            setLoading(false);
            return;
        }

        const newLoginId = acessoData.login;

        const { error: dbError } = await supabase
            .from('cliente')
            .insert({
                id_cliente: newLoginId,
                nome: name,
                cpf_cnpj: cpf,
                fone1: phone,
                email: email,
                logradouro: street,
                num_logradouro: number,
                bairro: district,
                cep: zip,
                id_cidade: selectedCity,
            });

        if (dbError) {
            console.warn('DB Insert Error:', dbError);
            Alert.alert('Cadastro realizado!', `Usuário criado, mas houve um erro ao salvar dados do cliente: ${dbError.message}`);
        } else {
            await AsyncStorage.setItem('user_id', String(newLoginId));
            await AsyncStorage.setItem('user_type', 'cliente');

            Alert.alert('Sucesso!', 'Cadastro realizado com sucesso.');
            router.replace('/(client)/home');
        }

        setLoading(false);
    }

    const renderLeftPanel = () => (
        <View style={styles.leftPanel}>
            <View style={styles.leftPanelContent}>
                <Text style={styles.leftTitle}>Junte-se a nós!</Text>
                <Text style={styles.leftSubtitle}>
                    Encontre os melhores serviços para o seu dia a dia.
                </Text>

                <View style={styles.featureList}>
                    <View style={styles.featureItem}>
                        <CheckCircle color="#A5B4FC" size={24} />
                        <Text style={styles.featureText}>Cadastro rápido e fácil</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <CheckCircle color="#A5B4FC" size={24} />
                        <Text style={styles.featureText}>Acesso a diversos profissionais</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <CheckCircle color="#A5B4FC" size={24} />
                        <Text style={styles.featureText}>Avaliações da comunidade</Text>
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

                        <Text style={styles.headerTitle}>Cadastro de Cliente</Text>
                        <Text style={styles.headerSubtitle}>Cadastre-se para encontrar os melhores profissionais.</Text>

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
                                    placeholder="Celular"
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
                                    placeholder="Selecione a cidade..."
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
        backgroundColor: Palette.success, // Different color for client signup? Or keep primary.
        // Let's use primary for consistency, or success as client uses green in modal.
        // Modal used #F0FDF4/Green. Let's stick to Primary Blue for consistency or maybe Green.
        // Palette.success is Green.
        // Let's use darker green for background if we want to follow suit, or just Primary.
        // The modal icon background was F0FDF4 (light green).
        // Let's use Palette.primary for a unified branding execution.
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
        color: '#E0E7FF', // Light blueish white
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
        backgroundColor: 'rgba(255,255,255,0.1)',
        zIndex: 1,
    },
});
