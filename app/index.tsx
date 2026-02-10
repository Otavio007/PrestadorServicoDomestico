import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { Briefcase, CheckCircle, Eye, EyeOff, FileText, Home, Lock, Mail, User, UserCircle, X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ResponsiveView } from '../components/ResponsiveView';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Palette } from '../constants/theme';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
    const router = useRouter();
    const [cpf, setCpf] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [signupModalVisible, setSignupModalVisible] = useState(false);

    // Forgot Password State
    const [forgotPasswordModalVisible, setForgotPasswordModalVisible] = useState(false);
    const [forgotCpf, setForgotCpf] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotMessage, setForgotMessage] = useState<string | null>(null);
    const [forgotMessageType, setForgotMessageType] = useState<'success' | 'error'>('error');

    async function handleLogin() {
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('acesso')
                .select('*')
                .eq('CPF', cpf)
                .eq('senha', password)
                .single();
            console.log('Data returned:', data);

            if (error) {
                if (error.code === 'PGRST116') {
                    setLoginError('CPF ou Senha incorretos. Por favor, verifique seus dados.');
                } else {
                    console.error('Supabase Error:', error);
                    setLoginError(`Erro ao tentar entrar: ${error.message}`);
                }
                setLoading(false);
                return;
            }

            if (!data) {
                setLoginError('Usuário não encontrado.');
                setLoading(false);
                return;
            }

            setLoginError(null);

            const userType = data.tipo_login?.toLowerCase();

            if (userType === 'prestador' || userType === 'prestador de serviço') {
                if (data.login) {
                    await AsyncStorage.setItem('user_id', String(data.login));
                    await AsyncStorage.setItem('user_type', 'prestador');
                }
                router.replace('/(provider)/profile');
            } else if (userType === 'cliente' || userType === 'client') {
                if (data.login) {
                    await AsyncStorage.setItem('user_id', String(data.login));
                    await AsyncStorage.setItem('user_type', 'cliente');
                }
                router.replace('/(client)/home');
            } else {
                alert(`Tipo de usuário desconhecido: ${userType}`);
            }

        } catch (err) {
            console.error(err);
            alert('Ocorreu um erro inesperado ao tentar logar.');
        } finally {
            setLoading(false);
        }
    }

    async function handleForgotPassword() {
        if (!forgotCpf) {
            setForgotMessage('Por favor, informe o CPF.');
            setForgotMessageType('error');
            return;
        }

        setForgotLoading(true);
        setForgotMessage(null);

        try {
            const rawCpf = forgotCpf.trim();
            const digitsOnlyCpf = rawCpf.replace(/\D/g, '');

            // 1. Get login info from access table
            // Try raw input first
            let { data: accessData, error: accessError } = await supabase
                .from('acesso')
                .select('login, tipo_login, senha')
                .eq('CPF', rawCpf)
                .maybeSingle();

            // If not found and input had special chars, try digits only 
            if (!accessData && !accessError && rawCpf !== digitsOnlyCpf) {
                const retry = await supabase
                    .from('acesso')
                    .select('login, tipo_login, senha')
                    .eq('CPF', digitsOnlyCpf)
                    .maybeSingle();
                accessData = retry.data;
                accessError = retry.error;
            }

            if (accessError) throw accessError;

            if (!accessData) {
                setForgotMessage('CPF não cadastrado no sistema.');
                setForgotMessageType('error');
                return;
            }

            // 2. Based on type, get the email and name from 'prestador' or 'cliente'
            let email = '';
            let userName = 'Usuário';
            const userType = accessData.tipo_login?.toLowerCase();

            if (userType === 'prestador' || userType === 'prestador de serviço') {
                const { data: providerData, error: pError } = await supabase
                    .from('prestador')
                    .select('email, nome')
                    .eq('id_prestador', accessData.login)
                    .maybeSingle();
                if (pError) throw pError;
                if (providerData) {
                    email = providerData.email;
                    userName = providerData.nome;
                }
            } else {
                const { data: clientData, error: cError } = await supabase
                    .from('cliente')
                    .select('email, nome')
                    .eq('id_cliente', accessData.login)
                    .maybeSingle();
                if (cError) throw cError;
                if (clientData) {
                    email = clientData.email;
                    userName = clientData.nome;
                }
            }

            if (!email) {
                setForgotMessage('Email não encontrado para este CPF.');
                setForgotMessageType('error');
                return;
            }

            // 3. Send real email via EmailJS REST API
            const emailJsData = {
                service_id: 'service_gf46398',
                template_id: 'template_lobpc49',
                user_id: '85bD8KodVoekKXr3Z',
                template_params: {
                    user_name: userName,
                    user_email: email,
                    password: accessData.senha
                }
            };

            await axios.post('https://api.emailjs.com/api/v1.0/email/send', emailJsData);

            // Masking email for security in UI
            const [emailUser, domain] = email.split('@');
            const maskedEmail = domain
                ? `${emailUser.substring(0, 2)}***${emailUser.substring(emailUser.length - 1)}@${domain}`
                : `${emailUser.substring(0, 2)}***`;

            setForgotMessage(`Sua senha foi enviada para o e-mail: ${maskedEmail}`);
            setForgotMessageType('success');

        } catch (err: any) {
            console.error('Forgot Password Error:', err);
            const errorMsg = err.message || (typeof err === 'string' ? err : JSON.stringify(err));
            setForgotMessage(`Erro: ${errorMsg}`);
            setForgotMessageType('error');
        } finally {
            setForgotLoading(false);
        }
    }

    const renderLeftPanel = () => (
        <View style={styles.leftPanel}>
            <View style={styles.leftPanelContent}>
                <View style={styles.logoBadge}>
                    <Home color="white" size={40} />
                </View>
                <Text style={styles.leftTitle}>Transforme sua Casa</Text>
                <Text style={styles.leftSubtitle}>
                    Conectamos você aos melhores profissionais para reformas e reparos.
                </Text>

                <View style={styles.featureList}>
                    <View style={styles.featureItem}>
                        <CheckCircle color="#A5B4FC" size={24} style={styles.featureIcon} />
                        <Text style={styles.featureText}>Profissionais verificados</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <CheckCircle color="#A5B4FC" size={24} style={styles.featureIcon} />
                        <Text style={styles.featureText}>Orçamentos rápidos</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <CheckCircle color="#A5B4FC" size={24} style={styles.featureIcon} />
                        <Text style={styles.featureText}>Segurança garantida</Text>
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
                leftRatio={0.45}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                >
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.header}>
                            <View style={styles.logoContainer}>
                                <UserCircle size={60} color={Palette.primary} />
                            </View>
                            <Text style={styles.title}>Bem-vindo de volta!</Text>
                            <Text style={styles.subtitle}>Acesse sua conta para continuar</Text>
                        </View>

                        <View style={styles.form}>
                            <View style={styles.inputContainer}>
                                <Mail color={Palette.textSecondary} size={20} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="CPF"
                                    placeholderTextColor={Palette.textPlaceholder}
                                    value={cpf}
                                    onChangeText={setCpf}
                                    autoCapitalize="none"
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Lock color={Palette.textSecondary} size={20} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Senha"
                                    placeholderTextColor={Palette.textPlaceholder}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeIcon}
                                >
                                    {showPassword ? (
                                        <EyeOff color={Palette.textSecondary} size={20} />
                                    ) : (
                                        <Eye color={Palette.textSecondary} size={20} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {loginError && (
                                <View style={styles.errorContainer}>
                                    <Text style={styles.errorText}>{loginError}</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.forgotPassword}
                                onPress={() => {
                                    setForgotMessage(null);
                                    setForgotCpf('');
                                    setForgotPasswordModalVisible(true);
                                }}
                            >
                                <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                <Text style={styles.loginButtonText}>{loading ? 'Carregando...' : 'Entrar'}</Text>
                            </TouchableOpacity>

                            <View style={styles.dividerContainer}>
                                <View style={styles.divider} />
                                <Text style={styles.dividerText}>OU</Text>
                                <View style={styles.divider} />
                            </View>

                            <TouchableOpacity
                                style={styles.signupButton}
                                onPress={() => setSignupModalVisible(true)}
                            >
                                <Text style={styles.signupButtonText}>Criar nova conta</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* Signup Type Selection Modal */}
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={signupModalVisible}
                    onRequestClose={() => setSignupModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Criar conta como:</Text>
                                <TouchableOpacity onPress={() => setSignupModalVisible(false)}>
                                    <X color={Palette.text} size={24} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.optionButton}
                                onPress={() => {
                                    setSignupModalVisible(false);
                                    router.push('/signup-prestador');
                                }}
                            >
                                <View style={[styles.optionIcon, { backgroundColor: '#EEF2FF' }]}>
                                    <Briefcase color={Palette.primary} size={24} />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Prestador de Serviço</Text>
                                    <Text style={styles.optionDescription}>Quero oferecer meus serviços.</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.optionButton}
                                onPress={() => {
                                    setSignupModalVisible(false);
                                    router.push('/signup-client');
                                }}
                            >
                                <View style={[styles.optionIcon, { backgroundColor: Palette.successBackground }]}>
                                    <User color={Palette.success} size={24} />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>Cliente</Text>
                                    <Text style={styles.optionDescription}>Estou buscando profissionais.</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Forgot Password Modal */}
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={forgotPasswordModalVisible}
                    onRequestClose={() => setForgotPasswordModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Recuperar Senha</Text>
                                <TouchableOpacity onPress={() => setForgotPasswordModalVisible(false)}>
                                    <X color={Palette.text} size={24} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.modalSubtitle}>
                                Digite seu CPF para receber sua senha por e-mail.
                            </Text>

                            <View style={styles.modalForm}>
                                <View style={[styles.inputContainer, { backgroundColor: Palette.background }]}>
                                    <FileText color={Palette.textSecondary} size={20} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="CPF"
                                        placeholderTextColor={Palette.textPlaceholder}
                                        value={forgotCpf}
                                        onChangeText={setForgotCpf}
                                        keyboardType="numeric"
                                    />
                                </View>

                                {forgotMessage && (
                                    <View style={[
                                        styles.errorContainer,
                                        forgotMessageType === 'success' && { backgroundColor: Palette.successBackground, borderColor: Palette.success }
                                    ]}>
                                        <Text style={[
                                            styles.errorText,
                                            forgotMessageType === 'success' && { color: Palette.success }
                                        ]}>
                                            {forgotMessage}
                                        </Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={[styles.loginButton, forgotLoading && styles.loginButtonDisabled]}
                                    onPress={handleForgotPassword}
                                    disabled={forgotLoading}
                                >
                                    <Text style={styles.loginButtonText}>
                                        {forgotLoading ? 'Consultando...' : 'Recuperar Senha'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </ResponsiveView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    screenContainer: {
        height: '100%', // Ensure full height usage
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
        backgroundColor: Palette.surface,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 32,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoContainer: {
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#EEF2FF',
        borderRadius: 50,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: Palette.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: Palette.textSecondary,
        textAlign: 'center',
    },
    form: {
        width: '100%',
        maxWidth: 400, // Limit form width on wide screens
        alignSelf: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Palette.background,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 12,
        height: 54,
    },
    inputIcon: {
        marginRight: 10,
    },
    eyeIcon: {
        padding: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: Palette.text,
        height: '100%',
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 24,
    },
    forgotPasswordText: {
        color: Palette.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    loginButton: {
        backgroundColor: Palette.primary,
        borderRadius: 12,
        height: 54,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: Palette.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: Palette.border,
    },
    dividerText: {
        marginHorizontal: 16,
        color: Palette.textSecondary,
        fontWeight: '600',
        fontSize: 14,
    },
    signupButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: Palette.primary,
        borderRadius: 12,
        height: 54,
        justifyContent: 'center',
        alignItems: 'center',
    },
    signupButtonText: {
        color: Palette.primary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    errorContainer: {
        backgroundColor: Palette.errorBackground,
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    errorText: {
        color: Palette.error,
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
    },

    // Left Panel Styles
    leftPanel: {
        flex: 1,
        backgroundColor: Palette.primary,
        padding: 40,
        justifyContent: 'center',
        position: 'relative',
    },
    leftPanelContent: {
        zIndex: 2,
    },
    logoBadge: {
        width: 80,
        height: 80,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    leftTitle: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 16,
        lineHeight: 48,
    },
    leftSubtitle: {
        fontSize: 18,
        color: '#E0E7FF',
        marginBottom: 48,
        lineHeight: 28,
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
    featureIcon: {
        opacity: 0.9,
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

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: Palette.surface,
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Palette.text,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Palette.background,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 16,
        marginBottom: 12,
    },
    optionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Palette.text,
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 13,
        color: Palette.textSecondary,
    },
    modalSubtitle: {
        fontSize: 14,
        color: Palette.textSecondary,
        marginBottom: 20,
        textAlign: 'center',
    },
    modalForm: {
        width: '100%',
    },
});
