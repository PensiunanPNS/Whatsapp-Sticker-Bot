# BotWa - WhatsApp Sticker Bot

A simple WhatsApp bot built with Node.js and TypeScript that automatically converts received images, GIFs, and videos into WhatsApp stickers.

## Tech Stack

This project is built using the following core technologies:

*   **[Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/)**: The runtime environment and language, providing static typing and modern JavaScript features.
*   **[whatsapp-web.js](https://wwebjs.dev/)**: The core engine. It automates a headless WhatsApp Web browser instance using Puppeteer to send and receive messages.
*   **[fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)** & **@ffmpeg-installer/ffmpeg**: Handles the heavy lifting of processing and converting media formats into the WebP format required for WhatsApp animated stickers.
*   **[qrcode-terminal](https://www.npmjs.com/package/qrcode-terminal)**: Used to generate and display the WhatsApp Web authentication QR code directly in the terminal so you can scan it with your phone.
*   **dotenv**: For managing environment configurations securely (like sticker metadata and caching preferences).
*   **mime-types**: To accurately determine the file extension of incoming media before processing.

## Features

*   **Image to Sticker**: Send an image with the caption `/sticker`, or reply to an image with `/sticker` to convert it.
*   **Video/GIF to Sticker**: Send a short video or GIF with the caption `/sticker` to convert into an animated sticker.
*   **Reply-to-Media**: Reply to any existing media message with `/sticker` to generate a sticker from it.
*   **Custom Metadata**: Stickers are created with a customizable Author and Pack Name configured via `.env`.
*   **Caching (Optional)**: Can be configured to save processed media to a local `cache/` directory.

## Getting Started

1. Clone the repository.
2. Run `npm install` to install all dependencies.
3. Copy `.env.example` to `.env` and fill in your details.
4. Run `npm run build` to compile the TypeScript code.
5. Run `npm start` to start the bot.
6. Scan the QR code shown in the terminal with your WhatsApp app (Linked Devices).
