import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import fs from "fs";
import path from "path";
import TelegramBot from "node-telegram-bot-api";
import XLSX from "xlsx";

// ========== 配置 ==========
const TELEGRAM_TOKEN = "8401115053:AAG9BHUK3KOq3o7WkBnVmPB_yGeQb7hNU7o"; // 填写你的 Telegram 机器人 Token
const CHAT_ID = 8080502059; // 你的 Telegram chat_id
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const LOG_DIR = path.resolve("./logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// ========== WhatsApp 客户端 ==========
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true },
});

// 推送二维码到 Telegram
client.on("qr", (qr) => {
  console.log("请扫描二维码登录 WhatsApp");
  bot.sendMessage(CHAT_ID, "📱 请扫描登录二维码：");
  // 生成二维码图片
  import("qrcode").then(({ toBuffer }) => {
    toBuffer(qr, { type: "png" }, (err, buffer) => {
      if (!err) {
        bot.sendPhoto(CHAT_ID, buffer, { caption: "扫描二维码登录 WhatsApp" });
      }
    });
  });
});

// 登录成功
client.on("ready", async () => {
  console.log("✅ WhatsApp 登录成功！");
  bot.sendMessage(CHAT_ID, "✅ WhatsApp 已成功登录并开始监听！");
});

// 监听新成员加入
client.on("group_join", async (notification) => {
  const group = await client.getChatById(notification.chatId);
  const participant = notification.recipientIds[0];

  const logLine = `[${new Date().toLocaleString()}] 群: ${group.name} (${group.id._serialized}) 新成员: ${participant}`;
  console.log(logLine);

  // 保存到对应群的日志文件
  const logFile = path.join(LOG_DIR, `${group.name}.json`);
  let logData = [];
  if (fs.existsSync(logFile)) {
    logData = JSON.parse(fs.readFileSync(logFile));
  }
  logData.push({
    time: new Date().toISOString(),
    groupName: group.name,
    groupId: group.id._serialized,
    participant,
  });
  fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
});

// ========== Telegram 机器人 ==========
bot.onText(/\/start/, (msg) => {
  const opts = {
    reply_markup: {
      keyboard: [["🔄 更新群列表"], ["📥 下载群数据"]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
  bot.sendMessage(msg.chat.id, "欢迎使用 WhatsApp 群监控机器人！请选择操作：", opts);
});

// 更新群列表
bot.on("message", async (msg) => {
  if (msg.text === "🔄 更新群列表") {
    const chats = await client.getChats();
    const groups = chats.filter((c) => c.isGroup);

    let reply = "📋 群组列表：\n";
    groups.forEach((g, i) => {
      reply += `${i + 1}. ${g.name} (ID: ${g.id._serialized})\n`;
    });

    bot.sendMessage(msg.chat.id, reply);
  }

  // 下载群数据
  if (msg.text === "📥 下载群数据") {
    fs.readdirSync(LOG_DIR).forEach((file) => {
      if (file.endsWith(".json")) {
        const groupName = path.basename(file, ".json");
        const jsonData = JSON.parse(fs.readFileSync(path.join(LOG_DIR, file)));

        // 转 Excel
        const ws = XLSX.utils.json_to_sheet(jsonData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, groupName);

        const excelFile = path.join(LOG_DIR, `${groupName}.xlsx`);
        XLSX.writeFile(wb, excelFile);

        bot.sendDocument(msg.chat.id, excelFile, {}, { filename: `${groupName}.xlsx` });
      }
    });
  }
});

// 启动 WhatsApp 客户端
client.initialize();
