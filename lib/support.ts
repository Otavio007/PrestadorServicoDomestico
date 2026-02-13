import { Linking } from 'react-native';

/**
 * Opens WhatsApp with a pre-filled message to the support number.
 */
export async function openWhatsAppSupport() {
    const phoneNumber = '5519995203113';
    const message = 'Olá! Gostaria de dar um feedback ou tirar uma dúvida sobre o ConsertJá.';
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            // Fallback for cases where wa.me might not be directly supported but browser is
            await Linking.openURL(url);
        }
    } catch (error) {
        console.error('Error opening WhatsApp support:', error);
    }
}
