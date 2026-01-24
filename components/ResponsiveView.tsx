
import React from 'react';
import { Platform, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { Layout } from '../constants/theme';

interface ResponsiveViewProps {
    children: React.ReactNode;

    /**
     * Component to render on the left side (only on Desktop/Large screens)
     */
    leftComponent?: React.ReactNode;

    /**
     * Style for the main container
     */
    style?: StyleProp<ViewStyle>;

    /**
     * Width ratio for the left component (0.1 to 0.9). Default is 0.5 (50%)
     */
    leftRatio?: number;
}

export function ResponsiveView({ children, leftComponent, style, leftRatio = 0.5 }: ResponsiveViewProps) {
    const { width } = useWindowDimensions();
    const isDesktop = width >= Layout.breakPoints.lg;

    if (isDesktop && leftComponent) {
        return (
            <View style={[styles.container, styles.row, style]}>
                <View style={[styles.panel, { flex: leftRatio }]}>
                    {leftComponent}
                </View>
                <View style={[styles.panel, { flex: 1 - leftRatio }]}>
                    {children}
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        height: '100%',
        ...Platform.select({
            web: { maxHeight: '100vh' as any } as ViewStyle,
            default: {}
        }),
        overflow: 'hidden', // Prevent scroll on parent if panels scroll internally
    },
    panel: {
        height: '100%',
        justifyContent: 'center',
    },
});
