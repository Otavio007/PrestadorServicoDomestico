import { Check, ChevronDown, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export interface SearchableSelectItem {
    label: string;
    value: string | number;
}

interface SearchableSelectProps {
    items: SearchableSelectItem[];
    selectedValue?: string | number;
    selectedValues?: (string | number)[];
    onSelectionChange: (value: any) => void;
    placeholder?: string;
    title?: string;
    multiSelect?: boolean;
    icon?: React.ReactNode;
}

export function SearchableSelect({
    items,
    selectedValue,
    selectedValues,
    onSelectionChange,
    placeholder = 'Selecione...',
    title = 'Selecione',
    multiSelect = false,
    icon
}: SearchableSelectProps) {
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredItems = useMemo(() => {
        if (!searchQuery) return items;
        return items.filter(item =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [items, searchQuery]);

    const handleSelect = (value: string | number) => {
        if (multiSelect) {
            const currentSelected = selectedValues || [];
            if (currentSelected.includes(value)) {
                onSelectionChange(currentSelected.filter(v => v !== value));
            } else {
                onSelectionChange([...currentSelected, value]);
            }
        } else {
            onSelectionChange(value);
            setModalVisible(false);
            setSearchQuery('');
        }
    };

    const getDisplayLabel = () => {
        if (multiSelect) {
            if (!selectedValues || selectedValues.length === 0) return placeholder;
            if (selectedValues.length === 1) return items.find(i => i.value === selectedValues[0])?.label || placeholder;
            return `${selectedValues.length} selecionados`;
        } else {
            if (!selectedValue) return placeholder;
            return items.find(i => i.value === selectedValue)?.label || placeholder;
        }
    };

    const isSelected = (value: string | number) => {
        if (multiSelect) {
            return (selectedValues || []).includes(value);
        }
        return selectedValue === value;
    };

    return (
        <View>
            <TouchableOpacity
                style={styles.selectorButton}
                onPress={() => setModalVisible(true)}
            >
                <View style={styles.iconContainer}>
                    {icon}
                </View>
                <Text style={[styles.selectorText, !selectedValue && (!selectedValues || selectedValues.length === 0) && styles.placeholderText]}>
                    {getDisplayLabel()}
                </Text>
                <ChevronDown color="#6B7280" size={20} />
            </TouchableOpacity>

            {/* Selected Tags Display for MultiSelect */}
            {multiSelect && selectedValues && selectedValues.length > 0 && (
                <View style={styles.tagsContainer}>
                    {selectedValues.map(val => {
                        const label = items.find(i => i.value === val)?.label;
                        return (
                            <View key={val} style={styles.tag}>
                                <Text style={styles.tagText}>{label}</Text>
                                <TouchableOpacity onPress={() => handleSelect(val)}>
                                    <X size={14} color="#4F46E5" />
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            )}

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{title}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X color="#111827" size={24} />
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        <View style={styles.searchContainer}>
                            <Search color="#9CA3AF" size={20} style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Pesquisar..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCorrect={false}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <X color="#9CA3AF" size={18} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <FlatList
                            data={filteredItems}
                            keyExtractor={item => String(item.value)}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => {
                                const selected = isSelected(item.value);
                                return (
                                    <TouchableOpacity
                                        style={[styles.optionItem, selected && styles.optionSelected]}
                                        onPress={() => handleSelect(item.value)}
                                    >
                                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                                            {item.label}
                                        </Text>
                                        {selected && <Check size={20} color="#4F46E5" />}
                                    </TouchableOpacity>
                                );
                            }}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>Nenhuma opção encontrada.</Text>
                            }
                        />

                        {multiSelect && (
                            <TouchableOpacity
                                style={styles.doneButton}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.doneButtonText}>Confirmar</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    selectorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        height: 50,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    iconContainer: {
        marginRight: 10,
    },
    selectorText: {
        flex: 1,
        fontSize: 16,
        color: '#1F2937',
    },
    placeholderText: {
        color: '#6B7280',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
        marginBottom: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    tagText: {
        color: '#4F46E5',
        fontSize: 14,
        marginRight: 6,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        maxHeight: '80%',
        paddingBottom: 40
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#1F2937',
        height: '100%'
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    optionSelected: {
        backgroundColor: '#F9FAFB',
    },
    optionText: {
        fontSize: 16,
        color: '#374151',
    },
    optionTextSelected: {
        fontWeight: '600',
        color: '#4F46E5',
    },
    emptyText: {
        textAlign: 'center',
        color: '#6B7280',
        marginTop: 20,
        fontSize: 16
    },
    doneButton: {
        backgroundColor: '#4F46E5',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    doneButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
