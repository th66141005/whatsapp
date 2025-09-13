import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import XLSX from "xlsx";

// Telegram 机器人配置
const TELEGRAM_TOKEN = "你的Telegram Bot Token";
const CHAT_ID = 8080502059; // 你刚才获取的 chat_id
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// WhatsApp 客户端
const client = new Client({
    authStrategy: new LocalAuth()
});

// 保存群成员数据
let groupMembers = {};

// 登录二维码
client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
    bot.sendMessage(CHAT_ID, "📱 WhatsApp 登录二维码生成！");
});

// 登录成功
client.on("ready", () => {
    bot.sendMessage(CHAT_ID, "✅ WhatsApp 已连接！");
});

// 监听群成员加入
client.on("group_join", (notification) => {
    const groupId = notification.chatId;
    const participant = notification.recipientIds[0];

    if (!groupMembers[groupId]) groupMembers[groupId] = [];
    groupMembers[groupId].push({ user: participant, time: new Date().toISOString() });

    bot.sendMessage(CHAT_ID, `👤 新成员加入群: ${notification.chat.name}\n用户: ${participant}`);
});

// Telegram 操作按钮
bot.onText(/\/menu/, (msg) => {
    bot.sendMessage(msg.chat.id, "请选择操作：", {
        reply_markup: {
            keyboard: [
                ["📋 群列表", "⬇️ 下载群成员数据"]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    });
});

// 群列表
bot.on("message", (msg) => {
    if (msg.text === "📋 群列表") {
        const groups = Object.keys(groupMembers);
        if (groups.length === 0) {
            bot.sendMessage(msg.chat.id, "当前没有群组数据。");
        } else {
            bot.sendMessage(msg.chat.id, "群组列表：\n" + groups.join("\n"));
        }
    }

    if (msg.text === "⬇️ 下载群成员数据") {
        const wb = XLSX.utils.book_new();
        for (const groupId in groupMembers) {
            const ws = XLSX.utils.json_to_sheet(groupMembers[groupId]);
            XLSX.utils.book_append_sheet(wb, ws, groupId.slice(0, 30));
        }
        const filename = "group_members.xlsx";
        XLSX.writeFile(wb, filename);
        bot.sendDocument(msg.chat.id, filename);
    }
});

client.initialize();
