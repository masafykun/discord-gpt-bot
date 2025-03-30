// index.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: message.content }],
    });

    const reply = response.data.choices[0].message.content;
    message.reply(reply);
  } catch (error) {
    console.error('Error from OpenAI or Discord:', error);
    message.reply('エラーが発生しました。もう一度試してね。');
  }
});

client.login(process.env.DISCORD_TOKEN);
