// index.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');

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

let isCooldown = false;

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  // メッセージイベント（メンション時のみ反応）
  if (client.listenerCount('messageCreate') === 0) {
    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (!message.mentions.has(client.user)) return;
      if (isCooldown) return;

      // メンションを除いた本文だけ取り出す
      const prompt = message.content.replace(/<@!?\d+>/, '').trim();

      isCooldown = true;
      setTimeout(() => {
        isCooldown = false;
      }, 1000); // 1秒間クールダウン

      try {
        const chatCompletion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
        });

        message.reply(chatCompletion.choices[0].message.content);
      } catch (error) {
        console.error('Error:', error);
        message.reply('エラーが起きちゃった💦もう一度試してみてね。');
      }
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
