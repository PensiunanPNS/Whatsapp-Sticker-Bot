import { Client, Message, MessageMedia } from 'whatsapp-web.js';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

/**
 * Custom media download that bypasses the broken Store.Msg.get() lookup.
 * Instead of looking up the message by ID in the browser Store (which fails
 * due to WhatsApp Web's ID format change), we pass the media properties
 * directly from the message data and call the download manager ourselves.
 */
async function downloadMediaDirect(msg: Message): Promise<MessageMedia | null> {
    const client = (msg as any).client as Client;
    const rawData = (msg as any)._data;

    if (!rawData || !rawData.directPath) {
        return null;
    }

    const mediaInfo = {
        directPath: rawData.directPath,
        encFilehash: rawData.encFilehash,
        filehash: rawData.filehash,
        mediaKey: rawData.mediaKey,
        mediaKeyTimestamp: rawData.mediaKeyTimestamp,
        type: rawData.type,
        mimetype: rawData.mimetype,
        filename: rawData.filename,
        size: rawData.size,
    };

    const result = await (client as any).pupPage.evaluate(async (info: any) => {
        try {
            const mockQpl = {
                addAnnotations: function () { return this; },
                addPoint: function () { return this; }
            };
            const decryptedMedia = await (window as any).Store.DownloadManager.downloadAndMaybeDecrypt({
                directPath: info.directPath,
                encFilehash: info.encFilehash,
                filehash: info.filehash,
                mediaKey: info.mediaKey,
                mediaKeyTimestamp: info.mediaKeyTimestamp,
                type: info.type,
                signal: (new AbortController).signal,
                downloadQpl: mockQpl
            });

            const data = await (window as any).WWebJS.arrayBufferToBase64Async(decryptedMedia);

            return {
                data,
                mimetype: info.mimetype,
                filename: info.filename,
                filesize: info.size
            };
        } catch (e: any) {
            if (e.status && e.status === 404) return null;
            throw e;
        }
    }, mediaInfo);

    if (!result) return null;
    return new MessageMedia(result.mimetype, result.data, result.filename, result.filesize);
}

export const handleMessage = async (msg: Message) => {
    let targetMsg = msg;
    if (msg.hasQuotedMsg) {
        try {
            targetMsg = await msg.getQuotedMessage();
        } catch (err) {
            console.error('Error getting quoted message:', err);
            await msg.reply('Gagal mengambil pesan yang direply. Coba kirim ulang medianya dengan caption /sticker.');
            return;
        }
    }

    if (msg.body === '/sticker') {
        if (targetMsg.hasMedia) {
            try {
                // Try our custom direct download first, fall back to library method
                let media: MessageMedia | null | undefined = null;
                try {
                    media = await downloadMediaDirect(targetMsg);
                    console.log('Media downloaded via direct method');
                } catch (directErr) {
                    console.warn('Direct download failed, trying library method:', directErr);
                    media = await targetMsg.downloadMedia();
                }

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
                } else {
                    await msg.reply('Gagal mendownload media. Coba kirim ulang medianya.');
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
