// tslint:disable no-bitwise no-shadowed-variable

import { WalletInfoEntry, WalletType } from './WalletInfo';
import { Utf8Tools } from '@nimiq/utils';
import { LABEL_MAX_LENGTH } from '@/lib/Constants';

class CookieJar {
    public static readonly VERSION = 1;
    public static readonly MAX_COOKIE_SIZE = 2500; // byte (3000 would probable be safe, but we'll be safer for now)

    public static readonly ENCODED_ACCOUNT_SIZE =
           1 // account label length
        + 63 // account label
        + 20 // address
    ;

    public static fill(wallets: WalletInfoEntry[]) {
        const maxAge = 60 * 60 * 24 * 365; // 1 year
        const encodedWallets = this.encodeCookie(wallets);
        document.cookie = `w=${encodedWallets};max-age=${maxAge.toString()}`;
    }

    public static async eat(): Promise<WalletInfoEntry[]> {
        const encodedWallets = this.getCookieContents();
        return encodedWallets ? this.decodeCookie(encodedWallets) : [];
    }

    public static encodeCookie(wallets: WalletInfoEntry[]) {
        const bytes: number[] = [];

        // Cookie version
        bytes.push(CookieJar.VERSION);

        for (const wallet of wallets) {
            bytes.push.apply(bytes, this.encodeWallet(wallet));
        }

        return Nimiq.BufferUtils.toBase64(new Uint8Array(bytes));
    }

    public static async decodeCookie(str: string): Promise<WalletInfoEntry[]> {
        const module = await import(/* webpackChunkName: "cookie-decoder" */ './CookieDecoder');
        return module.CookieDecoder.decode(str);
    }

    public static canFitNewAccount(): boolean {
        return (this.MAX_COOKIE_SIZE - this.getCookieSize()) >= this.ENCODED_ACCOUNT_SIZE;
    }

    public static canFitNewWallet(wallet: WalletInfoEntry): boolean {
        return (this.MAX_COOKIE_SIZE - this.getCookieSize()) >= this.encodeWallet(wallet).length;
    }

    public static cutLabel(label: string): Uint8Array {
        let labelBytes =  Utf8Tools.stringToUtf8ByteArray(label);

        if (labelBytes.length <= LABEL_MAX_LENGTH) return labelBytes;

        // Don't output warning in NodeJS environment (when running tests)
        if (typeof global === 'undefined') console.warn('Label will be shortened for cookie:', label);

        labelBytes = labelBytes.slice(0, LABEL_MAX_LENGTH);

        // Cut off last byte until byte array is valid utf-8
        while (!Utf8Tools.isValidUtf8(labelBytes)) labelBytes = labelBytes.slice(0, labelBytes.length - 1);
        return labelBytes;
    }

    private static encodeWallet(wallet: WalletInfoEntry) {
        const bytes: number[] = [];
        const label = wallet.type === WalletType.LEGACY
            ? wallet.accounts.values().next().value.label // label of the single account
            : wallet.label;
        const labelBytes = this.cutLabel(label);

        // Combined label length & wallet type
        bytes.push((labelBytes.length << 2) | wallet.type);

        // Status
        let statusByte: number = 0;
        statusByte = statusByte | (wallet.keyMissing ? CookieJar.StatusFlags.KEY_MISSING : 0);
        bytes.push(statusByte);

        // Wallet ID
        if (wallet.type === WalletType.LEDGER) {
            const walletIdChunks = wallet.id.match(/.{2}/g);
            for (const chunk of walletIdChunks!) {
                bytes.push(parseInt(chunk, 16));
            }
        } else {
            // Keyguard Wallet
            const numericalId = parseInt(wallet.id.substr(1), 10);
            const idBytes = CookieJar.toBase256(numericalId);
            bytes.push(idBytes.length);
            bytes.push.apply(bytes, idBytes);
        }

        // Label
        if (labelBytes.length > 0) {
            bytes.push.apply(bytes, Array.from(labelBytes));
        }

        // Legacy account information
        if (wallet.type === WalletType.LEGACY) {
            const account = wallet.accounts.values().next().value;

            // Account address
            bytes.push.apply(bytes, Array.from(account.address));
            return bytes;
        }

        // Regular label and account information

        // Wallet number of accounts
        bytes.push(wallet.accounts.size);

        // Wallet accounts
        const accounts = Array.from(wallet.accounts.values());
        for (const account of accounts) {
            const labelBytes = this.cutLabel(account.label);

            // Account label length
            bytes.push(labelBytes.length);

            // Account label
            if (labelBytes.length > 0) {
                bytes.push.apply(bytes, Array.from(labelBytes));
            }

            // Account address
            bytes.push.apply(bytes, Array.from(account.address));
        }

        return bytes;
    }

    private static getCookieContents(): string | null {
        const match = document.cookie.match(new RegExp('w=([^;]+)'));
        return match && match[1];
    }

    private static getCookieSize(): number {
        const encodedWallets = this.getCookieContents() || '';
        return Nimiq.BufferUtils.fromBase64(encodedWallets).length;
    }

    private static toBase256(value: number) {
        const bits = value.toString(2);

        // Reverse so we can split into 8s from the end
        const reverseBits = bits.split('').reverse().join('');

        // Split into chunks of 8 bits
        const reverseBytes = reverseBits.match(/.{1,8}/g) as RegExpMatchArray;

        // Reverse chunks, parse as base2 int, reverse array
        const bytes = reverseBytes.map((revByte) => parseInt(revByte.split('').reverse().join(''), 2)).reverse();
        return bytes;
    }
}

namespace CookieJar { // tslint:disable-line no-namespace
    export enum StatusFlags {
        KEY_MISSING = 1,
        // HAS_PIN = 1 << 1,
    }
}

export default CookieJar;
