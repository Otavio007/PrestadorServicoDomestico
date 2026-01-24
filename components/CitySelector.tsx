import { Check, ChevronDown, MapPin, X } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface City {
    label: string;
    value: string;
}

interface CitySelectorProps {
    items: City[];
    selectedValues: string[];
    onSelectionChange: (selected: string[]) => void;
}

export function CitySelector({ items, selectedValues, onSelectionChange }: CitySelectorProps) {
    const [modalVisible, setModalVisible] = useState(false);

    // Filter out the "placeholder" if it exists in items passed (though better to pass clean list)
    const validItems = items.filter(i => i.value !== '');

    const toggleSelection = (value: string) => {
        if (selectedValues.includes(value)) {
            onSelectionChange(selectedValues.filter(v => v !== value));
        } else {
            onSelectionChange([...selectedValues, value]);
        }
    };

    const getDisplayLabel = () => {
        if (selectedValues.length === 0) return 'Selecione as cidades...';
        if (selectedValues.length === 1) return items.find(i => i.value === selectedValues[0])?.label;
        return `${selectedValues.length} cidades selecionadas`;
    };

    return (
        <View>
            <TouchableOpacity
                style={styles.selectorButton}
                onPress={() => setModalVisible(true)}
            >
                <View style={styles.iconContainer}>
                    <MapPin color="#6B7280" size={20} />
                </View>
                <Text style={[styles.selectorText, selectedValues.length === 0 && styles.placeholderText]}>
                    {getDisplayLabel()}
                </Text>
                <ChevronDown color="#6B7280" size={20} />
            </TouchableOpacity>

            {/* Selected Tags Display */}
            {selectedValues.length > 0 && (
                <View style={styles.tagsContainer}>
                    {selectedValues.map(val => {
                        const label = items.find(i => i.value === val)?.label;
                        return (
                            <View key={val} style={styles.tag}>
                                <Text style={styles.tagText}>{label}</Text>
                                <TouchableOpacity onPress={() => toggleSelection(val)}>
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
                            <Text style={styles.modalTitle}>Selecione as Cidades</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X color="#111827" size={24} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={validItems}
                            keyExtractor={item => item.value}
                            renderItem={({ item }) => {
                                const isSelected = selectedValues.includes(item.value);
                                return (
                                    <TouchableOpacity
                                        style={[styles.optionItem, isSelected && styles.optionSelected]}
                                        onPress={() => toggleSelection(item.value)}
                                    >
                                        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                                            {item.label}
                                        </Text>
                                        {isSelected && <Check size={20} color="#4F46E5" />}
                                    </TouchableOpacity>
                                );
                            }}
                        />

                        <TouchableOpacity
                            style={styles.doneButton}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={styles.doneButtonText}>Confirmar</Text>
                        </TouchableOpacity>
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
        backgroundColor: '#F3F4F6', // Matches input style in generic form
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
        color: '#6B7280', // Placeholder color matches inputs
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
