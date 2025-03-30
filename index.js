// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Routes, SlashCommandBuilder, REST, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const OpenAI = require('openai');
const fetch = require('node-fetch');
const express = require('express');
const fs = require('fs');
const path = require('path');

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

const app = express();
const galleryFile = path.join(__dirname, 'generated_images.json');

// HTMLテンプレート生成
function generateGalleryHtml(images) {
  return `
    <html>
      <head>
        <title>AI Art Gallery</title>
        <style>
          body { font-family: sans-serif; background: #f4f4f4; padding: 20px; }
          h1 { text-align: center; }
          .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
          .item { background: white; padding: 10px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .item img { width: 100%; height: auto; max-height: 300px; object-fit: contain; border-radius: 6px; }
          .prompt { font-weight: bold; margin-top: 10px; }
          .timestamp { color: #777; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <h1>🎨 AI Art Gallery</h1>
        <div class="gallery">
          ${images.map(img => `
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

// ギャラリー表示
app.get('/', (_, res) => {
  fs.readFile(galleryFile, 'utf-8', (err, data) => {
    if (err) return res.send('🎨 ギャラリーはまだ空です');
    const images = JSON.parse(data);
    res.send(generateGalleryHtml(images.reverse()));
  });
});

app.listen(process.env.PORT || 3000);

const respondedMessages = new Set();

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // スラッシュコマンド登録
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

      // ギャラリーデータに保存
      const newImage = {
        url: imageUrl,
        prompt,
        timestamp: new Date().toISOString()
      };

      let images = [];
      if (fs.existsSync(galleryFile)) {
        images = JSON.parse(fs.readFileSync(galleryFile, 'utf-8'));
      }
      images.push(newImage);
      fs.writeFileSync(galleryFile, JSON.stringify(images, null, 2));

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
