
import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Layout, Palette } from '../constants/theme';

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: ViewStyle;
    contentContainerStyle?: ViewStyle;
    backgroundColor?: string;
}

export function ScreenWrapper({
    children,
    style,
    contentContainerStyle,
    backgroundColor = Palette.background,
}: ScreenWrapperProps) {
    return (
        <SafeAreaView style={[styles.container, { backgroundColor }, style]}>
            <View style={styles.centerContainer}>
                <View style={[styles.contentContainer, contentContainerStyle]}>
                    {children}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        width: '100%',
    },
    contentContainer: {
        flex: 1,
        width: '100%',
        maxWidth: Platform.OS === 'web' ? Layout.maxWidth : '100%',
        paddingHorizontal: Platform.OS === 'web' ? 24 : 0,
    },
});
