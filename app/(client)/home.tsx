import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Filter, MapPin, Search, Star } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Image, Modal, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

// Helper Interface
interface Provider {
    id: string;
    name: string;
    nomeFantasia?: string;
    service: string;
    rating: number; // Placeholder, not in DB yet
    city: string;
    avatar: string; // Placeholder or fetched
}

export default function ClientHomeScreen() {
    const router = useRouter();
    const [searchText, setSearchText] = useState('');
    const [providers, setProviders] = useState<Provider[]>([]);
    const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedService, setSelectedService] = useState<number | null>(null);
    const [currentClientId, setCurrentClientId] = useState<string | null>(null);
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

    function applySort(order: 'asc' | 'desc' | null) {
        setSortOrder(order);
        setFilterModalVisible(false);

        let list = [...filteredProviders];
        if (order === 'desc') {
            list.sort((a, b) => b.rating - a.rating);
        } else if (order === 'asc') {
            list.sort((a, b) => a.rating - b.rating);
        } else {
            // If clearing sort, re-apply search filter locally or reset
            handleSearch(searchText); // This effectively resets sort but keeps search
            return;
        }
        setFilteredProviders(list);
    }

    useEffect(() => {
        loadSession();
        fetchProviders();
    }, []);

    async function loadSession() {
        try {
            const userId = await AsyncStorage.getItem('user_id');
            if (userId) setCurrentClientId(userId);
        } catch (err) {
            console.error('Error loading session:', err);
        }
    }

    async function fetchProviders() {
        try {
            setLoading(true);

            // 1. Busca os prestadores
            const { data: prestadores, error } = await supabase
                .from('prestador')
                .select('id_prestador, nome, nome_fantasia, id_cidade');

            if (error || !prestadores) return;

            // 2. Para cada prestador, busca os serviços e a cidade em paralelo
            const formatted = await Promise.all(prestadores.map(async (p) => {

                // Busca todos os IDs de serviços do prestador
                const { data: rels } = await supabase
                    .from('servico_prestador')
                    .select('id_servico')
                    .eq('id_prestador', p.id_prestador);

                let nomesServicos: string[] = [];

                if (rels && rels.length > 0) {
                    const sIds = rels.map(r => r.id_servico);
                    const { data: ss } = await supabase
                        .from('servico')
                        .select('nome')
                        .in('id_servico', sIds);
                    if (ss) nomesServicos = ss.map(s => s.nome);
                }

                const serviceText = nomesServicos.length > 0 ? nomesServicos.join(' • ') : 'Serviço não informado';

                // Busca a cidade de moradia do prestador
                const { data: cidade } = await supabase
                    .from('cidade')
                    .select('descricao')
                    .eq('id', p.id_cidade)
                    .maybeSingle();
                let CidadeMoradia = 'Cidade não informada';
                if (cidade) CidadeMoradia = cidade.descricao;

                // Busca a média de notas da view
                const { data: notaData } = await supabase
                    .from('media_notas_prestador')
                    .select('media_nota')
                    .eq('id_prestador', p.id_prestador)
                    .maybeSingle();

                // Busca a imagem de perfil
                const { data: profileImg } = await supabase
                    .from('imagem_perfil')
                    .select('img')
                    .eq('id_usuario', p.id_prestador)
                    .maybeSingle();

                const displayName = p.nome_fantasia && p.nome_fantasia.trim() !== ''
                    ? p.nome_fantasia
                    : p.nome;

                return {
                    id: p.id_prestador.toString(),
                    name: displayName,
                    nomeFantasia: p.nome_fantasia,
                    service: serviceText,
                    rating: notaData?.media_nota || 0,
                    city: CidadeMoradia,
                    avatar: profileImg?.img || `https://ui-avatars.com/api/?name=${displayName}&background=random`,
                };
            }));

            setProviders(formatted);
            setFilteredProviders(formatted);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    function handleSearch(text: string) {
        setSearchText(text);
        if (!text) {
            setFilteredProviders(providers);
            return;
        }
        const lower = text.toLowerCase();
        const filtered = providers.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            p.service.toLowerCase().includes(lower) ||
            p.city.toLowerCase().includes(lower)
        );
        setFilteredProviders(filtered);
    }

    const renderProvider = ({ item }: { item: Provider }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/(client)/provider-details/[id]', params: { id: item.id } })}
        >
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <Text style={styles.providerName}>{item.name}</Text>
                    <View style={styles.ratingContainer}>
                        <Star size={14} color="#FBBF24" fill="#FBBF24" />
                        <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                    </View>
                </View>
                <Text style={styles.serviceText}>{item.service}</Text>
                <View style={styles.locationContainer}>
                    <MapPin size={14} color="#9CA3AF" />
                    <Text style={styles.locationText} numberOfLines={1}>{item.city}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Image
                        source={require('../../assets/images/logo.png')}
                        style={{ width: 40, height: 40 }}
                        resizeMode="contain"
                    />
                    <Text style={[styles.headerTitle, { marginLeft: 8 }]}>ConcertJá</Text>
                </View>
                <Text style={styles.headerSubtitle}>Os melhores profissionais perto de você.</Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Search color="#9CA3AF" size={20} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Nome ou serviço..."
                        placeholderTextColor="#9CA3AF"
                        value={searchText}
                        onChangeText={handleSearch}
                    />
                </View>
                <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
                    <Filter color="#FFFFFF" size={20} />
                </TouchableOpacity>
            </View>

            {/* Filter Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={filterModalVisible}
                onRequestClose={() => setFilterModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setFilterModalVisible(false)}
                >
                    <View style={styles.filterModalContent}>
                        <Text style={styles.filterTitle}>Ordenar por Avaliação</Text>

                        <TouchableOpacity style={styles.filterOption} onPress={() => applySort('desc')}>
                            <Star size={18} color={sortOrder === 'desc' ? '#4F46E5' : '#6B7280'} />
                            <Text style={[styles.filterText, sortOrder === 'desc' && styles.activeFilterText]}>
                                Maior Avaliação (5.0 - 0.0)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.filterOption} onPress={() => applySort('asc')}>
                            <Star size={18} color={sortOrder === 'asc' ? '#4F46E5' : '#6B7280'} />
                            <Text style={[styles.filterText, sortOrder === 'asc' && styles.activeFilterText]}>
                                Menor Avaliação (0.0 - 5.0)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.filterOption, { borderBottomWidth: 0 }]} onPress={() => applySort(null)}>
                            <Text style={styles.filterResetText}>Limpar Filtro</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Content */}
            <FlatList
                data={filteredProviders}
                keyExtractor={item => item.id}
                renderItem={renderProvider}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            {loading ? 'Carregando profissionais...' : 'Nenhum profissional encontrado.'}
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
        backgroundColor: '#FFFFFF',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        marginTop: -20, // Overlap effect or just visual spacing
        marginBottom: 16,
        alignItems: 'center',
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 50,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        marginRight: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#1F2937',
    },
    filterButton: {
        backgroundColor: '#4F46E5',
        width: 50,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        alignItems: 'center',
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#E5E7EB',
    },
    cardContent: {
        flex: 1,
        marginLeft: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    providerName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    ratingText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#B45309',
        marginLeft: 4,
    },
    serviceText: {
        fontSize: 14,
        color: '#4F46E5',
        fontWeight: '500',
        marginBottom: 4,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationText: {
        fontSize: 13,
        color: '#6B7280',
        marginLeft: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 40,
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    filterModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 350,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    filterTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 16,
        textAlign: 'center',
    },
    filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    filterText: {
        fontSize: 16,
        color: '#374151',
        marginLeft: 12,
        fontWeight: '500',
    },
    activeFilterText: {
        color: '#4F46E5',
        fontWeight: 'bold',
    },
    filterResetText: {
        fontSize: 16,
        color: '#EF4444',
        textAlign: 'center',
        width: '100%',
        fontWeight: '600',
    },
});
