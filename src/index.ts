import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { handleMessage } from './handler';

import ffmpegPath from '@ffmpeg-installer/ffmpeg';

class SafeLocalAuth extends LocalAuth {
    public pendingLogoutCleanup = false;

    logout = async (): Promise<void> => {
        const client = (this as any).client;
        const userDataDir: string | undefined = (this as any).userDataDir;
        const browser = client?.pupBrowser;

        // whatsapp-web.js calls authStrategy.logout() inside pupPage's framenavigated
        // handler (post_logout=1) while Chromium is still running. On Windows,
        // Chromium locks `lockfile` and profile files, causing fs.rm to throw EBUSY
        // and partially corrupt the active userDataDir.
        if (browser?.isConnected?.()) {
            this.pendingLogoutCleanup = true;
            console.warn('Session logged out while browser is running; deferring session cleanup until shutdown.');
            return;
        }

        if (userDataDir) {
            await fs.promises.rm(userDataDir, {
                recursive: true,
                force: true,
                maxRetries: 10,
                retryDelay: 250,
            });
            this.pendingLogoutCleanup = false;
        }
    }
}

const authStrategy = new SafeLocalAuth();

const client = new Client({
    authStrategy,
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/AgathaRosmwortet/extension/main/release/{version}/package.json',
    },
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        protocolTimeout: 180000,
    },
    ffmpegPath: ffmpegPath.path
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    authStrategy.pendingLogoutCleanup = false;
    console.log('Client authenticated!');
});

client.on('auth_failure', (msg) => {
    console.error('Authentication failure:', msg);
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('disconnected', (reason) => {
    console.warn('Client disconnected:', reason);
});

client.on('message_create', (msg) => {
    // Ignore status broadcast messages
    if (msg.from === 'status@broadcast') return;
    handleMessage(msg);
});

const originalInject = (client as any).inject.bind(client);
(client as any).inject = async function () {
    const page = (client as any).pupPage;
    if (page) {
        const timeout = (client as any).options?.authTimeoutMs || 30000;
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const ready = await page.evaluate(() => {
                const win = window as any;
                if (typeof win.Debug?.VERSION === 'undefined') return false;
                const ver = parseInt(String(win.Debug.VERSION).split('.')?.[1] || '0', 10);
                if (ver < 3000) return true;
                try {
                    return Boolean(
                        typeof win.require === 'function' &&
                        win.require('WAWebSocketModel')?.Socket &&
                        win.require('WAWebCmd')?.Cmd &&
                        win.require('WAWebConnModel')?.Conn &&
                        win.require('WAWebOfflineHandler')?.OfflineMessageHandler
                    );
                } catch {
                    return false;
                }
            }).catch(() => false);

            if (ready) break;
            await new Promise((r) => setTimeout(r, 200));
        }
    }
    return await originalInject();
};

console.log('Starting client initialization...');
client.initialize().then(() => {
    console.log('Client initialization promise resolved');
}).catch(async err => {
    console.error('Client initialization failed', err);
    await client.destroy().catch(() => {});
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log('(SIGINT) Shutting down...');
    await client.destroy();
    if (authStrategy.pendingLogoutCleanup) {
        try {
            await authStrategy.logout();
            console.log('Cleared logged-out session directory.');
        } catch (err) {
            console.error('Failed to clear session directory:', err);
        }
    }
    console.log('Client destroyed');
    process.exit(0);
});
