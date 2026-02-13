import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MapPin, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarView } from '../../components/CalendarView';
import { SearchableSelect, SearchableSelectItem } from '../../components/SearchableSelect';
import { supabase } from '../../lib/supabase';

export default function ScheduleScreen() {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [clients, setClients] = useState<SearchableSelectItem[]>([]);
    const [selectedClient, setSelectedClient] = useState<string | number | null>(null);
    const [address, setAddress] = useState<string>('');
    const [observation, setObservation] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadClients();
    }, []);

    useEffect(() => {
        if (selectedClient) {
            loadClientAddress(selectedClient);
        } else {
            setAddress('');
        }
    }, [selectedClient]);

    async function loadClients() {
        const providerId = await AsyncStorage.getItem('user_id');
        if (!providerId) return;

        try {
            // 1. Get clients who have chatted with this provider
            const { data: messagesData, error: messagesError } = await supabase
                .from('mensagem')
                .select('id_cliente')
                .eq('id_prestador', providerId);

            if (messagesError) throw messagesError;

            if (messagesData && messagesData.length > 0) {
                const uniqueClientIds = [...new Set(messagesData.map(m => m.id_cliente))];

                // 2. Get client details
                const { data: clientsData, error: clientsError } = await supabase
                    .from('cliente')
                    .select('id_cliente, nome')
                    .in('id_cliente', uniqueClientIds);

                if (clientsError) throw clientsError;

                if (clientsData) {
                    setClients(clientsData.map(c => ({
                        label: c.nome,
                        value: c.id_cliente
                    })));
                }
            } else {
                setClients([]);
            }
        } catch (error) {
            console.error('Error loading clients:', error);
            // Optionally show alert or just log
        }
    }

    async function loadClientAddress(clientId: string | number) {
        try {
            // 1. Fetch client address details + id_cidade
            const { data: clientData, error: clientError } = await supabase
                .from('cliente')
                .select('logradouro, num_logradouro, bairro, id_cidade')
                .eq('id_cliente', clientId)
                .single();

            if (clientError) throw clientError;

            if (clientData) {
                let cityDescription = '';

                // 2. If there is a city ID, fetch the city description
                if (clientData.id_cidade) {
                    const { data: cityData, error: cityError } = await supabase
                        .from('cidade')
                        .select('descricao')
                        .eq('id', clientData.id_cidade)
                        .single();

                    if (!cityError && cityData) {
                        cityDescription = cityData.descricao;
                    } else if (cityError) {
                        console.log('Error fetching city:', cityError);
                    }
                }

                const formattedAddress = `${clientData.logradouro}, ${clientData.num_logradouro} - ${clientData.bairro}, ${cityDescription}`;
                setAddress(formattedAddress);
            }
        } catch (error) {
            console.error('Error fetching address:', error);
            setAddress('Endereço não encontrado');
        }
    }

    // Time Masking Function
    const formatTime = (text: string) => {
        // Remove non-numeric characters
        const cleaned = text.replace(/[^0-9]/g, '');

        // Limit to 4 characters
        const trimmed = cleaned.substring(0, 4);

        if (trimmed.length >= 3) {
            return `${trimmed.substring(0, 2)}:${trimmed.substring(2)}`;
        }
        return trimmed;
    };

    const handleTimeChange = (text: string, setTime: (t: string) => void) => {
        const formatted = formatTime(text);
        setTime(formatted);
    };

    const isTimeValid = (time: string) => {
        const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return regex.test(time);
    };

    const [modalVisible, setModalVisible] = useState(false);
    const [dailyAppointments, setDailyAppointments] = useState<any[]>([]);
    const [fetchingAppointments, setFetchingAppointments] = useState(false);

    const handleSave = async () => {
        let currentStart = startTime;
        let currentEnd = endTime;

        // Auto-format "HH" to "HH:00" if user types just 2 digits
        if (currentStart.length === 2 && !currentStart.includes(':')) {
            currentStart = `${currentStart}:00`;
            setStartTime(currentStart);
        }
        if (currentEnd.length === 2 && !currentEnd.includes(':')) {
            currentEnd = `${currentEnd}:00`;
            setEndTime(currentEnd);
        }

        if (!selectedClient || !currentStart || !currentEnd) {
            Alert.alert('Erro', 'Preencha todos os campos obrigatórios (Cliente e Horários).');
            return;
        }

        if (!isTimeValid(currentStart) || !isTimeValid(currentEnd)) {
            Alert.alert('Erro', 'Horário inválido. Use o formato HH:mm (ex: 14:30).');
            return;
        }

        try {
            setLoading(true);
            const providerId = await AsyncStorage.getItem('user_id');
            if (!providerId) return;

            // Normalize Date
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            // Add seconds for safety. currentStart is approx HH:mm (length 4 or 5)
            // If length is 4 (e.g. 9:00), pad with 0 -> 09:00 -> 09:00:00
            const toDBTime = (t: string) => {
                const normalized = t.length === 4 ? `0${t}` : t;
                return `${normalized}:00`;
            };

            const formattedStart = toDBTime(currentStart);
            const formattedEnd = toDBTime(currentEnd);

            // CHECK FOR OVERLAPPING APPOINTMENTS
            const { data: existingAppts, error: fetchError } = await supabase
                .from('agenda')
                .select('horario_inicio, horario_fim')
                .eq('id_prestador', providerId)
                .eq('data_agenda', dateStr);

            if (fetchError) throw fetchError;

            if (existingAppts && existingAppts.length > 0) {
                const newStartVal = parseInt(formattedStart.replace(/:/g, ''), 10);
                const newEndVal = parseInt(formattedEnd.replace(/:/g, ''), 10);

                const hasOverlap = existingAppts.some(appt => {
                    const existStartVal = parseInt(appt.horario_inicio.replace(/:/g, ''), 10);
                    const existEndVal = parseInt(appt.horario_fim.replace(/:/g, ''), 10);

                    // Overlap Condition: (StartA < EndB) and (EndA > StartB)
                    return newStartVal < existEndVal && newEndVal > existStartVal;
                });

                if (hasOverlap) {
                    Alert.alert('Horário Ocupado', 'Já existe um compromisso agendado para este intervalo de horário.');
                    setLoading(false);
                    return;
                }
            }

            const { error } = await supabase
                .from('agenda')
                .insert({
                    id_prestador: providerId,
                    id_cliente: selectedClient,
                    data_agenda: dateStr,
                    horario_inicio: formattedStart,
                    horario_fim: formattedEnd,
                    endereco: address, // Saving the address
                    status: 'agendado'
                });

            if (error) throw error;

            Alert.alert('Sucesso', 'Compromisso agendado com sucesso!');
            // Reset form
            setStartTime('');
            setEndTime('');
            setSelectedClient(null);

        } catch (error: any) {
            console.error('Error saving appointment:', error);
            Alert.alert('Erro', 'Falha ao agendar: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setLoading(false);
        }
    };

    const fetchDailyAppointments = async () => {
        try {
            setFetchingAppointments(true);
            const providerId = await AsyncStorage.getItem('user_id');
            if (!providerId) return;

            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const { data, error } = await supabase
                .from('agenda')
                .select('*, cliente(nome)')
                .eq('id_prestador', providerId)
                .eq('data_agenda', dateStr)
                .order('horario_inicio', { ascending: true });

            if (error) throw error;
            setDailyAppointments(data || []);
            setModalVisible(true);
        } catch (error) {
            console.error('Error fetching daily appointments:', error);
            Alert.alert('Erro', 'Não foi possível carregar a agenda do dia.');
        } finally {
            setFetchingAppointments(false);
        }
    };

    const handleDelete = (appointmentId: number) => {
        Alert.alert(
            'Confirmar Exclusão',
            'Tem certeza que deseja excluir este agendamento?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Excluir',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('agenda')
                                .delete()
                                .eq('id_agenda', appointmentId);

                            if (error) throw error;

                            // Update local state to remove the item
                            setDailyAppointments(prev => prev.filter(item => item.id_agenda !== appointmentId));
                            Alert.alert('Sucesso', 'Agendamento excluído.');
                        } catch (error) {
                            console.error('Error deleting appointment:', error);
                            Alert.alert('Erro', 'Não foi possível excluir o agendamento.');
                        }
                    }
                }
            ]
        );
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
                    <Text style={[styles.headerTitle, { marginLeft: 8 }]}>ConsertJá - Agenda</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.contentParams}>
                <View style={{ width: '100%', maxWidth: 350, alignSelf: 'center' }}>
                    <CalendarView
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                    />
                </View>

                <View style={[styles.section, { marginTop: 12 }]}>
                    <Text style={styles.sectionTitle}>Novo Compromisso</Text>

                    {/* Client Selector */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Cliente</Text>
                        <SearchableSelect
                            title="Selecione o Cliente"
                            placeholder="Buscar cliente..."
                            items={clients}
                            selectedValue={selectedClient!}
                            onSelectionChange={setSelectedClient}
                            multiSelect={false}
                        />
                        <Text style={styles.helperText}>Somente clientes do chat aparecem aqui.</Text>
                    </View>

                    {selectedClient && (
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Endereço do Serviço</Text>
                            <TextInput
                                style={styles.input}
                                value={address}
                                onChangeText={setAddress}
                                placeholder="Endereço do serviço"
                                multiline
                            />
                            <Text style={styles.helperText}>Puxado do cadastro, mas pode ser editado.</Text>
                        </View>
                    )}

                    {/* Time */}
                    <View style={styles.row}>
                        <View style={[styles.inputContainer, { flex: 1, marginRight: 12 }]}>
                            <Text style={styles.label}>Início</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="00:00"
                                value={startTime}
                                onChangeText={(text) => handleTimeChange(text, setStartTime)}
                                keyboardType="number-pad"
                                maxLength={5}
                            />
                        </View>
                        <View style={[styles.inputContainer, { flex: 1 }]}>
                            <Text style={styles.label}>Fim</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="00:00"
                                value={endTime}
                                onChangeText={(text) => handleTimeChange(text, setEndTime)}
                                keyboardType="number-pad"
                                maxLength={5}
                            />
                        </View>
                    </View>

                    {/* Helper Date Display */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Data Selecionada</Text>
                        <View style={[styles.readOnlyContainer, { backgroundColor: '#F3F4F6' }]}>
                            <Text style={styles.readOnlyText}>
                                {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </Text>
                        </View>
                    </View>


                    <TouchableOpacity
                        style={[styles.saveButton, loading && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        <Text style={styles.saveButtonText}>
                            {loading ? 'Agendando...' : 'Agendar Compromisso'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.viewButton, fetchingAppointments && { opacity: 0.7 }]}
                        onPress={fetchDailyAppointments}
                        disabled={fetchingAppointments}
                    >
                        <Text style={styles.viewButtonText}>
                            {fetchingAppointments ? 'Carregando...' : 'Consultar Agenda do Dia'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Consultation Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Compromissos do Dia</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X color="#111827" size={24} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>
                            {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </Text>

                        {dailyAppointments.length > 0 ? (
                            <FlatList
                                data={dailyAppointments}
                                keyExtractor={(item) => item.id_agenda.toString()}
                                renderItem={({ item }) => (
                                    <View style={styles.appointmentCard}>
                                        <View style={styles.appHeaderRow}>
                                            <Text style={styles.appClientName}>{item.cliente?.nome || 'Cliente não encontrado'}</Text>
                                            <TouchableOpacity onPress={() => handleDelete(item.id_agenda)}>
                                                <Feather name="trash-2" color="#EF4444" size={20} />
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.appTime}>
                                            {item.horario_inicio.slice(0, 5)} - {item.horario_fim.slice(0, 5)}
                                        </Text>
                                        <View style={styles.appAddressRow}>
                                            <MapPin size={14} color="#6B7280" />
                                            <Text style={styles.appAddress} numberOfLines={2}>
                                                {item.endereco || 'Sem endereço'}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                contentContainerStyle={{ paddingBottom: 20 }}
                            />
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>Nenhum compromisso para este dia.</Text>
                            </View>
                        )}
                    </View>
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
    header: {
        padding: 24,
        paddingBottom: 16,
        backgroundColor: '#FFFFFF',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    contentParams: {
        padding: 24,
        paddingBottom: 120,
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 16,
    },
    inputContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 6,
    },
    helperText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    input: {
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    textArea: {
        minHeight: 100,
    },
    readOnlyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    readOnlyText: {
        color: '#374151',
        fontSize: 14,
        flex: 1,
    },
    row: {
        flexDirection: 'row',
    },
    saveButton: {
        backgroundColor: '#4F46E5',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    viewButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#4F46E5',
    },
    viewButtonText: {
        color: '#4F46E5',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
    },
    appointmentCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    appHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    appClientName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
        flex: 1, // Allow text to take available space
    },
    appTime: {
        fontSize: 14,
        color: '#4F46E5',
        fontWeight: '600',
        marginBottom: 8,
    },
    appAddressRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    appAddress: {
        fontSize: 13,
        color: '#4B5563',
        marginLeft: 6,
        flex: 1,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 16,
    },
});
