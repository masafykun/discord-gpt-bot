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
  console.log(`✅ Logged in as ${client.user.tag}`);

  if (client.listenerCount('messageCreate') === 0) {
    client.on('messageCreate', async (message) => {
      console.log(`📩 受信: ${message.id} from ${message.author.tag} — ${message.content}`);

      if (message.author.bot) {
        console.log(`⛔ Botからのメッセージなので無視: ${message.author.tag}`);
        return;
      }

      if (!message.mentions.has(client.user)) {
        console.log('👋 メンションされていないので無視');
        return;
      }

      if (respondedMessages.has(message.id)) {
        console.log('🔁 このメッセージにはすでに返信済みです');
        return;
      }

      respondedMessages.add(message.id);

      const prompt = message.content.replace(/<@!?\d+>/, '').trim();
      console.log(`🧠 ChatGPTへ送信: ${prompt}`);

      try {
        const chatCompletion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          n: 1 // 応答は1つだけ取得
        });

        const reply = chatCompletion.choices?.[0]?.message?.content ?? '（応答が取得できませんでした）';
        console.log(`📤 GPT応答: ${reply}`);
        message.reply(reply);
      } catch (error) {
        console.error('❌ OpenAIエラー:', error);
        message.reply('エラーが起きちゃった💦もう一度試してみてね。');
      }

      setTimeout(() => {
        respondedMessages.delete(message.id);
        console.log(`🧹 メッセージID削除: ${message.id}`);
      }, 60 * 1000);
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
