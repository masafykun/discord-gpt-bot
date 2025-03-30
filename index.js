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

let isHandlerRegistered = false;

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  if (!isHandlerRegistered) {
    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;

      try {
        const chatCompletion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: message.content }],
        });

        message.reply(chatCompletion.choices[0].message.content);
      } catch (error) {
        console.error('Error:', error);
        message.reply('エラーが起きちゃった💦もう一度試してみてね。');
      }
    });

    isHandlerRegistered = true;
  }
});

client.login(process.env.DISCORD_TOKEN);
