import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MapPin, MessageCircle, Star, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

interface ProviderDetails {
    id: string;
    name: string;
    email: string;
    phone: string;
    about: string;
    avatar: string;
    services: string[];
    cities: string[];
    portfolio: string[];
    rating: number;
    reviewCount: number;
    reviews: {
        id: string;
        clientName: string;
        rating: number;
        comment: string;
        date: string;
    }[];
}

export default function ProviderDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [provider, setProvider] = useState<ProviderDetails | null>(null);

    // Review Modal State
    const [currentClientId, setCurrentClientId] = useState<string | null>(null);
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    const [clientName, setClientName] = useState<string | null>(null);

    useEffect(() => {
        loadSession();
        if (id) {
            fetchProviderDetails();
        }
    }, [id]);

    async function loadSession() {
        try {
            const userId = await AsyncStorage.getItem('user_id');
            if (userId) {
                setCurrentClientId(userId);
                // Fetch client name for quote message
                const { data } = await supabase.from('cliente').select('nome').eq('id_cliente', userId).single();
                if (data) setClientName(data.nome);
            }
        } catch (err) {
            console.error('Error loading session:', err);
        }
    }

    async function fetchProviderDetails() {
        try {
            setLoading(true);

            // 1. Fetch basic info
            const { data: pData, error: pError } = await supabase
                .from('prestador')
                .select('*')
                .eq('id_prestador', id)
                .single();

            if (pError || !pData) throw pError;

            // 2. Fetch services
            const { data: sRelData } = await supabase
                .from('servico_prestador')
                .select('id_servico')
                .eq('id_prestador', id);

            let serviceNames: string[] = [];
            if (sRelData && sRelData.length > 0) {
                const serviceIds = sRelData.map(s => s.id_servico);
                const { data: sData } = await supabase
                    .from('servico')
                    .select('nome')
                    .in('id_servico', serviceIds);
                if (sData) serviceNames = sData.map(s => s.nome);
            }

            // 3. Fetch cities of operation (Atendimento)
            // As requested: find id_cidade from cidade_atuacao and then descriptions from cidade
            const { data: cRelData } = await supabase
                .from('cidade_atuacao')
                .select('id_cidade')
                .eq('id_prestador', id);

            let cityNames: string[] = [];
            if (cRelData && cRelData.length > 0) {
                const cityIds = cRelData.map(c => c.id_cidade);
                const { data: cData } = await supabase
                    .from('cidade')
                    .select('descricao')
                    .in('id', cityIds);
                if (cData) cityNames = cData.map(c => c.descricao);
            }

            // 4. Fetch Rating from View
            const { data: notaData } = await supabase
                .from('media_notas_prestador')
                .select('media_nota')
                .eq('id_prestador', id)
                .maybeSingle();

            // 5. Fetch Actual Reviews
            const { data: rData } = await supabase
                .from('avaliacao')
                .select('*')
                .eq('id_prestador', id)
                .order('data_avalicao', { ascending: false })
                .limit(5);

            let reviewsFormatted: any[] = [];
            if (rData && rData.length > 0) {
                // Get unique client IDs from reviews
                const clientIds = [...new Set(rData.map(r => r.id_cliente))];

                // Fetch client names in batch
                const { data: clientsData } = await supabase
                    .from('cliente')
                    .select('id_cliente, nome')
                    .in('id_cliente', clientIds);

                const clientMap = (clientsData || []).reduce((acc: any, curr: any) => {
                    acc[curr.id_cliente] = curr.nome;
                    return acc;
                }, {});

                reviewsFormatted = rData.map(r => ({
                    id: `${r.id_prestador}-${r.id_cliente}`,
                    clientName: clientMap[r.id_cliente] || 'Cliente',
                    rating: r.nota,
                    comment: r.descricao,
                    date: r.data_avalicao ? new Date(r.data_avalicao).toLocaleDateString('pt-BR') : 'Recent',
                }));
            }

            // 6. Fetch Portfolio Images
            const { data: portfolioData } = await supabase
                .from('imagem_portfolio')
                .select('imagem')
                .eq('id_prestador', id);

            const portfolioImages = portfolioData ? portfolioData.map(img => img.imagem) : [];

            // 7. Fetch Profile Image
            const { data: profileImgData } = await supabase
                .from('imagem_perfil')
                .select('img')
                .eq('id_usuario', id)
                .maybeSingle();

            setProvider({
                id: pData.id_prestador.toString(),
                name: pData.nome,
                email: pData.email,
                phone: pData.fone1,
                about: pData.texto_meuperfil || 'Este profissional ainda não adicionou uma descrição ao seu perfil.',
                avatar: profileImgData?.img || `https://ui-avatars.com/api/?name=${pData.nome}&background=4F46E5&color=fff&size=200`,
                services: serviceNames,
                cities: cityNames,
                portfolio: portfolioImages,
                rating: notaData?.media_nota || 0,
                reviewCount: reviewsFormatted.length,
                reviews: reviewsFormatted
            });

        } catch (err) {
            console.error('Error fetching provider:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmitReview() {
        if (!currentClientId) {
            Alert.alert('Erro', 'Você precisa estar logado como cliente para avaliar.');
            return;
        }
        if (!reviewComment.trim()) {
            Alert.alert('Erro', 'Por favor, escreva um comentário.');
            return;
        }

        try {
            setSubmittingReview(true);
            const { error } = await supabase
                .from('avaliacao')
                .insert({
                    id_prestador: id,
                    id_cliente: currentClientId,
                    nota: reviewRating,
                    descricao: reviewComment
                });

            if (error) throw error;

            Alert.alert('Sucesso', 'Sua avaliação foi enviada!');
            setReviewModalVisible(false);
            setReviewComment('');
            setReviewRating(5);
            fetchProviderDetails(); // Refresh data
        } catch (err) {
            console.error('Error submitting review:', err);
            Alert.alert('Erro', 'Não foi possível enviar sua avaliação. Verifique se você já avaliou este profissional.');
        } finally {
            setSubmittingReview(false);
        }
    }


    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.loadingText}>Carregando perfil...</Text>
            </SafeAreaView>
        );
    }

    if (!provider) {
        return (
            <SafeAreaView style={styles.errorContainer}>
                <Text style={styles.errorText}>Prestador não encontrado.</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
                    <Text style={styles.backLinkText}>Voltar</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerNav}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft color="#111827" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitleNav}>Detalhes do Profissional</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Modern Centered Header */}
                <View style={styles.modernHeader}>
                    <Image source={{ uri: provider.avatar }} style={styles.roundAvatar} />
                    <Text style={styles.providerNameText}>{provider.name}</Text>

                    <View style={styles.serviceRow}>
                        {provider.services.map((s, i) => (
                            <Text key={i} style={styles.serviceMainText}>
                                {s}{i < provider.services.length - 1 ? ' • ' : ''}
                            </Text>
                        ))}
                    </View>

                    <View style={styles.ratingRow}>
                        <Star size={16} color="#FBBF24" fill="#FBBF24" />
                        <Text style={styles.ratingValueText}>{provider.rating.toFixed(1)}</Text>
                        <Text style={styles.reviewCountText}>({provider.reviewCount} avaliações)</Text>
                    </View>
                </View>

                {/* About Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sobre o Profissional</Text>
                    <Text style={styles.aboutText}>{provider.about}</Text>
                </View>

                {/* Portfolio Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Portfólio</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
                        {provider.portfolio.map((img, index) => (
                            <View key={index} style={styles.portfolioImageContainer}>
                                <Image source={{ uri: img }} style={styles.portfolioImage} />
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* Cities Section (Atendimento) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Cidades de Atendimento</Text>
                    <View style={styles.chipContainer}>
                        {provider.cities.map((city, index) => (
                            <View key={index} style={styles.cityChipModern}>
                                <MapPin size={14} color="#10B981" />
                                <Text style={styles.cityChipTextModern}>{city}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Reviews Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Avaliações Recentes</Text>
                        <TouchableOpacity
                            style={styles.addReviewButton}
                            onPress={() => setReviewModalVisible(true)}
                        >
                            <Text style={styles.addReviewButtonText}>Avaliar</Text>
                        </TouchableOpacity>
                    </View>

                    {provider.reviews.length > 0 ? (
                        provider.reviews.map((review) => (
                            <View key={review.id} style={styles.reviewCardModern}>
                                <View style={styles.reviewHeaderModern}>
                                    <View>
                                        <Text style={styles.clientNameModern}>{review.clientName}</Text>
                                        <View style={styles.reviewRatingModern}>
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    size={12}
                                                    color={i < review.rating ? "#FBBF24" : "#E5E7EB"}
                                                    fill={i < review.rating ? "#FBBF24" : "#E5E7EB"}
                                                />
                                            ))}
                                        </View>
                                    </View>
                                    <Text style={styles.reviewDateModern}>{review.date}</Text>
                                </View>
                                <Text style={styles.reviewComment}>{review.comment}</Text>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyStateContainer}>
                            <Text style={styles.emptyStateText}>Nenhuma avaliação disponível ainda.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <View style={styles.footerAction}>
                <TouchableOpacity
                    style={styles.contactButtonModern}
                    onPress={() => router.push({ pathname: '/(client)/chat/[id]', params: { id: String(id) } })}
                >
                    <MessageCircle size={22} color="#FFFFFF" />
                    <Text style={styles.contactButtonTextModern}>Iniciar Chat</Text>
                </TouchableOpacity>
            </View>

            {/* Evaluation Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={reviewModalVisible}
                onRequestClose={() => setReviewModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalContent}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Avaliar Profissional</Text>
                            <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                                <X color="#111827" size={24} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>Como foi sua experiência com {provider.name}?</Text>

                        <View style={styles.starSelectContainer}>
                            {[1, 2, 3, 4, 5].map((s) => (
                                <TouchableOpacity key={s} onPress={() => setReviewRating(s)}>
                                    <Star
                                        size={40}
                                        color={s <= reviewRating ? "#FBBF24" : "#E5E7EB"}
                                        fill={s <= reviewRating ? "#FBBF24" : "#E5E7EB"}
                                        style={styles.modalStar}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={styles.reviewInput}
                            placeholder="Escreva como foi o serviço..."
                            placeholderTextColor="#9CA3AF"
                            multiline
                            numberOfLines={4}
                            value={reviewComment}
                            onChangeText={setReviewComment}
                        />

                        <TouchableOpacity
                            style={[styles.submitReviewButton, submittingReview && { opacity: 0.7 }]}
                            onPress={handleSubmitReview}
                            disabled={submittingReview}
                        >
                            <Text style={styles.submitReviewButtonText}>
                                {submittingReview ? 'Enviando...' : 'Enviar Avaliação'}
                            </Text>
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    headerTitleNav: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    backButton: {
        padding: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
    },
    loadingText: {
        marginTop: 12,
        color: '#6B7280',
        fontSize: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 18,
        fontWeight: 'bold',
    },
    backLink: {
        marginTop: 16,
    },
    backLinkText: {
        color: '#4F46E5',
        fontSize: 16,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    modernHeader: {
        alignItems: 'center',
        paddingVertical: 32,
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 8,
    },
    roundAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 16,
        borderWidth: 4,
        borderColor: '#EEF2FF',
    },
    providerNameText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    serviceRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        paddingHorizontal: 24,
        marginBottom: 12,
    },
    serviceMainText: {
        fontSize: 16,
        color: '#4F46E5',
        fontWeight: '600',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    ratingValueText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#B45309',
        marginLeft: 6,
    },
    reviewCountText: {
        fontSize: 12,
        color: '#92400E',
        marginLeft: 6,
    },
    section: {
        paddingHorizontal: 24,
        paddingVertical: 20,
        marginTop: 8,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    addReviewButton: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    addReviewButtonText: {
        color: '#4F46E5',
        fontWeight: '600',
        fontSize: 14,
    },
    aboutText: {
        fontSize: 15,
        color: '#4B5563',
        lineHeight: 24,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    cityChipModern: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cityChipTextModern: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
        marginLeft: 8,
    },
    portfolioScroll: {
        marginTop: 4,
    },
    portfolioImageContainer: {
        marginRight: 16,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
    },
    portfolioImage: {
        width: 200,
        height: 260,
    },
    reviewCardModern: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    reviewHeaderModern: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    clientNameModern: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    reviewDateModern: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    reviewRatingModern: {
        flexDirection: 'row',
    },
    reviewComment: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 22,
    },
    footerAction: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 120, // Increased to avoid cutting off button on tabs
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    contactButtonModern: {
        backgroundColor: '#4F46E5',
        flexDirection: 'row',
        height: 60,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    contactButtonTextModern: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    footerButtonsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    secondaryButton: {
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: '#C7D2FE',
        flex: 1,
        shadowColor: 'transparent',
        elevation: 0,
    },
    secondaryButtonText: {
        color: '#4F46E5',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    modalSubtitle: {
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 24,
    },
    starSelectContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 24,
    },
    modalStar: {
        marginHorizontal: 4,
    },
    reviewInput: {
        backgroundColor: '#F3F4F6',
        borderRadius: 16,
        padding: 16,
        height: 120,
        fontSize: 16,
        color: '#111827',
        textAlignVertical: 'top',
        marginBottom: 24,
    },
    submitReviewButton: {
        backgroundColor: '#4F46E5',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitReviewButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    emptyStateContainer: {
        paddingVertical: 32,
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    emptyStateText: {
        color: '#6B7280',
        fontSize: 14,
    },
});
