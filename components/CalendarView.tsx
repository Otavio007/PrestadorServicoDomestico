import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CalendarViewProps {
    selectedDate: Date | null;
    onDateSelect: (date: Date) => void;
}

export function CalendarView({ selectedDate, onDateSelect }: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month, 1).getDay();
    };

    const changeMonth = (increment: number) => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() + increment);
        setCurrentMonth(newDate);
    };

    const renderHeader = () => {
        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return (
            <View style={styles.header}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navButton}>
                    <ChevronLeft size={24} color="#374151" />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </Text>
                <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navButton}>
                    <ChevronRight size={24} color="#374151" />
                </TouchableOpacity>
            </View>
        );
    };

    const renderDays = () => {
        const daysInMonth = getDaysInMonth(currentMonth);
        const firstDay = getFirstDayOfMonth(currentMonth);
        const days = [];

        // Weekday headers
        const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
        const weekDayHeaders = weekDays.map((day, index) => (
            <View key={`header-${index}`} style={styles.dayCell}>
                <Text style={styles.weekDayText}>{day}</Text>
            </View>
        ));

        // Empty cells for days before the first day of the month
        for (let i = 0; i < firstDay; i++) {
            days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
        }

        // Days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
            const isSelected = selectedDate && 
                date.getDate() === selectedDate.getDate() &&
                date.getMonth() === selectedDate.getMonth() &&
                date.getFullYear() === selectedDate.getFullYear();
            
            const isToday = new Date().toDateString() === date.toDateString();

            days.push(
                <TouchableOpacity
                    key={i}
                    style={[
                        styles.dayCell,
                        styles.dateTouch,
                        isSelected && styles.selectedDay,
                        !isSelected && isToday && styles.today
                    ]}
                    onPress={() => onDateSelect(date)}
                >
                    <Text style={[
                        styles.dayText,
                        isSelected && styles.selectedDayText,
                        !isSelected && isToday && styles.todayText
                    ]}>
                        {i}
                    </Text>
                </TouchableOpacity>
            );
        }

        return (
            <View style={styles.calendarBody}>
                <View style={styles.weekRow}>{weekDayHeaders}</View>
                <View style={styles.daysGrid}>{days}</View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {renderHeader()}
            {renderDays()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    navButton: {
        padding: 8,
    },
    calendarBody: {},
    weekRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%', // 100% / 7 days
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateTouch: {
        borderRadius: 20, // Circular
    },
    weekDayText: {
        fontSize: 14,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    dayText: {
        fontSize: 16,
        color: '#374151',
    },
    selectedDay: {
        backgroundColor: '#4F46E5',
    },
    selectedDayText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    today: {
        borderWidth: 1,
        borderColor: '#4F46E5',
    },
    todayText: {
        color: '#4F46E5',
        fontWeight: 'bold'
    }
});
