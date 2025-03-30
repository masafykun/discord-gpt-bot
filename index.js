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

const respondedMessages = new Set();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  // メッセージイベント（メンション時のみ反応）
  if (client.listenerCount('messageCreate') === 0) {
    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (!message.mentions.has(client.user)) return;

      // 重複対応：既に返信したメッセージは無視
      if (respondedMessages.has(message.id)) return;
      respondedMessages.add(message.id);

      // メンションを除いた本文だけ取り出す
      const prompt = message.content.replace(/<@!?\d+>/, '').trim();

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

      // メモリ削減のため1分後に削除
      setTimeout(() => {
        respondedMessages.delete(message.id);
      }, 60 * 1000);
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
