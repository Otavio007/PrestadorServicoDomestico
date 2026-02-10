import axios from 'axios';

export interface AddressInfo {
    logradouro: string;
    bairro: string;
    localidade: string;
    uf: string;
    cep: string;
    erro?: boolean;
}

/**
 * Fetches address information from ViaCEP API.
 * @param cep The 8-digit Brazilian ZIP code.
 * @returns AddressInfo object or null if not found.
 */
export async function fetchAddressByCep(cep: string): Promise<AddressInfo | null> {
    const cleanedCep = cep.replace(/\D/g, '');

    if (cleanedCep.length !== 8) return null;

    try {
        const response = await axios.get(`https://viacep.com.br/ws/${cleanedCep}/json/`);

        if (response.data && response.data.erro) {
            return null;
        }

        return response.data;
    } catch (error) {
        console.error('Error fetching CEP:', error);
        return null;
    }
}
