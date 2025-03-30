// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Routes, SlashCommandBuilder, REST, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const OpenAI = require('openai');
const fetch = require('node-fetch');

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
      n: 1
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

client.login(process.env.DISCORD_TOKEN);
