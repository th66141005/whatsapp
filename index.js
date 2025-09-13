import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode";
import fs from "fs";
import TelegramBot from "node-telegram-bot-api";
import XLSX from "xlsx";

// ========== 配置区域 ==========
const TELEGRAM_TOKEN = "你的Telegram Bot Token";  // 🔑 填写你的 Bot Token
const CHAT_ID = 8080502059;                      // 🔑 填写你的 chat_id

// WhatsApp 客户端
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

// Telegram 机器人
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// 内存存储（群数据）
let groupMembers = {};  // { groupId: [ {id, name} ] }

// ========== WhatsApp 逻辑 ==========

// 收到二维码
client.on("qr", async (qr) => {
    console.log("📌 收到 WhatsApp 登录二维码");
    try {
        const qrImage = await qrcode.toDataURL(qr);
        await bot.sendMessage(CHAT_ID, "📱 WhatsApp 登录二维码生成！");
        await bot.sendPhoto(CHAT_ID, qrImage);
    } catch (err) {
        console.error("二维码生成失败:", err);
        await bot.sendMessage(CHAT_ID, "❌ 二维码生成失败，请检查日志。");
    }
});

// 登录成功
client.on("ready", async () => {
    console.log("✅ WhatsApp 登录成功！");
    const info = await client.info;
    await bot.sendMessage(
        CHAT_ID,
        `✅ WhatsApp 登录成功\n📱 账号: ${info.wid.user}`
    );
});

// 群成员加入事件
client.on("group_join", async (notification) => {
    const groupId = notification.id.remote;
    const contact = await notification.getContact();
    const name = contact.pushname || contact.number;

    if (!groupMembers[groupId]) groupMembers[groupId] = [];
    groupMembers[groupId].push({ id: contact.id._serialized, name });

    console.log(`👥 新成员加入群: ${groupId}, 成员: ${name}`);
    await bot.sendMessage(CHAT_ID, `👥 [${groupId}] 有新成员加入: ${name}`);
});

// ========== Telegram 控制逻辑 ==========

// 主菜单
const mainMenu = {
    reply_markup: {
        keyboard: [
            ["📋 群组列表", "🔄 更新群组"],
            ["📤 导出群组数据"]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

// /start 命令
bot.onText(/\/start/, async (msg) => {
    await bot.sendMessage(msg.chat.id, "🤖 机器人已启动，请选择操作：", mainMenu);
});

// 群组列表
bot.onText(/📋 群组列表/, async (msg) => {
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);

    if (groups.length === 0) {
        await bot.sendMessage(msg.chat.id, "❌ 暂无群组。");
        return;
    }

    let text = "📋 当前群组列表：\n";
    groups.forEach((g, i) => {
        text += `${i + 1}. ${g.name} (${g.id._serialized})\n`;
    });

    await bot.sendMessage(msg.chat.id, text);
});

// 更新群组
bot.onText(/🔄 更新群组/, async (msg) => {
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);

    for (let g of groups) {
        const participants = await g.participants;
        groupMembers[g.id._serialized] = participants.map(p => ({
            id: p.id._serialized,
            name: p.name || p.id.user
        }));
    }

    await bot.sendMessage(msg.chat.id, "🔄 群组成员信息已更新！");
});

// 导出群组数据
bot.onText(/📤 导出群组数据/, async (msg) => {
    if (Object.keys(groupMembers).length === 0) {
        await bot.sendMessage(msg.chat.id, "❌ 没有可导出的数据，请先更新群组。");
        return;
    }

    for (let [groupId, members] of Object.entries(groupMembers)) {
        const ws = XLSX.utils.json_to_sheet(members);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Members");

        const fileName = `/tmp/${groupId}.xlsx`;
        XLSX.writeFile(wb, fileName);

        await bot.sendDocument(msg.chat.id, fileName, {}, {
            filename: `${groupId}.xlsx`,
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });

        fs.unlinkSync(fileName); // 删除临时文件
    }
});

// ========== 启动 ==========
client.initialize();
console.log("🚀 服务已启动，等待 WhatsApp 登录...");
