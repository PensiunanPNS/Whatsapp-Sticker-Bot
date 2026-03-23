import dotenv from 'dotenv';
dotenv.config();

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { handleMessage } from './handler';

import ffmpegPath from '@ffmpeg-installer/ffmpeg';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox'],
    },
    ffmpegPath: ffmpegPath.path
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', handleMessage);

client.initialize();

process.on('SIGINT', async () => {
    console.log('(SIGINT) Shutting down...');
    await client.destroy();
    console.log('Client destroyed');
    process.exit(0);
});
