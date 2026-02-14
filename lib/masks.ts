/**
 * Masks a string as CPF (000.000.000-00)
 */
export const maskCpf = (value: string) => {
    return value
        .replace(/\D/g, '') // Remove non-digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1'); // Limit to 11 digits
};

/**
 * Masks a string as Phone ((00) 00000-0000)
 */
export const maskPhone = (value: string) => {
    let r = value.replace(/\D/g, '');
    if (r.length > 11) r = r.substring(0, 11);
    if (r.length > 10) {
        return r.replace(/^(\d\d)(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (r.length > 5) {
        return r.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (r.length > 2) {
        return r.replace(/^(\d\d)(\d{0,5})/, '($1) $2');
    } else if (r.length > 0) {
        return r.replace(/^(\d*)/, '($1');
    }
    return r;
};

/**
 * Removes all non-numeric characters from a string
 */
export const unmask = (value: string) => {
    return value.replace(/\D/g, '');
};
