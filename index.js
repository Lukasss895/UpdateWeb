async function updateServerStatus() {
    let onlineServersCount = 0;
    let totalPlayers = 0;
    let totalMaxPlayers = 0;
    let serverListDescription = '';

    for (const srv of servers) {
        let state = null;
        try {
            state = await querySourceServer(srv.host, srv.port);
        } catch (error) {
            // Server neodpovedá
        }

        if (state) {
            onlineServersCount++;
            totalPlayers += state.players;
            totalMaxPlayers += state.maxplayers;
            serverListDescription += `🟢 **${srv.name}**\n> 🗺️ Mapa: \`${state.map}\` | 👥 Hráči: \`${state.players}/${state.maxplayers}\`\n> 🔗 \`connect ${srv.host}:${srv.port}\`\n\n`;
        } else {
            serverListDescription += `🔴 **${srv.name}**\n> ⚠️ \`OFFLINE\`\n\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle('GO:COUNTER')
        .setDescription(
            `**Servers Online:** ${onlineServersCount} / ${servers.length}\n` +
            `**Players Online:** ${totalPlayers} / ${totalMaxPlayers}\n\n` +
            `**Server List:** https://classiccounter.cc/servers\n` +
            `**Inventory:** https://eddies.cc/\n\n` +
            `-----------------------------------\n\n` +
            serverListDescription
        )
        .setColor('#2b2d31')
        .setTimestamp(); // Toto automaticky pridá čas kedy prebehol last update

    const channels = [CHANNEL_ID, CHANNEL_ID_2];

    for (const chId of channels) {
        try {
            const channel = await client.channels.fetch(chId);
            if (!channel) continue;

            const messages = await channel.messages.fetch({ limit: 10 });
            const botMsg = messages.find(m => m.author.id === client.user.id);

            if (botMsg) {
                await botMsg.edit({ embeds: [embed] });
            } else {
                await channel.send({ embeds: [embed] });
            }
        } catch (err) {
            console.error(`Chyba pri aktualizácii správy v kanáli ${chId}:`, err);
        }
    }
}
