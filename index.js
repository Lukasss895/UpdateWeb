const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const dgram = require('dgram');
const http = require('http');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const TOKEN = process.env.DISCORD_TOKEN; 
const CHANNEL_ID = '1533114605562495128';
const CHANNEL_ID_2 = '1537207330310070392';
const WELCOME_CHANNEL_ID = '1539635519359549574';
const WELCOME_CHANEL_ID2 = '1539662948157624320';

// Tvoje servery (môžeš použiť playit.gg adresy alebo priame IP s portami)
const servers = [
    { name: 'GO:COUNTER Competitive (128-Tick)', host: '147.185.221.215', port: 40471 },
    { name: 'GO:COUNTER Retakes', host: '147.185.221.214', port: 33187 },
    { name: 'GO:COUNTER Wingman', host: '147.185.221.213', port: 6469 }
];

client.once('ready', () => {
    console.log(`Bot is logged in as ${client.user.tag}!`);
    updateServerStatus();
    setInterval(updateServerStatus, 30000);
});

client.on('guildMemberAdd', async (member) => {
    try {
        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (!channel) return;

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`👋 Welcome ${member.user.username}!`)
            .setDescription(`Welcome to the server! We're glad to join GO:Counter community.\n\nDon't forget to check the server status and set up your skins in inventory. Enjoy😊`)
            .setColor('#2ecc71')
            .setTimestamp();

        await channel.send({ embeds: [welcomeEmbed] });
    } catch (err) {
        console.error('Error sending welcome message:', err);
    }
});

// Robustná A2S query funkcia cez UDP socket s podrobným logovaním
function querySourceServer(host, port, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket('udp4');
        let timer = setTimeout(() => {
            socket.close();
            reject(new Error('Timeout - Server neodpovedal v limite 5s'));
        }, timeout);

        // Štandardný A2S_INFO query paket pre Source servery
        const payload = Buffer.concat([
            Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x54]),
            Buffer.from('Source Engine Query\0', 'ascii')
        ]);

        socket.on('message', (msg) => {
            clearTimeout(timer);
            socket.close();

            try {
                if (msg.length < 5) {
                    return reject(new Error('Príliš krátka odpoveď zo servera (dĺžka < 5 bajtov)'));
                }

                const header = msg.readUInt8(4);

                // Ak server žiada challenge token (0x41)
                if (header === 0x41) {
                    return reject(new Error('Server vyžaduje challenge token (0x41)'));
                }

                // Ak je hlavička 0x49 (I - A2S_INFO Response)
                if (header === 0x49) {
                    let offset = 5;
                    const protocol = msg.readUInt8(offset++);

                    function readString() {
                        let end = offset;
                        while (end < msg.length && msg[end] !== 0) end++;
                        const str = msg.toString('utf8', offset, end);
                        offset = end + 1;
                        return str;
                    }

                    const name = readString();
                    const map = readString();
                    const folder = readString();
                    const game = readString();
                    
                    const id = msg.readUInt16LE(offset); 
                    offset += 2;
                    
                    const players = msg.readUInt8(offset++);
                    const maxplayers = msg.readUInt8(offset++);

                    resolve({
                        name,
                        map,
                        players,
                        maxplayers
                    });
                } else {
                    reject(new Error(`Neznáma hlavička odpovede: 0x${header.toString(16)}`));
                }
            } catch (e) {
                reject(new Error('Chyba pri parsovaní odpovede: ' + e.message));
            }
        });

        socket.send(payload, port, host, (err) => {
            if (err) {
                clearTimeout(timer);
                socket.close();
                reject(err);
            }
        });
    });
}

async function updateServerStatus() {
    let description = '';

    for (const srv of servers) {
        let state = null;
        try {
            state = await querySourceServer(srv.host, srv.port);
        } catch (error) {
            console.error(`UDP query error for ${srv.name} (${srv.host}:${srv.port}):`, error.message);
        }

        if (state) {
            description += `🟢 **${srv.name}**\n`;
            description += `> **Map:** ${state.map || 'Unknown'}\n`;
            description += `> **Players:** ${state.players} / ${state.maxplayers}\n`;
            description += `**IP:** \`connect ${srv.host}:${srv.port}\`\n\n`;
        } else {
            description += `🔴 **${srv.name}**\n`;
            description += `> **Status:** OFFLINE\n\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle('📊 GO:COUNTER - Server Status')
        .setDescription(description || 'No status available.')
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

// HTTP Server pre Railway / Render health check
const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!');
});

server.listen(port, () => {
    console.log(`HTTP Web Server listening on port ${port}`);
});

if (!TOKEN) {
    console.error('ERROR: DISCORD_TOKEN is missing in environment variables!');
} else {
    client.login(TOKEN);
}
