# discord-gpt-bot

> Discord × OpenAI を組み合わせたチャット & 画像生成ボット

## 概要

Discord.js と OpenAI API を使った Discord ボットです。
テキストチャットへの返答（GPT-3.5-turbo）と、スラッシュコマンドによる画像生成（DALL·E 3）の2つの機能を持ちます。

- ボットへのメンションでAIが返答
- `/image` スラッシュコマンドでプロンプトから画像を DALL·E 3 で生成
- 生成した画像は Google スプレッドシートに記録され、Express サーバーでギャラリーとして公開

## 使用技術

- Node.js
- Discord.js v14
- OpenAI API（GPT-3.5-turbo, DALL·E 3）
- Google Sheets API（googleapis）
- Express

## 動作環境 / 注意事項

- Node.js 16.x 以上推奨
- 環境変数（`.env`）に以下を設定してください
  - `DISCORD_TOKEN`
  - `OPENAI_API_KEY`
  - `SHEET_ID`
  - `GOOGLE_CREDENTIALS`（Google サービスアカウントの JSON）
- `npm install` 後に `npm start` で起動

## ライセンス

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

このプロジェクトは **MIT ライセンス** のもとで公開しています。  
使用・参考にした際はできる限り作者へのクレジット表記をお願いします。

© 2025 masafykun (https://github.com/masafykun)
