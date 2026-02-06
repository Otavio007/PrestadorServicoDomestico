import AsyncStorage from '@react-native-async-storage/async-storage';
import { Star } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

interface Review {
    id: string;
    clientName: string;
    rating: number;
    comment: string;
    date: string;
}

export default function ProviderReviewsScreen() {
    const [loading, setLoading] = useState(true);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [averageRating, setAverageRating] = useState(0);
    const [totalReviews, setTotalReviews] = useState(0);

    useEffect(() => {
        fetchReviews();
    }, []);

    async function fetchReviews() {
        try {
            setLoading(true);
            const providerId = await AsyncStorage.getItem('user_id');
            if (!providerId) return;

            // 1. Fetch Average Rating
            const { data: notaData } = await supabase
                .from('media_notas_prestador')
                .select('media_nota')
                .eq('id_prestador', providerId)
                .maybeSingle();

            if (notaData) {
                setAverageRating(Number(notaData.media_nota) || 0);
            }

            // 2. Fetch Individual Reviews
            const { data: rData, error: rError } = await supabase
                .from('avaliacao')
                .select('*')
                .eq('id_prestador', providerId)
                .order('data_avalicao', { ascending: false });

            if (rError) throw rError;

            if (rData && rData.length > 0) {
                setTotalReviews(rData.length);

                const clientIds = [...new Set(rData.map(r => r.id_cliente))];
                const { data: clientsData } = await supabase
                    .from('cliente')
                    .select('id_cliente, nome')
                    .in('id_cliente', clientIds);

                const clientMap = (clientsData || []).reduce((acc: any, curr: any) => {
                    acc[curr.id_cliente] = curr.nome;
                    return acc;
                }, {});

                const formattedReviews = rData.map(r => ({
                    id: `${r.id_prestador}-${r.id_cliente}-${r.data_avalicao}`,
                    clientName: clientMap[r.id_cliente] || 'Cliente',
                    rating: r.nota,
                    comment: r.descricao,
                    date: r.data_avalicao ? new Date(r.data_avalicao).toLocaleDateString('pt-BR') : 'Recent',
                }));
                setReviews(formattedReviews);
            }
        } catch (err) {
            console.error('Error fetching reviews:', err);
        } finally {
            setLoading(false);
        }
    }

    const renderStars = (rating: number) => {
        return (
            <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={16}
                        color={star <= rating ? '#FBBF24' : '#E5E7EB'}
                        fill={star <= rating ? '#FBBF24' : 'transparent'}
                    />
                ))}
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Minhas Avaliações</Text>
                    <Text style={styles.subtitle}>Veja o que seus clientes estão dizendo.</Text>
                </View>

                {/* Summary Card */}
                <View style={styles.summaryCard}>
                    <View style={styles.ratingInfo}>
                        <Text style={styles.ratingValue}>{averageRating.toFixed(1)}</Text>
                        <View style={styles.starsLarge}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                    key={star}
                                    size={24}
                                    color={star <= Math.round(averageRating) ? '#FBBF24' : '#E5E7EB'}
                                    fill={star <= Math.round(averageRating) ? '#FBBF24' : 'transparent'}
                                />
                            ))}
                        </View>
                        <Text style={styles.totalReviewsText}>{totalReviews} avaliações recebidas</Text>
                    </View>
                </View>

                {/* Reviews List */}
                <View style={styles.listSection}>
                    {reviews.length > 0 ? (
                        reviews.map((item) => (
                            <View key={item.id} style={styles.reviewCard}>
                                <View style={styles.reviewHeader}>
                                    <View>
                                        <Text style={styles.clientName}>{item.clientName}</Text>
                                        <Text style={styles.reviewDate}>{item.date}</Text>
                                    </View>
                                    {renderStars(item.rating)}
                                </View>
                                {item.comment ? (
                                    <Text style={styles.commentText}>{item.comment}</Text>
                                ) : (
                                    <Text style={styles.noCommentText}>Sem comentário escrito.</Text>
                                )}
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Star size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
                            <Text style={styles.emptyText}>Você ainda não recebeu nenhuma avaliação.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 24, paddingBottom: 100 },
    header: { marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
    subtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 5,
    },
    ratingInfo: { alignItems: 'center' },
    ratingValue: { fontSize: 48, fontWeight: 'bold', color: '#111827' },
    starsLarge: { flexDirection: 'row', marginVertical: 12 },
    totalReviewsText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
    listSection: { gap: 16 },
    reviewCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    clientName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    reviewDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    starsContainer: { flexDirection: 'row', gap: 2 },
    commentText: { fontSize: 15, color: '#374151', lineHeight: 22 },
    noCommentText: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },
    emptyContainer: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 16, color: '#9CA3AF', textAlign: 'center' }
});
