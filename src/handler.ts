import { Message, MessageMedia } from 'whatsapp-web.js';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

export const handleMessage = async (msg: Message) => {
    let targetMsg = msg;
    if (msg.hasQuotedMsg) {
        targetMsg = await msg.getQuotedMessage();
    }

    if (msg.body === '/sticker') {
        if (targetMsg.hasMedia) {
            try {
                const media = await targetMsg.downloadMedia();
                if (media) {
                    let stickerMedia = media;

                    // Save to cache (optional, set SAVE_CACHE=true in .env to enable)
                    if (process.env.SAVE_CACHE === 'true') {
                        const extension = mime.extension(media.mimetype) || 'bin';
                        const filename = `${new Date().getTime()}.${extension}`;
                        const filepath = path.join(__dirname, '../cache', filename);
                        fs.writeFileSync(filepath, media.data, 'base64');
                        console.log(`Saved media to ${filepath}`);
                        stickerMedia = MessageMedia.fromFilePath(filepath);
                    }

                    // Send as sticker
                    await msg.reply(stickerMedia, undefined, {
                        sendMediaAsSticker: true,
                        stickerAuthor: process.env.STICKER_AUTHOR || 'BotWa',
                        stickerName: process.env.STICKER_NAME || 'Sticker'
                    });
                    console.log(`Sent sticker to ${msg.from}`);
                }
            } catch (error) {
                console.error('Error handling media:', error);
                await msg.reply('Gagal memproses media. Coba lagi nanti.');
            }
        } else {
            await msg.reply('Kirim gambar/video dengan caption /sticker, atau reply gambar/video dengan /sticker.');
        }
    } else if (msg.body === '/ping') {
        const receivedTime = msg.timestamp * 1000;
        const processTime = Date.now();
        const latency = processTime - receivedTime;
        await msg.reply(`${latency}ms`);
        console.log(`User ${msg.from} checked latency`);
    } else if (msg.body === '/help') {
        const helpText = `*Bot Kepin Commands*\n\n` +
            `*/sticker*\n` +
            `- Kirim gambar/video dengan caption */sticker*\n` +
            `- Atau reply gambar/video dengan */sticker*\n\n` +
            `*/ping*\n` +
            `- Cek bot latency\n\n` +
            `*/help*\n` +
            `- Tampilkan pesan ini`;
        await msg.reply(helpText);
        console.log(`User ${msg.from} asked for help`);
    }
};
