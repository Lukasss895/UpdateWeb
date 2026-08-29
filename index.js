const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GameDig } = require('gamedig');
const http = require('http'); // DÔLEŽITÉ: Musí tu byť http modul

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers // Required to detect new members joining
    ]
});

const TOKEN = process.env.name_variable;
const CHANNEL_ID = '1533114605562495128';
const CHANNEL_ID_2 = '1537207330310070392';
const WELCOME_CHANNEL_ID = '1539635519359549574'; // Špeciálny kanál pre privítanie nových hráčov
const WELCOME_CHANEL_ID2 = '1539662948157624320';

const servers = [
    { name: 'GO:COUNTER (128-Tick)', host: '147.185.221.231', port: 42131 },
    { name: 'GO:COUNTER Retakes (128-Tick)', host: '147.185.221.231', port: 27068 }
    { name: 'GO:COUNTER Hide & Seek', host: '147.185.221.231', port: 42183}
];

client.once('ready', () => {
    console.log(`Bot is logged in as ${client.user.tag}!`);
    setInterval(updateServerStatus, 30000);
});

// Automatic welcome message for new players in English
client.on('guildMemberAdd', async (member) => {
    try {
        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (!channel) return;

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`👋 Welcome ${member.user.username}!`)
            .setDescription(`Welcome to the server! We're glad to join GO:Counter community.\n\nDon't forget to check the server status and set up your skins using the \`!ws\``)
            .setColor('#2ecc71')
            .setTimestamp();

        await channel.send({ embeds: [welcomeEmbed] });
    } catch (err) {
        console.error('Error sending welcome message:', err);
    }
});

async function updateServerStatus() {
    let description = '';

    for (const srv of servers) {
        let state = null;
        try {
            state = await GameDig.query({
                type: 'csgo',
                host: srv.host,
                port: srv.port,
                maxAttempts: 2,
                socketTimeout: 3000
            });
        } catch (error) {
            // Silently catch errors for Non-Steam server to avoid console spam
        }

        if (state) {
            const playerCount = state.numplayers !== undefined ? state.numplayers : (state.players ? state.players.length : 0);

            description += `🟢 **${srv.name}**\n`;
            description += `> **Map:** ${state.map}\n`;
            description += `> **Players:** ${playerCount} / ${state.maxplayers}\n`;
            description += `**IP:** \`connect ${srv.host}:${srv.port}\`\n\n`;
        } else {
            description += `🔴 **${srv.name}**\n`;
            description += `> **Status:** OFFLINE\n\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle('📊 CS:GO 2015 - Server Status')
        .setDescription(description)
        .setColor('#4a90e2')
        .setTimestamp();

    const channels = [CHANNEL_ID, CHANNEL_ID_2];

    for (const chId of channels) {
        try {
            const channel = await client.channels.fetch(chId);
            if (!channel) continue;

            const messages = await channel.messages.fetch({ limit: 5 });
            const botMsg = messages.find(m => m.author.id === client.user.id);

            if (botMsg) {
                await botMsg.edit({ embeds: [embed] });
            } else {
                await channel.send({ embeds: [embed] });
            }
        } catch (err) {
            console.error(`Error sending message to channel ${chId}:`, err);
        }
    }
}

// DÔLEŽITÉ: HTTP server pre Render, aby služba nespadla
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!');
});
server.listen(process.env.PORT || 3000);

client.login(TOKEN);
