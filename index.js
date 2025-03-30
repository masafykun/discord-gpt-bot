// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Routes, SlashCommandBuilder, REST, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const OpenAI = require('openai');
const fetch = require('node-fetch');
const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SHEET_ID = process.env.SHEET_ID;
const CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS);

const auth = new google.auth.GoogleAuth({
  credentials: CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const app = express();

function generateGalleryHtml(rows) {
  const images = rows.map(([url, prompt, timestamp]) => ({ url, prompt, timestamp }));
  return `
    <html>
      <head>
        <title>AI Art Gallery</title>
        <style>
          body { font-family: sans-serif; background: #f4f4f4; padding: 20px; }
          h1 { text-align: center; }
          .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
          .item { background: white; padding: 10px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .item img { width: 100%; height: auto; max-height: 300px; object-fit: contain; border-radius: 6px; cursor: pointer; }
          .prompt { font-weight: bold; margin-top: 10px; }
          .timestamp { color: #777; font-size: 0.9em; }
        </style>
        <script>
          document.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG') {
              const src = e.target.src;
              const modal = document.createElement('div');
              modal.style.position = 'fixed';
              modal.style.top = 0;
              modal.style.left = 0;
              modal.style.width = '100%';
              modal.style.height = '100%';
              modal.style.background = 'rgba(0,0,0,0.8)';
              modal.style.display = 'flex';
              modal.style.alignItems = 'center';
              modal.style.justifyContent = 'center';
              modal.innerHTML = '<img src="' + src + '" style="max-width:90%; max-height:90%; border-radius:10px; box-shadow:0 0 20px #000">';
              modal.addEventListener('click', () => modal.remove());
              document.body.appendChild(modal);
            }
          });
        </script>
      </head>
      <body>
        <h1>🎨 AI Art Gallery</h1>
        <div class="gallery">
          ${images.reverse().map(img => `
            <div class="item">
              <img src="${img.url}" alt="image">
              <div class="prompt">${img.prompt}</div>
              <div class="timestamp">${new Date(img.timestamp).toLocaleString()}</div>
            </div>
          `).join('')}
        </div>
      </body>
    </html>
  `;
}

app.get('/', async (_, res) => {
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'A2:C',
    });
    const rows = result.data.values || [];
    res.send(generateGalleryHtml(rows));
  } catch (err) {
    console.error('❌ スプレッドシート読み込み失敗:', err);
    res.status(500).send('ギャラリーの読み込み中にエラーが発生しました');
  }
});

app.listen(process.env.PORT || 3000);

const respondedMessages = new Set();

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('image')
      .setDescription('プロンプトに基づいて画像を生成します')
      .addStringOption(option =>
        option.setName('prompt')
          .setDescription('生成したい画像の説明')
          .setRequired(true)
      )
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ スラッシュコマンドを登録しました');
  } catch (err) {
    console.error('❌ コマンド登録失敗:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'image') {
    const prompt = interaction.options.getString('prompt');
    await interaction.reply('🖼 画像を生成中です…');

    try {
      const res = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024'
      });

      const imageUrl = res.data[0].url;

      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'A:C',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[imageUrl, prompt, new Date().toISOString()]]
        }
      });

      const imageRes = await fetch(imageUrl);
      const imageBuffer = await imageRes.buffer();
      const file = new AttachmentBuilder(imageBuffer, { name: 'image.png' });

      const embed = new EmbedBuilder()
        .setTitle('🧠 DALL·E 画像生成')
        .setDescription(`プロンプト: \`${prompt}\``)
        .setImage('attachment://image.png')
        .setColor(0x00bfff);

      await interaction.editReply({ content: '✅ 画像が完成しました！', embeds: [embed], files: [file] });
    } catch (error) {
      console.error('❌ 画像生成エラー:', error);
      await interaction.editReply('画像の生成中にエラーが発生しました…');
    }
  }
});

client.on('messageCreate', async (message) => {
  console.log(`📩 受信: ${message.id} from ${message.author.tag} — ${message.content}`);

  if (message.author.bot) return;
  if (!message.mentions.has(client.user)) return;
  if (respondedMessages.has(message.id)) return;

  respondedMessages.add(message.id);
  const prompt = message.content.replace(/<@!?\d+>/, '').trim();

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      n: 1
    });

    const reply = chatCompletion.choices?.[0]?.message?.content ?? '（応答が取得できませんでした）';
    message.reply(reply);
  } catch (error) {
    console.error('❌ OpenAIエラー:', error);
    message.reply('エラーが起きちゃった💦もう一度試してみてね。');
  }

  setTimeout(() => respondedMessages.delete(message.id), 60 * 1000);
});

client.login(process.env.DISCORD_TOKEN);
