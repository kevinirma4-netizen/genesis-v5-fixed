require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
    Client,
    GatewayIntentBits,
    ActivityType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    MessageFlags
} = require('discord.js');

/* =========================================================
   Black Dragons V18 • FIXED
========================================================= */

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

/* =========================================================
   CONFIG
========================================================= */

const TOKEN = String(
    process.env.TOKEN ||
    process.env.DISCORD_TOKEN ||
    ''
)
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^Bot\s+/i, '');

const MAX_PLAYERS = 10;

const SCRIM_POSITIONS = [
    'CF',
    'CM',
    'GK',
    'RW',
    'LW'
];

const SCRIM_COUNTDOWN = 2 * 60 * 1000;
const SCRIM_RANDOM_DELAY = 1500;
const READY_TICK = 5000;
const MAX_RESULT_ROUNDS = 6;

const GOLD = 0xD9B45C;
const GREEN = 0x5BC47B;
const RED = 0xB84949;
const BLUE = 0x4B9BE8;
const PURPLE = 0x8B6FB6;

const DEFAULT_BANNER =
    'https://ibb.co/SD3XbJng ';

function cleanString(value) {
    return String(value || '')
        .trim()
        .replace(/^["']|["']$/g, '');
}

function cleanId(value) {
    const id = cleanString(value);

    return /^\d{17,20}$/.test(id)
        ? id
        : '';
}

function usableUrl(url) {
    try {
        const parsed = new URL(url);

        return (
            /^https?:$/i.test(parsed.protocol) &&
            !/^(www\.)?ibb\.co$/i.test(
                parsed.hostname
            )
        );
    } catch {
        return false;
    }
}

const envBanner =
    cleanString(process.env.BANNER_URL);

const BANNER_URL =
    usableUrl(envBanner)
        ? envBanner
        : DEFAULT_BANNER;

/* =========================================================
   ROLES
========================================================= */

const TRYOUT_HOSTER_ROLE_ID =
    cleanId(process.env.TRYOUT_HOSTER_ROLE_ID);

const TRYOUT_PING_ROLE_ID =
    cleanId(process.env.TRYOUT_PING_ROLE_ID);

const MAIN_TEAM_ROLE_ID =
    cleanId(process.env.MAIN_TEAM_ROLE_ID);

const FRIENDLY_SCRIM_PING_ROLE_ID =
    cleanId(
        process.env.FRIENDLY_SCRIM_PING_ROLE_ID
    );

const ELO_SCRIM_PING_ROLE_ID =
    cleanId(
        process.env.ELO_SCRIM_PING_ROLE_ID
    );

const MEMBERS_ROLE_ID =
    cleanId(
        process.env.MEMBERS_ROLE_ID
    );

const RANK_ROLE_IDS = {
    F: cleanId(process.env.AURE_RANK_F_ROLE_ID),
    C: cleanId(process.env.AURE_RANK_C_ROLE_ID),
    B: cleanId(process.env.AURE_RANK_B_ROLE_ID),
    A: cleanId(process.env.AURE_RANK_A_ROLE_ID),
    S: cleanId(process.env.AURE_RANK_S_ROLE_ID)
};

if (!TOKEN) {
    console.error(
        '❌ TOKEN / DISCORD_TOKEN missing.'
    );

    process.exit(1);
}

/* =========================================================
   STORAGE
========================================================= */

const DATA_DIR =
    path.join(
        __dirname,
        'data'
    );

const PLAYER_FILE =
    path.join(
        DATA_DIR,
        'player-results.json'
    );

const SCRIM_RESULTS_FILE =
    path.join(
        DATA_DIR,
        'scrim-results.json'
    );

fs.mkdirSync(
    DATA_DIR,
    {
        recursive: true
    }
);

function loadJson(
    file,
    fallback
) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(
                file,
                JSON.stringify(
                    fallback,
                    null,
                    2
                ),
                'utf8'
            );

            return fallback;
        }

        return JSON.parse(
            fs.readFileSync(
                file,
                'utf8'
            ) || JSON.stringify(fallback)
        );
    } catch {
        return fallback;
    }
}

function saveJson(
    file,
    value
) {
    try {
        fs.writeFileSync(
            file,
            JSON.stringify(
                value,
                null,
                2
            ),
            'utf8'
        );
    } catch (error) {
        console.error(
            '❌ Save error:',
            error.message
        );
    }
}

let playerResults =
    loadJson(
        PLAYER_FILE,
        {}
    );

let scrimResults =
    loadJson(
        SCRIM_RESULTS_FILE,
        []
    );

if (!Array.isArray(scrimResults)) {
    scrimResults = [];
}

/* =========================================================
   RUNTIME MAPS
========================================================= */

const tryouts =
    new Map();

const scrims =
    new Map();

const announcements =
    new Map();

const pendingAnnouncements =
    new Map();

const resultDrafts =
    new Map();

const scrimResultSessions =
    new Map();

/* =========================================================
   HELPERS
========================================================= */

function mentionUser(
    id
) {
    return `<@${id}>`;
}

function mentionRole(
    id
) {
    return `<@&${id}>`;
}

function hasRole(
    member,
    roleId
) {
    return Boolean(
        member &&
        roleId &&
        member.roles?.cache?.has(
            roleId
        )
    );
}

function isHoster(
    member
) {
    return hasRole(
        member,
        TRYOUT_HOSTER_ROLE_ID
    );
}

function isMainTeam(
    member
) {
    return hasRole(
        member,
        MAIN_TEAM_ROLE_ID
    );
}

function timeLeft(
    ms
) {
    const seconds =
        Math.max(
            0,
            Math.ceil(
                ms / 1000
            )
        );

    const minutes =
        Math.floor(
            seconds / 60
        );

    const remaining =
        seconds % 60;

    if (minutes <= 0) {
        return `${remaining}s`;
    }

    if (remaining === 0) {
        return `${minutes}m`;
    }

    return `${minutes}m ${remaining}s`;
}

function getRank(
    overall
) {
    const n =
        Number(overall) || 0;

    if (n >= 90) return 'S';
    if (n >= 80) return 'A';
    if (n >= 70) return 'B';
    if (n >= 60) return 'C';

    return 'F';
}

function rankText(
    rank
) {
    return (
        {
            S: 'S • ELITE',
            A: 'A • ADVANCED',
            B: 'B • STRONG',
            C: 'C • DEVELOPING',
            F: 'F • BEGINNER'
        }[rank] ||
        rank
    );
}

function positionEmoji(
    position
) {
    return (
        {
            CF: '⚽',
            CM: '🎯',
            GK: '🧤',
            RW: '🏃',
            LW: '💨'
        }[position] ||
        '⚽'
    );
}

function setBanner(
    embed
) {
    if (
        usableUrl(
            BANNER_URL
        )
    ) {
        embed.setImage(
            BANNER_URL
        );
    }

    return embed;
}

function getMembersRole(
    guild
) {
    if (MEMBERS_ROLE_ID) {
        return (
            guild.roles.cache.get(
                MEMBERS_ROLE_ID
            ) ||
            null
        );
    }

    return (
        guild.roles.cache.find(
            role => {
                const name =
                    role.name
                        .toLowerCase()
                        .trim();

                return (
                    name === 'members' ||
                    name === '@members'
                );
            }
        ) ||
        null
    );
}

function updatePresence() {
    try {
        if (!client.user) {
            return;
        }

        client.user.setPresence({
            status: 'online',

            activities: [
                {
                    name:
                        `Striker Z • ${tryouts.size}T / ${scrims.size}S`,

                    type:
                        ActivityType.Watching
                }
            ]
        });
    } catch {}
}

function validServerLink(
    link
) {
    return /^https:\/\/\S+$/i.test(
        String(link || '').trim()
    );
}

/* =========================================================
   PLAYER DATA
========================================================= */

function normalizePlayer(
    raw
) {
    if (
        !raw ||
        typeof raw !== 'object'
    ) {
        return null;
    }

    const history =
        Array.isArray(
            raw.history
        )
            ? raw.history
            : [];

    const overall =
        Number(
            raw.overall
        ) || 0;

    return {
        type:
            raw.type === 'gk'
                ? 'gk'
                : 'striker',

        position:
            raw.position ||
            (
                raw.type === 'gk'
                    ? 'GK'
                    : 'CF'
            ),

        shooting:
            Number(
                raw.shooting
            ) || 0,

        passing:
            Number(
                raw.passing
            ) || 0,

        teamwork:
            Number(
                raw.teamwork
            ) || 0,

        defending:
            Number(
                raw.defending
            ) || 0,

        goalkeeping:
            Number(
                raw.goalkeeping
            ) || 0,

        reactionTime:
            Number(
                raw.reactionTime
            ) || 0,

        gk:
            raw.gk === null ||
            raw.gk === undefined ||
            raw.gk === ''
                ? null
                : Number(
                    raw.gk
                ) || 0,

        overall,

        rank:
            raw.rank ||
            getRank(
                overall
            ),

        thingsToFix:
            String(
                raw.thingsToFix ||
                ''
            ),

        updatedAt:
            raw.updatedAt ||
            null,

        history,

        tryoutsCompleted:
            Number(
                raw.tryoutsCompleted
            ) ||
            history.length,

        bestOVR:
            Math.max(
                Number(
                    raw.bestOVR
                ) || 0,

                overall,

                ...history.map(
                    item =>
                        Number(
                            item?.overall
                        ) || 0
                )
            )
    };
}

function playerData(
    userId
) {
    return normalizePlayer(
        playerResults[
            userId
        ]
    );
}

/* =========================================================
   TRYOUT EMBEDS
========================================================= */

function tryoutEmbed(
    lobby
) {
    const players =
        lobby.players.length
            ? lobby.players
                .map(
                    (
                        id,
                        index
                    ) =>
                        `**${index + 1}.** ${mentionUser(id)}`
                )
                .join(
                    '\n'
                )
            : '`Waiting for players...`';

    const progress =
        Math.round(
            (
                lobby.players.length /
                MAX_PLAYERS
            ) *
            10
        );

    const bar =
        '▰'.repeat(
            progress
        ) +
        '▱'.repeat(
            10 -
                progress
        );

    let server =
        '🔒 Hidden until 10/10 players.';

    if (
        lobby.players.length ===
        MAX_PLAYERS
    ) {
        server =
            lobby.serverLink
                ? `[🔗 JOIN PRIVATE SERVER](${lobby.serverLink})`
                : '⚠️ 10/10 reached — server link not added yet.';
    }

    return setBanner(
        new EmbedBuilder()
            .setColor(
                GOLD
            )
            .setAuthor({
                name:
                    '𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕�'
            })
            .setTitle(
                'ᴛʀʏᴏᴜᴛ ʜᴜʙ'
            )
            .setDescription(
                `✦ **L O B B Y** ✦

👑 **Host**
${mentionUser(lobby.hostId)}

👥 **Players**
**${lobby.players.length}/${MAX_PLAYERS}**
${bar}

━━━━━━━━━━━━━━━━━━━━━━━━

**PLAYER LIST**
${players}`
            )
            .addFields({
                name:
                    '🔗 SERVER',

                value:
                    server,

                inline:
                    false
            })
            .setFooter({
                text:
                    '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • E U ✦'
            })
            .setImage(
                BANNER_URL
            )
    );
}

function tryoutButtons(
    lobby
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `tryout_join:${lobby.messageId}`
                    )
                    .setLabel(
                        'JOIN'
                    )
                    .setEmoji(
                        '⚡'
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        lobby.players.length >=
                        MAX_PLAYERS
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `tryout_leave:${lobby.messageId}`
                    )
                    .setLabel(
                        'LEAVE'
                    )
                    .setEmoji(
                        '↩️'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `tryout_link:${lobby.messageId}`
                    )
                    .setLabel(
                        'SERVER LINK'
                    )
                    .setEmoji(
                        '🔗'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `tryout_close:${lobby.messageId}`
                    )
                    .setLabel(
                        'CLOSE'
                    )
                    .setEmoji(
                        '❌'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            )
    ];
}

async function updateTryout(
    lobby
) {
    try {
        const channel =
            await client.channels.fetch(
                lobby.channelId
            );

        const message =
            await channel.messages.fetch(
                lobby.messageId
            );

        await message.edit({
            embeds: [
                tryoutEmbed(
                    lobby
                )
            ],

            components:
                tryoutButtons(
                    lobby
                )
        });
    } catch {}
}

/* =========================================================
   ANNOUNCEMENTS
========================================================= */

function announcementEmbed(
    a
) {
    const remaining =
        a.phase === 'extension'
            ? timeLeft(
                a.extensionEnd -
                Date.now()
            )
            : timeLeft(
                a.endTime -
                Date.now()
            );

    const readyList =
        a.ready.length
            ? a.ready
                .map(
                    (
                        id,
                        index
                    ) =>
                        `**${String(index + 1).padStart(2, '0')}.** ${mentionUser(id)}`
                )
                .join(
                    '\n'
                )
            : '`No players marked ready yet.`';

    return setBanner(
        new EmbedBuilder()
            .setColor(
                GOLD
            )
            .setAuthor({
                name:
                    '𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕�� • ᴀɴɴᴏᴜɴᴄᴇ'
            })
            .setTitle(
                a.phase ===
                    'extension'
                    ? '⚠️ EXTENSION ACTIVE'
                    : a.warning
                        ? '⚠️ CLOSING SOON'
                        : '✦ TRYOUT OPEN'
            )
            .setDescription(
                `> **${remaining}** remaining

👑 **Host**
${mentionUser(a.hostId)}

━━━━━━━━━━━━━━━━━━━━━━━━

⚡ **READY — ${a.ready.length}/${MAX_PLAYERS}**

${readyList}` +
                (
                    a.customMessage
                        ? `

━━━━━━━━━━━━━━━━━━━━━━━━

💬 **MESSAGE**

${a.customMessage}`
                        : ''
                )
            )
            .setFooter({
                text:
                    '✦ READY • NOT READY • RE-PING • 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� ✦'
            })
    );
}

function announcementButtons(
    a
) {
    const row = [
        new ButtonBuilder()
            .setCustomId(
                `announcement_ready:${a.messageId}`
            )
            .setLabel(
                `READY ${a.ready.length}/${MAX_PLAYERS}`
            )
            .setStyle(
                ButtonStyle.Success
            ),

        new ButtonBuilder()
            .setCustomId(
                `announcement_notready:${a.messageId}`
            )
            .setLabel(
                'NOT READY'
            )
            .setStyle(
                ButtonStyle.Secondary
            )
    ];

    if (
        a.warning ||
        a.phase ===
            'extension'
    ) {
        row.push(
            new ButtonBuilder()
                .setCustomId(
                    `announcement_reping:${a.messageId}`
                )
                .setLabel(
                    'RE-PING'
                )
                .setStyle(
                    ButtonStyle.Primary
                )
                .setDisabled(
                    a.repingUsed
                )
        );
    }

    return [
        new ActionRowBuilder()
            .addComponents(
                row
            )
    ];
}

async function updateAnnouncement(
    a
) {
    try {
        const channel =
            await client.channels.fetch(
                a.channelId
            );

        const message =
            await channel.messages.fetch(
                a.messageId
            );

        await message.edit({
            embeds: [
                announcementEmbed(
                    a
                )
            ],

            components:
                announcementButtons(
                    a
                )
        });
    } catch {}
}

async function pingTryoutRole(
    a
) {
    if (
        !TRYOUT_PING_ROLE_ID
    ) {
        return;
    }

    try {
        const channel =
            await client.channels.fetch(
                a.channelId
            );

        await channel.send({
            content:
                mentionRole(
                    TRYOUT_PING_ROLE_ID
                ),

            allowedMentions: {
                roles: [
                    TRYOUT_PING_ROLE_ID
                ]
            }
        });
    } catch {}
}

setInterval(
    async () => {
        const now =
            Date.now();

        for (
            const [
                messageId,
                a
            ] of announcements
        ) {
            if (
                a.phase ===
                    'initial' &&
                now >=
                    a.endTime
            ) {
                if (
                    !a.warning
                ) {
                    a.warning =
                        true;

                    await updateAnnouncement(
                        a
                    );
                } else {
                    a.phase =
                        'extension';

                    if (
                        !a.repingStarted
                    ) {
                        a.extensionEnd =
                            now +
                            2 *
                                60 *
                                1000;

                        a.repingStarted =
                            true;

                        await updateAnnouncement(
                            a
                        );

                        await pingTryoutRole(
                            a
                        );
                    }
                }
            } else if (
                a.phase ===
                    'extension' &&
                now >=
                    a.extensionEnd
            ) {
                try {
                    const channel =
                        await client.channels.fetch(
                            a.channelId
                        );

                    const message =
                        await channel.messages.fetch(
                            messageId
                        );

                    await message.delete();
                } catch {}

                announcements.delete(
                    messageId
                );
            }
        }
    },
    5000
);

/* =========================================================
   SCRIM EMBEDS
========================================================= */

function scrimTypeText(
    type
) {
    return type ===
        'elo'
        ? '🔴 ELO SCRIM'
        : '🟢 FRIENDLY SCRIM';
}

function scrimChooseEmbed(
    scrim
) {
    return setBanner(
        new EmbedBuilder()
            .setColor(
                GOLD
            )
            .setAuthor({
                name:
                    '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • S C R I M ✦'
            })
            .setTitle(
                '◇ CHOOSE SCRIM TYPE'
            )
            .setDescription(
                `╭──────────────────────────────╮
│       **CHOOSE SCRIM TYPE**     │
╰──────────────────────────────╯

🟢 **FRIENDLY**
> Everyone can participate.
> Rank does not matter.

🔴 **ELO**
> Main Team players only.
> Requires Main Team.

━━━━━━━━━━━━━━━━━━━━━━━━

👑 **Host**
${mentionUser(scrim.hostId)}`
            )
            .setFooter({
                text:
                    '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • E U ✦'
            })
    );
}

function scrimTypeButtons() {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        'scrim_type:friendly'
                    )
                    .setLabel(
                        'FRIENDLY'
                    )
                    .setEmoji(
                        '🟢'
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'scrim_type:elo'
                    )
                    .setLabel(
                        'ELO'
                    )
                    .setEmoji(
                        '🔴'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            )
    ];
}

function allPositionsFilled(
    scrim
) {
    return SCRIM_POSITIONS.every(
        position =>
            scrim.players.some(
                player =>
                    player.position ===
                    position
            )
    );
}

function scrimCountdown(
    scrim
) {
    if (
        !allPositionsFilled(
            scrim
        )
    ) {
        const missing =
            SCRIM_POSITIONS.filter(
                position =>
                    !scrim.players.some(
                        player =>
                            player.position ===
                            position
                    )
            );

        return (
            '⏳ **Waiting for:** ' +
            missing
                .map(
                    position =>
                        `${positionEmoji(position)} ${position}`
                )
                .join(
                    ' • '
                )
        );
    }

    if (
        scrim.countdownEnd
    ) {
        const remaining =
            scrim.countdownEnd -
            Date.now();

        if (
            remaining > 0
        ) {
            return `⏱️ **Random pick starts in ${timeLeft(remaining)}**`;
        }
    }

    return '🎲 **Random selection starting...**';
}

function scrimPositionEmbed(
    scrim
) {
    const lineup =
        SCRIM_POSITIONS
            .map(
                position => {
                    const members =
                        scrim.players
                            .filter(
                                player =>
                                    player.position ===
                                    position
                            )
                            .map(
                                player =>
                                    mentionUser(
                                        player.id
                                    )
                            )
                            .join(
                                ', '
                            ) ||
                        '`— empty —`';

                    return (
                        `${positionEmoji(position)} **${position}** — ${members}`
                    );
                }
            )
            .join('\n');

    const queue =
        scrim.players.length
            ? scrim.players
                .map(
                    (
                        player,
                        index
                    ) =>
                        `**${String(index + 1).padStart(2, '0')}.** ${mentionUser(player.id)} • **${player.position}**`
                )
                .join(
                    '\n'
                )
            : '`Waiting for players...`';

    return setBanner(
        new EmbedBuilder()
            .setColor(
                scrim.type ===
                    'elo'
                    ? RED
                    : GREEN
            )
            .setAuthor({
                name:
                    '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • S C R I M ✦'
            })
            .setTitle(
                scrimTypeText(
                    scrim.type
                )
            )
            .setDescription(
                `╭──────────────────────────────╮
│         **SELECT POSITION**     │
╰──────────────────────────────╯

You can switch position at any time before random selection.

👥 **${scrim.players.length} players**
${scrimCountdown(scrim)}

━━━━━━━━━━━━━━━━━━━━━━━━

**POSITION LINEUP**
${lineup}

━━━━━━━━━━━━━━━━━━━━━━━━

**PLAYER QUEUE**
${queue}`
            )
            .addFields({
                name:
                    '🔗 SERVER',

                value:
                    scrim.serverLink
                        ? `[🔗 JOIN SERVER](${scrim.serverLink})`
                        : '🔒 Host has not added a server link yet.',

                inline:
                    false
            })
            .setFooter({
                text:
                    '✦ CF • CM • GK • RW • LW • 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 ✦'
            })
    );
}

function scrimPositionButtons(
    scrim
) {
    const makePosition =
        position =>
            new ButtonBuilder()
                .setCustomId(
                    `scrim_position:${position}:${scrim.messageId}`
                )
                .setLabel(
                    position
                )
                .setStyle(
                    ButtonStyle.Primary
                );

    return [
        new ActionRowBuilder()
            .addComponents(
                makePosition('CF'),
                makePosition('CM'),
                makePosition('GK')
            ),

        new ActionRowBuilder()
            .addComponents(
                makePosition('RW'),
                makePosition('LW')
            ),

        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `scrim_leave:${scrim.messageId}`
                    )
                    .setLabel(
                        'LEAVE'
                    )
                    .setEmoji(
                        '↩️'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_link:${scrim.messageId}`
                    )
                    .setLabel(
                        'SERVER LINK'
                    )
                    .setEmoji(
                        '🔗'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_skip:${scrim.messageId}`
                    )
                    .setLabel(
                        'SKIP'
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        !allPositionsFilled(
                            scrim
                        )
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_close:${scrim.messageId}`
                    )
                    .setLabel(
                        'CLOSE'
                    )
                    .setEmoji(
                        '❌'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            )
    ];
}

function scrimReadyEmbed(
    scrim
) {
    const selected =
        scrim.selected
            .map(
                player => {
                    let status =
                        '❌ NOT READY';

                    if (
                        player.ready
                    ) {
                        status =
                            '✅ READY';
                    } else if (
                        player.readyAt
                    ) {
                        status =
                            `⏳ READY IN ${timeLeft(
                                player.readyAt -
                                Date.now()
                            )}`;
                    }

                    return (
                        `${positionEmoji(
                            player.position
                        )} **${player.position}** • ${mentionUser(player.id)} • ${status}`
                    );
                }
            )
            .join('\n');

    const readyCount =
        scrim.selected.filter(
            player =>
                player.ready
        ).length;

    return setBanner(
        new EmbedBuilder()
            .setColor(
                scrim.type ===
                    'elo'
                    ? RED
                    : GREEN
            )
            .setAuthor({
                name:
                    '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕  • S C R I M ✦'
            })
            .setTitle(
                '⚡ SCRIM READY CHECK'
            )
            .setDescription(
                `> **${scrimTypeText(
                    scrim.type
                )}**

╭──────────────────────────────╮
│          **READY CHECK**       │
╰──────────────────────────────╯

${selected}

━━━━━━━━━━━━━━━━━━━━━━━━

✦ **READY — ${readyCount}/5**

${
    readyCount ===
    5
        ? '🟢 **ALL SELECTED PLAYERS ARE READY**'
        : '🟡 Waiting for selected players.'
}`
            )
            .addFields({
                name:
                    '🔗 SERVER',

                value:
                    scrim.serverLink
                        ? `[🔗 JOIN SERVER](${scrim.serverLink})`
                        : '🔒 Server link is not added yet.',

                inline:
                    false
            })
            .setFooter({
                text:
                    '✦ READY • NOT READY • 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� ✦'
            })
    );
}

function scrimReadyButtons(
    scrim
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `scrim_ready:${scrim.messageId}`
                    )
                    .setLabel(
                        'READY'
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_notready:${scrim.messageId}`
                    )
                    .setLabel(
                        'NOT READY'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_link:${scrim.messageId}`
                    )
                    .setLabel(
                        'SERVER LINK'
                    )
                    .setEmoji(
                        '🔗'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_close:${scrim.messageId}`
                    )
                    .setLabel(
                        'CLOSE'
                    )
                    .setEmoji(
                        '❌'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            )
    ];
}

/* =========================================================
   SCRIM UPDATE / PING
========================================================= */

async function updateScrim(
    scrim
) {
    try {
        const channel =
            await client.channels.fetch(
                scrim.channelId
            );

        const message =
            await channel.messages.fetch(
                scrim.messageId
            );

        if (
            scrim.phase ===
            'choose'
        ) {
            await message.edit({
                embeds: [
                    scrimChooseEmbed(
                        scrim
                    )
                ],

                components:
                    scrimTypeButtons()
            });

            return;
        }

        if (
            scrim.phase ===
            'queue'
        ) {
            await message.edit({
                embeds: [
                    scrimPositionEmbed(
                        scrim
                    )
                ],

                components:
                    scrimPositionButtons(
                        scrim
                    )
            });

            return;
        }

        if (
            scrim.phase ===
            'picking'
        ) {
            await message.edit({
                embeds: [
                    setBanner(
                        new EmbedBuilder()
                            .setColor(
                                GOLD
                            )
                            .setTitle(
                                '🎲 RANDOM PICK'
                            )
                            .setDescription(
                                `> **${scrimTypeText(
                                    scrim.type
                                )}**

Selecting one player for each position.

⚽ CF
🎯 CM
🧤 GK
🏃 RW
💨 LW`
                            )
                            .setFooter({
                                text:
                                    '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • RANDOM PICK ✦'
                            })
                    )
                ],

                components: []
            });

            return;
        }

        if (
            scrim.phase ===
            'ready'
        ) {
            await message.edit({
                embeds: [
                    scrimReadyEmbed(
                        scrim
                    )
                ],

                components:
                    scrimReadyButtons(
                        scrim
                    )
            });
        }
    } catch {}
}

async function pingScrimRole(
    scrim
) {
    const roleId =
        scrim.type ===
            'elo'
            ? ELO_SCRIM_PING_ROLE_ID
            : FRIENDLY_SCRIM_PING_ROLE_ID;

    if (
        !roleId
    ) {
        return;
    }

    try {
        const channel =
            await client.channels.fetch(
                scrim.channelId
            );

        await channel.send({
            content:
                `${mentionRole(
                    roleId
                )}

✦ **𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 ${scrim.type.toUpperCase()} SCRIM OPEN**

Choose your position below.`,

            allowedMentions: {
                roles: [
                    roleId
                ]
            }
        });
    } catch {}
}

async function pingSelectedPlayers(
    scrim
) {
    if (
        !scrim.selected.length
    ) {
        return;
    }

    try {
        const channel =
            await client.channels.fetch(
                scrim.channelId
            );

        const ids =
            scrim.selected.map(
                player =>
                    player.id
            );

        const lineup =
            scrim.selected
                .map(
                    player =>
                        `${positionEmoji(
                            player.position
                        )} **${player.position}** • ${mentionUser(player.id)}`
                )
                .join('\n');

        await channel.send({
            content:
                `${ids
                    .map(
                        id =>
                            mentionUser(id)
                    )
                    .join(
                        ' '
                    )}

━━━━━━━━━━━━━━━━━━━━━━━━

✦ **𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 • SELECTED LINEUP** ✦

${lineup}

${
    scrim.serverLink
        ? `🔗 **SERVER:** ${scrim.serverLink}`
        : '🔒 **SERVER:** Not added yet.'
}`,

            allowedMentions: {
                users:
                    ids
            }
        });
    } catch {}
}

async function randomSelect(
    scrim
) {
    if (
        scrim.phase !==
            'queue' ||
        scrim.picking ||
        !allPositionsFilled(
            scrim
        )
    ) {
        return;
    }

    scrim.picking =
        true;

    scrim.phase =
        'picking';

    scrim.countdownEnd =
        null;

    await updateScrim(
        scrim
    );

    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                SCRIM_RANDOM_DELAY
            )
    );

    const selected =
        [];

    for (
        const position of
            SCRIM_POSITIONS
    ) {
        const pool =
            scrim.players.filter(
                player =>
                    player.position ===
                    position
            );

        if (
            !pool.length
        ) {
            scrim.picking =
                false;

            scrim.phase =
                'queue';

            return;
        }

        const chosen =
            pool[
                Math.floor(
                    Math.random() *
                    pool.length
                )
            ];

        selected.push({
            id:
                chosen.id,

            position,

            ready:
                false,

            readyAt:
                null
        });
    }

    scrim.selected =
        selected;

    scrim.phase =
        'ready';

    scrim.picking =
        false;

    await updateScrim(
        scrim
    );

    await pingSelectedPlayers(
        scrim
    );
}

setInterval(
    async () => {
        for (
            const scrim of
                scrims.values()
        ) {
            if (
                scrim.phase ===
                'queue'
            ) {
                if (
                    !allPositionsFilled(
                        scrim
                    )
                ) {
                    scrim.countdownEnd =
                        null;

                    continue;
                }

                if (
                    !scrim.countdownEnd
                ) {
                    scrim.countdownEnd =
                        Date.now() +
                        SCRIM_COUNTDOWN;

                    await updateScrim(
                        scrim
                    );
                } else if (
                    Date.now() >=
                    scrim.countdownEnd
                ) {
                    await randomSelect(
                        scrim
                    );
                } else {
                    await updateScrim(
                        scrim
                    );
                }
            }

            if (
                scrim.phase ===
                'ready'
            ) {
                let changed =
                    false;

                for (
                    const player of
                        scrim.selected
                ) {
                    if (
                        !player.ready &&
                        player.readyAt &&
                        player.readyAt <=
                        Date.now()
                    ) {
                        player.ready =
                            true;

                        player.readyAt =
                            null;

                        changed =
                            true;
                    }
                }

                if (
                    changed ||
                    scrim.selected.some(
                        player =>
                            player.readyAt
                    )
                ) {
                    await updateScrim(
                        scrim
                    );
                }
            }
        }
    },
    READY_TICK
);

/* =========================================================
   MODALS
========================================================= */

function serverLinkModal(
    id,
    title,
    current
) {
    return new ModalBuilder()
        .setCustomId(
            id
        )
        .setTitle(
            title
        )
        .addComponents(
            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'link'
                        )
                        .setLabel(
                            'Roblox Private Server Link'
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setMaxLength(
                            1000
                        )
                        .setValue(
                            current ===
                                undefined ||
                            current ===
                                null
                                ? ''
                                : String(
                                    current
                                )
                        )
                )
        );
}

function notReadyModal(
    messageId
) {
    return new ModalBuilder()
        .setCustomId(
            `notready_modal:${messageId}`
        )
        .setTitle(
            '𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 • NOT READY'
        )
        .addComponents(
            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'minutes'
                        )
                        .setLabel(
                            'Minutes until you are ready'
                        )
                        .setPlaceholder(
                            'Example: 10'
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setMaxLength(
                            3
                        )
                )
        );
}

function resultNumericInput(
    id,
    label,
    value
) {
    return new TextInputBuilder()
        .setCustomId(
            id
        )
        .setLabel(
            label
        )
        .setStyle(
            TextInputStyle.Short
        )
        .setRequired(
            true
        )
        .setMaxLength(
            3
        )
        .setValue(
            value ===
                undefined ||
            value ===
                null
                ? ''
                : String(
                    value
                )
        );
}

function resultTypeButtons(
    playerId
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `result_type:striker:${playerId}`
                    )
                    .setLabel(
                        'STRIKER'
                    )
                    .setEmoji('⚽')
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `result_type:gk:${playerId}`
                    )
                    .setLabel(
                        'GOALKEEPER'
                    )
                    .setEmoji('🧤')
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            )
    ];
}

function resultPositionButtons(
    playerId
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`result_position:striker:CF:${playerId}`)
                    .setLabel('CF')
                    .setEmoji('⚽')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`result_position:striker:CM:${playerId}`)
                    .setLabel('CM')
                    .setEmoji('🎯')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`result_position:striker:RW:${playerId}`)
                    .setLabel('RW')
                    .setEmoji('🏃')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`result_position:striker:LW:${playerId}`)
                    .setLabel('LW')
                    .setEmoji('💨')
                    .setStyle(ButtonStyle.Secondary)
            )
    ];
}

function resultModal(
    playerId,
    type,
    position,
    existing
) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `player_result:${playerId}:${type}:${position}`
            )
            .setTitle(
                type ===
                    'gk'
                    ? '𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕• GK RESULT'
                    : '𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 • STRIKER RESULT'
            );

    if (
        type ===
        'gk'
    ) {
        modal.addComponents(
            new ActionRowBuilder()
                .addComponents(
                    resultNumericInput(
                        'goalkeeping',
                        'Goalkeeping (0-100)',
                        existing?.goalkeeping
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    resultNumericInput(
                        'reactionTime',
                        'Reaction Time (0-100)',
                        existing?.reactionTime
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    resultNumericInput(
                        'passing',
                        'Passing (0-100)',
                        existing?.passing
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    resultNumericInput(
                        'defending',
                        'Defending (0-100)',
                        existing?.defending
                    )
                )
        );
    } else {
        modal.addComponents(
            new ActionRowBuilder()
                .addComponents(
                    resultNumericInput(
                        'shooting',
                        'Shooting (0-100)',
                        existing?.shooting
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    resultNumericInput(
                        'passing',
                        'Passing (0-100)',
                        existing?.passing
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    resultNumericInput(
                        'teamwork',
                        'Teamwork (0-100)',
                        existing?.teamwork
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    resultNumericInput(
                        'defending',
                        'Defending (0-100)',
                        existing?.defending
                    )
                )
        );
    }

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                new TextInputBuilder()
                    .setCustomId(
                        'thingsToFix'
                    )
                    .setLabel(
                        'Things to Fix'
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setRequired(
                        false
                    )
                    .setMaxLength(
                        1000
                    )
                    .setValue(
                        String(
                            existing?.thingsToFix ||
                            ''
                        )
                    )
            )
    );

    return modal;
}

/* =========================================================
   TRYOUT RESULT EMBED
========================================================= */

function resultEmbed(
    user,
    stats
) {
    const embed =
        new EmbedBuilder()
            .setColor(
                GOLD
            )
            .setAuthor({
                name:
                    '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • T R Y O U T ✦'
            })
            .setTitle(
                `${user.username} • OFFICIAL RESULT`
            )
            .setDescription(
                `> **${stats.overall} OVR** • ◆ **${stats.rank}** • ${rankText(stats.rank)}

━━━━━━━━━━━━━━━━━━━━━━━━

✦ **${
                    stats.type ===
                    'gk'
                        ? 'GOALKEEPER'
                        : 'STRIKER'
                } • ${stats.position}** ✦`
            )
            .setThumbnail(
                user.displayAvatarURL({
                    size:
                        256
                })
            );

    if (
        stats.type ===
        'gk'
    ) {
        embed.addFields(
            {
                name:
                    '🧤 GOALKEEPING',

                value:
                    `**${stats.goalkeeping}** / 100`,

                inline:
                    true
            },

            {
                name:
                    '⚡ REACTION TIME',

                value:
                    `**${stats.reactionTime}** / 100`,

                inline:
                    true
            },

            {
                name:
                    '⚽ PASSING',

                value:
                    `**${stats.passing}** / 100`,

                inline:
                    true
            },

            {
                name:
                    '🛡️ DEFENDING',

                value:
                    `**${stats.defending}** / 100`,

                inline:
                    true
            }
        );
    } else {
        embed.addFields(
            {
                name:
                    '🎯 SHOOTING',

                value:
                    `**${stats.shooting}** / 100`,

                inline:
                    true
            },

            {
                name:
                    '⚽ PASSING',

                value:
                    `**${stats.passing}** / 100`,

                inline:
                    true
            },

            {
                name:
                    '🤝 TEAMWORK',

                value:
                    `**${stats.teamwork}** / 100`,

                inline:
                    true
            },

            {
                name:
                    '🛡️ DEFENDING',

                value:
                    `**${stats.defending}** / 100`,

                inline:
                    true
            }
        );
    }

    embed.addFields(
        {
            name:
                '🏆 OVERALL',

            value:
                `**${stats.overall} OVR**`,

            inline:
                true
        },

        {
            name:
                '◇ RANK',

            value:
                `**${stats.rank}**`,

            inline:
                true
        },

        {
            name:
                '📝 THINGS TO FIX',

            value:
                stats.thingsToFix ||
                'Nothing specific noted.',

            inline:
                false
        }
    );

    embed.setFooter({
        text:
            '✦ OFFICIAL 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 TRYOUT RESULT ✦'
    });

    return setBanner(
        embed
    );
}

/* =========================================================
   SCRIM RESULTS MODALS
========================================================= */

function clubModal(
    sessionId
) {
    return new ModalBuilder()
        .setCustomId(
            `scrim_clubs:${sessionId}`
        )
        .setTitle(
            '𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 • CLUB NAMES'
        )
        .addComponents(
            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'club1'
                        )
                        .setLabel(
                            'Club 1 name'
                        )
                        .setPlaceholder(
                            'Example: ZEN'
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setMaxLength(
                            80
                        )
                ),

            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'club2'
                        )
                        .setLabel(
                            'Club 2 name'
                        )
                        .setPlaceholder(
                            'Example: TIN'
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setMaxLength(
                            80
                        )
                )
        );
}

function roundModal(
    session,
    round
) {
    const old =
        session.rounds.find(
            item =>
                item.round ===
                round
        );

    return new ModalBuilder()
        .setCustomId(
            `scrim_round:${session.id}:${round}`
        )
        .setTitle(
            `𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 • ROUND ${round}`
        )
        .addComponents(
            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'winner'
                        )
                        .setLabel(
                            'Winner (1 or 2)'
                        )
                        .setPlaceholder(
                            `1 = ${session.club1} • 2 = ${session.club2}`
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setMaxLength(
                            1
                        )
                        .setValue(
                            old
                                ? String(
                                    old.winner
                                )
                                : ''
                        )
                ),

            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'score'
                        )
                        .setLabel(
                            'Goals (Club 1 - Club 2)'
                        )
                        .setPlaceholder(
                            'Example: 5-3'
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setMaxLength(
                            7
                        )
                        .setValue(
                            old
                                ? `${old.score1}-${old.score2}`
                                : ''
                        )
                )
        );
}

function mvpModal(
    sessionId
) {
    return new ModalBuilder()
        .setCustomId(
            `scrim_mvp:${sessionId}`
        )
        .setTitle(
            '𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 • OVERALL MVP'
        )
        .addComponents(
            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'goals'
                        )
                        .setLabel(
                            'Goals scored'
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setMaxLength(
                            3
                        )
                        .setValue(
                            sessionMvpGoalValue(
                                sessionId
                            )
                        )
                ),

            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'roundsPlayed'
                        )
                        .setLabel(
                            'Rounds played'
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setMaxLength(
                            1
                        )
                        .setValue(
                            sessionMvpRoundValue(
                                sessionId
                            )
                        )
                )
        );
}

function sessionMvpGoalValue(
    sessionId
) {
    const session =
        scrimResultSessions.get(
            sessionId
        );

    return session?.mvp
        ? String(
            session.mvp.goals
        )
        : '';
}

function sessionMvpRoundValue(
    sessionId
) {
    const session =
        scrimResultSessions.get(
            sessionId
        );

    return session?.mvp
        ? String(
            session.mvp.roundsPlayed
        )
        : '';
}

/* =========================================================
   SCRIM RESULT GUI
========================================================= */

function scrimWinner(
    session
) {
    const club1 =
        session.rounds.filter(
            round =>
                round.winner ===
                1
        ).length;

    const club2 =
        session.rounds.filter(
            round =>
                round.winner ===
                2
        ).length;

    if (
        club1 >=
        3
    ) {
        return 1;
    }

    if (
        club2 >=
        3
    ) {
        return 2;
    }

    return null;
}

function scrimResultControlEmbed(
    session
) {
    const club1Rounds =
        session.rounds.filter(
            round =>
                round.winner ===
                1
        ).length;

    const club2Rounds =
        session.rounds.filter(
            round =>
                round.winner ===
                2
        ).length;

    const winner =
        scrimWinner(
            session
        );

    const roundLines =
        [];

    for (
        let i = 1;
        i <= MAX_RESULT_ROUNDS;
        i++
    ) {
        const round =
            session.rounds.find(
                item =>
                    item.round ===
                    i
            );

        if (
            round
        ) {
            roundLines.push(
                `**${i}. ROUND**  •  Winner **${
                    round.winner ===
                    1
                        ? session.club1
                        : session.club2
                }**  •  Goals **${round.score1}-${round.score2}**`
            );
        } else {
            roundLines.push(
                `**${i}. ROUND**  •  —`
            );
        }
    }

    const players =
        session.participants.length
            ? session.participants
                .map(
                    (
                        id,
                        index
                    ) =>
                        `**${index + 1}.** ${mentionUser(id)}`
                )
                .join(
                    '\n'
                )
            : '`Players not selected yet.`';

    const mvp =
        session.mvp
            ? `${mentionUser(session.mvp.userId)} • **${session.mvp.goals} GOALS** • **${session.mvp.roundsPlayed} ROUNDS PLAYED**`
            : '`MVP not selected yet.`';

    return setBanner(
        new EmbedBuilder()
            .setColor(
                PURPLE
            )
            .setAuthor({
                name:
                    '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 • S C R I M  R E S U L T S ✦'
            })
            .setTitle(
                '◇ MATCH RESULT CONTROL'
            )
            .setDescription(
                `╭────────────────────────────────────╮
│       **FIRST TO 3 ROUND WINS**      │
╰────────────────────────────────────╯

**① ${session.club1}**  **${club1Rounds}**
              **VS**
**${club2Rounds}**  **② ${session.club2}**

${
    winner
        ? `🏆 **WINNER:** **${
            winner ===
            1
                ? session.club1
                : session.club2
        }**`
        : '⏳ **WINNER:** Waiting for 3 round wins'
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**ROUND RESULTS**

${roundLines.join(
    '\n'
)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SCRIM PLAYERS**

${players}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**OVERALL MVP**

${mvp}`
            )
            .setFooter({
                text:
                    '✦ PRIVATE HOST CONTROL • 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� ✦'
            })
    );
}

function scrimResultButtons(
    session
) {
    const roundButton =
        round =>
            new ButtonBuilder()
                .setCustomId(
                    `scrim_result_round:${session.id}:${round}`
                )
                .setLabel(
                    session.rounds.some(
                        item =>
                            item.round ===
                            round
                    )
                        ? `ROUND ${round} ✓`
                        : `ROUND ${round}`
                )
                .setStyle(
                    session.rounds.some(
                        item =>
                            item.round ===
                            round
                    )
                        ? ButtonStyle.Success
                        : ButtonStyle.Primary
                )
                .setDisabled(
                    Boolean(
                        scrimWinner(
                            session
                        )
                    ) &&
                    !session.rounds.some(
                        item =>
                            item.round ===
                            round
                    )
                );

    return [
        new ActionRowBuilder()
            .addComponents(
                roundButton(
                    1
                ),

                roundButton(
                    2
                ),

                roundButton(
                    3
                )
            ),

        new ActionRowBuilder()
            .addComponents(
                roundButton(
                    4
                ),

                roundButton(
                    5
                ),

                roundButton(
                    6
                )
            ),

        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `scrim_result_players:${session.id}`
                    )
                    .setLabel(
                        'PLAYERS'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_result_mvp:${session.id}`
                    )
                    .setLabel(
                        'OVERALL MVP'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setDisabled(
                        !session.participants.length
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_result_publish:${session.id}`
                    )
                    .setLabel(
                        'PUBLISH RESULT'
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        !scrimWinner(
                            session
                        ) ||
                        !session.participants.length ||
                        !session.mvp
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_result_cancel:${session.id}`
                    )
                    .setLabel(
                        'CANCEL'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            )
    ];
}

function scrimResultPublicEmbed(
    result
) {
    const rounds =
        [...result.rounds]
            .sort(
                (
                    a,
                    b
                ) =>
                    a.round -
                    b.round
            )
            .map(
                round =>
                    `**${round.round}. ROUND**  •  Winner **${
                        round.winner ===
                        1
                            ? result.club1
                            : result.club2
                    }**  •  Goals **${round.score1}-${round.score2}**`
            )
            .join(
                '\n'
            );

    return setBanner(
        new EmbedBuilder()
            .setColor(
                BLUE
            )
            .setAuthor({
                name:
                    '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 � • S C R I M  R E S U L T ✦'
            })
            .setTitle(
                '◇ OFFICIAL SCRIM RESULT'
            )
            .setDescription(
                `╭────────────────────────────────────╮
│           **MATCH COMPLETE**         │
╰────────────────────────────────────╯

🏆 **WINNER**
**${result.winner}**

━━━━━━━━━━━━━━━━━━━━━━━━

**① ${result.club1}**  **${result.club1Rounds}**
              **VS**
**${result.club2Rounds}**  **② ${result.club2}**

━━━━━━━━━━━━━━━━━━━━━━━━

✦ **ROUND RESULTS**

${rounds}

━━━━━━━━━━━━━━━━━━━━━━━━

◇ **OVERALL MVP**

🏅 ${mentionUser(
                    result.mvp.userId
                )}

⚽ **${result.mvp.goals} GOALS**
◈ **${result.mvp.roundsPlayed} ROUNDS PLAYED**

━━━━━━━━━━━━━━━━━━━━━━━━

✦ **MATCH TYPE:** ${result.type.toUpperCase()}\n\n` +
                `👥 **PARTICIPANTS:** ${result.participants.length}/5`
            )
            .addFields(
                {
                    name:
                        '① CLUB 1',

                    value:
                        result.club1,

                    inline:
                        true
                },

                {
                    name:
                        '② CLUB 2',

                    value:
                        result.club2,

                    inline:
                        true
                },

                {
                    name:
                        '◇ ROUNDS',

                    value:
                        String(
                            result.rounds.length
                        ),

                    inline:
                        true
                }
            )
            .setFooter({
                text:
                    '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 � • OFFICIAL SCRIM RESULT ✦'
            })
    );
}

/* =========================================================
   INTERACTIONS
========================================================= */

client.on(
    'interactionCreate',
    async interaction => {
        try {
            /* =================================================
               SLASH COMMANDS
            ================================================= */

            if (
                interaction.isChatInputCommand()
            ) {
                /* =========================
                   /scrim results
                ========================= */

                if (
                    interaction.commandName ===
                    'scrim'
                ) {
                    const sub =
                        interaction.options.getSubcommand();

                    if (
                        sub ===
                        'results'
                    ) {
                        if (
                            !isHoster(
                                interaction.member
                            )
                        ) {
                            return interaction.reply({
                                content:
                                    '❌ You must be a **Tryout Hoster**.',

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        const id =
                            `${interaction.user.id}-${Date.now()}`;

                        scrimResultSessions.set(
                            id,
                            {
                                id,

                                hostId:
                                    interaction.user.id,

                                channelId:
                                    interaction.channelId,

                                club1:
                                    '',

                                club2:
                                    '',

                                rounds:
                                    [],

                                participants:
                                    [],

                                mvp:
                                    null,

                                mvpSelection:
                                    null,

                                type:
                                    'friendly'
                            }
                        );

                        return interaction.showModal(
                            clubModal(
                                id
                            )
                        );
                    }

                    return;
                }

                /* =========================
                   /tryout
                ========================= */

                if (
                    interaction.commandName !==
                    'tryout'
                ) {
                    return;
                }

                const group =
                    interaction.options.getSubcommandGroup(
                        false
                    );

                const sub =
                    interaction.options.getSubcommand();               /* =========================
                   /tryout scrim
                ========================= */

                if (
                    group ===
                    'scrim'
                ) {
                    if (
                        !isHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You must be a **Tryout Hoster**.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        sub ===
                        'create'
                    ) {
                        const already =
                            [
                                ...scrims.values()
                            ].some(
                                scrim =>
                                    scrim.hostId ===
                                    interaction.user.id
                            );

                        if (
                            already
                        ) {
                            return interaction.reply({
                                content:
                                    '❌ You already have an active scrim.',

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        const scrim = {
                            hostId:
                                interaction.user.id,

                            guildId:
                                interaction.guildId,

                            channelId:
                                interaction.channelId,

                            messageId:
                                null,

                            type:
                                null,

                            phase:
                                'choose',

                            players:
                                [],

                            selected:
                                [],

                            serverLink:
                                null,

                            countdownEnd:
                                null,

                            picking:
                                false
                        };

                        const message =
                            await interaction.channel.send({
                                embeds: [
                                    scrimChooseEmbed(
                                        scrim
                                    )
                                ],

                                components:
                                    scrimTypeButtons(),

                                allowedMentions: {
                                    parse: []
                                }
                            });

                        scrim.messageId =
                            message.id;

                        scrims.set(
                            message.id,
                            scrim
                        );

                        updatePresence();

                        return interaction.reply({
                            content:
                                '✅ Scrim created.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        sub ===
                        'close'
                    ) {
                        const found =
                            [
                                ...scrims.entries()
                            ].find(
                                ([, scrim]) =>
                                    scrim.hostId ===
                                    interaction.user.id
                            );

                        if (
                            !found
                        ) {
                            return interaction.reply({
                                content:
                                    '❌ You do not have an active scrim.',

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        scrims.delete(
                            found[0]
                        );

                        try {
                            const message =
                                await interaction.channel.messages.fetch(
                                    found[0]
                                );

                            await message.delete();
                        } catch {}

                        updatePresence();

                        return interaction.reply({
                            content:
                                '✅ Scrim closed.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return;
                }

                /* =========================
                   TRYOUT CREATE
                ========================= */

                if (
                    sub ===
                    'create'
                ) {
                    if (
                        !isHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You must be a **Tryout Hoster**.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const active =
                        [
                            ...tryouts.values()
                        ].some(
                            lobby =>
                                lobby.hostId ===
                                interaction.user.id
                        );

                    if (
                        active
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You already have an active tryout.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const lobby = {
                        hostId:
                            interaction.user.id,

                        guildId:
                            interaction.guildId,

                        channelId:
                            interaction.channelId,

                        messageId:
                            null,

                        players:
                            [],

                        serverLink:
                            null
                    };

                    const message =
                        await interaction.channel.send({
                            content:
                                TRYOUT_PING_ROLE_ID
                                    ? mentionRole(
                                        TRYOUT_PING_ROLE_ID
                                    )
                                    : undefined,

                            embeds: [
                                tryoutEmbed(
                                    lobby
                                )
                            ],

                            components:
                                tryoutButtons(
                                    {
                                        ...lobby,
                                        messageId:
                                            'pending'
                                    }
                                ),

                            allowedMentions:
                                TRYOUT_PING_ROLE_ID
                                    ? {
                                        roles: [
                                            TRYOUT_PING_ROLE_ID
                                        ]
                                    }
                                    : {
                                        parse: []
                                    }
                        });

                    lobby.messageId =
                        message.id;

                    tryouts.set(
                        message.id,
                        lobby
                    );

                    await message.edit({
                        embeds: [
                            tryoutEmbed(
                                lobby
                            )
                        ],

                        components:
                            tryoutButtons(
                                lobby
                            )
                    });

                    updatePresence();

                    return interaction.reply({
                        content:
                            '✅ Tryout created.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   TRYOUT CLOSE
                ========================= */

                if (
                    sub ===
                    'close'
                ) {
                    const found =
                        [
                            ...tryouts.entries()
                        ].find(
                            ([, lobby]) =>
                                lobby.hostId ===
                                interaction.user.id
                        );

                    if (
                        !found
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You do not have an active tryout.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    tryouts.delete(
                        found[0]
                    );

                    try {
                        const message =
                            await interaction.channel.messages.fetch(
                                found[0]
                            );

                        await message.delete();
                    } catch {}

                    updatePresence();

                    return interaction.reply({
                        content:
                            '✅ Tryout closed.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   RESULTS
                ========================= */

                if (
                    sub ===
                    'results'
                ) {
                    if (
                        !isHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You must be a **Tryout Hoster**.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        content:
                            '',
                        embeds: [
                            setBanner(
                                new EmbedBuilder()
                                    .setColor(GOLD)
                                    .setAuthor({
                                        name: '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • T R Y O U T  R E S U L T S ✦'
                                    })
                                    .setTitle('◇ SELECT PLAYER')
                                    .setDescription(
                                        'Choose the player you want to evaluate.\n\n' +
                                        'The panel will automatically switch to the **STRIKER / GOALKEEPER** controls after selection.'
                                    )
                                    .setFooter({
                                        text: '✦𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 • E U ✦'
                                    })
                            )
                        ],
                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    new UserSelectMenuBuilder()
                                        .setCustomId('result_player_select')
                                        .setPlaceholder('Select a player')
                                        .setMinValues(1)
                                        .setMaxValues(1)
                                )
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   LEADERBOARD
                ========================= */

                if (
                    sub ===
                    'leaderboard'
                ) {
                    const sorted =
                        Object.entries(
                            playerResults
                        )
                            .map(
                                ([id, raw]) => ({
                                    id,

                                    data:
                                        normalizePlayer(
                                            raw
                                        )
                                })
                            )
                            .filter(
                                item =>
                                    item.data
                            )
                            .sort(
                                (
                                    a,
                                    b
                                ) =>
                                    b.data.overall -
                                    a.data.overall
                            )
                            .slice(
                                0,
                                10
                            );

                    let text =
                        '✦ **TOP 10** ✦\n\n';

                    if (
                        !sorted.length
                    ) {
                        text +=
                            '`No results yet.`';
                    } else {
                        sorted.forEach(
                            (
                                item,
                                index
                            ) => {
                                text +=
                                    `**${index + 1}.** ${mentionUser(item.id)} • **${item.data.overall} OVR** • **${item.data.rank}**\n`;
                            }
                        );
                    }

                    return interaction.reply({
                        embeds: [
                            setBanner(
                                new EmbedBuilder()
                                    .setColor(
                                        GOLD
                                    )
                                    .setAuthor({
                                        name:
                                            '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • L E A D E R B O A R D ✦'
                                    })
                                    .setTitle(
                                        '◇ TRYOUT LEADERBOARD'
                                    )
                                    .setDescription(
                                        text
                                    )
                                    .setFooter({
                                        text:
                                            '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • E U ✦'
                                    })
                            )
                        ]
                    });
                }

                /* =========================
                   PROFILE
                ========================= */

                if (
                    sub ===
                    'profile'
                ) {
                    const user =
                        interaction.options.getUser(
                            'player'
                        ) ||
                        interaction.user;

                    const data =
                        playerData(
                            user.id
                        );

                    if (
                        !data
                    ) {
                        return interaction.reply({
                            content:
                                `❌ ${mentionUser(user.id)} has no result yet.`,

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const fields =
                        [];

                    if (
                        data.type ===
                        'gk'
                    ) {
                        fields.push(
                            {
                                name:
                                    '🧤 GOALKEEPING',

                                value:
                                    String(
                                        data.goalkeeping
                                    ),

                                inline:
                                    true
                            },

                            {
                                name:
                                    '⚡ REACTION',

                                value:
                                    String(
                                        data.reactionTime
                                    ),

                                inline:
                                    true
                            },

                            {
                                name:
                                    '⚽ PASSING',

                                value:
                                    String(
                                        data.passing
                                    ),

                                inline:
                                    true
                            },

                            {
                                name:
                                    '🛡️ DEFENDING',

                                value:
                                    String(
                                        data.defending
                                    ),

                                inline:
                                    true
                            }
                        );
                    } else {
                        fields.push(
                            {
                                name:
                                    '🎯 SHOOTING',

                                value:
                                    String(
                                        data.shooting
                                    ),

                                inline:
                                    true
                            },

                            {
                                name:
                                    '⚽ PASSING',

                                value:
                                    String(
                                        data.passing
                                    ),

                                inline:
                                    true
                            },

                            {
                                name:
                                    '🤝 TEAMWORK',

                                value:
                                    String(
                                        data.teamwork
                                    ),

                                inline:
                                    true
                            },

                            {
                                name:
                                    '🛡️ DEFENDING',

                                value:
                                    String(
                                        data.defending
                                    ),

                                inline:
                                    true
                            }
                        );
                    }

                    fields.push(
                        {
                            name:
                                '🏆 OVR',

                            value:
                                `${data.overall}`,

                            inline:
                                true
                        },

                        {
                            name:
                                '◇ RANK',

                            value:
                                `${data.rank}`,

                            inline:
                                true
                        },

                        {
                            name:
                                '◇ POSITION',

                            value:
                                `${data.position}`,

                            inline:
                                true
                        },

                        {
                            name:
                                '◇ TRYOUTS',

                            value:
                                `${data.tryoutsCompleted}`,

                            inline:
                                true
                        },

                        {
                            name:
                                '📝 THINGS TO FIX',

                            value:
                                data.thingsToFix ||
                                'None noted.',

                            inline:
                                false
                        }
                    );

                    return interaction.reply({
                        embeds: [
                            setBanner(
                                new EmbedBuilder()
                                    .setColor(
                                        GOLD
                                    )
                                    .setAuthor({
                                        name:
                                            '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 • P L A Y E R  P R O F I L E ✦'
                                    })
                                    .setTitle(
                                        user.username
                                    )
                                    .setDescription(
                                        `> **${data.overall} OVR** • **${rankText(data.rank)}**

✦ **TYPE:** ${
                                            data.type ===
                                            'gk'
                                                ? 'GOALKEEPER'
                                                : 'STRIKER'
                                        }`
                                    )
                                    .setThumbnail(
                                        user.displayAvatarURL({
                                            size:
                                                256
                                        })
                                    )
                                    .addFields(
                                        fields
                                    )
                                    .setFooter({
                                        text:
                                            '✦𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • E U ✦'
                                    })
                            )
                        ]
                    });
                }

                /* =========================
                   ANNOUNCE
                ========================= */

                if (
                    sub ===
                    'announce'
                ) {
                    if (
                        !isHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You must be a **Tryout Hoster**.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const unit =
    interaction.options.getString(
        'unit',
        false
    ) || 'minutes';

const amount =
    interaction.options.getInteger(
        'amount',
        false
    ) || 30;

                    pendingAnnouncements.set(
                        interaction.user.id,
                        {
                            channelId:
                                interaction.channelId,

                            guildId:
                                interaction.guildId,

                            duration:
                                unit ===
                                'minutes'
                                    ? amount *
                                      60 *
                                      1000
                                    : amount *
                                      60 *
                                      60 *
                                      1000,

                            durationLabel:
                                `${amount} ${unit}`
                        }
                    );

                    return interaction.showModal(
                        new ModalBuilder()
                            .setCustomId(
                                'announcement_modal'
                            )
                            .setTitle(
                                '𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 • ANNOUNCEMENT'
                            )
                            .addComponents(
                                new ActionRowBuilder()
                                    .addComponents(
                                        new TextInputBuilder()
                                            .setCustomId(
                                                'message'
                                            )
                                            .setLabel(
                                                'Announcement message'
                                            )
                                            .setStyle(
                                                TextInputStyle.Paragraph
                                            )
                                            .setRequired(
                                                false
                                            )
                                            .setMaxLength(
                                                1000
                                            )
                                    )
                            )
                    );
                }
            }

            /* =================================================
               USER SELECT
            ================================================= */

            if (
                interaction.isUserSelectMenu()
            ) {
                if (
                    interaction.customId ===
                    'result_player_select'
                ) {
                    if (
                        !isHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Hoster only.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const playerId =
                        interaction.values[
                            0
                        ];

                    resultDrafts.set(
                        interaction.user.id,
                        {
                            playerId,
                            type:
                                null,
                            position:
                                null,
                            stats:
                                null
                        }
                    );

                    return interaction.update({
                        content: '',
                        embeds: [
                            setBanner(
                                new EmbedBuilder()
                                    .setColor(GOLD)
                                    .setAuthor({
                                        name: '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • T R Y O U T  R E S U L T S ✦'
                                    })
                                    .setTitle('◇ PLAYER TYPE')
                                    .setDescription(
                                        `👤 **Player:** ${mentionUser(playerId)}\n\n` +
                                        `Select the evaluation path.\n\n` +
                                        `⚽ **STRIKER** — CF / CM / RW / LW\n` +
                                        `Shooting • Passing • Teamwork • Defending\n\n` +
                                        `🧤 **GOALKEEPER** — GK\n` +
                                        `Goalkeeping • Reaction Time • Passing • Defending`
                                    )
                                    .setFooter({
                                        text: '✦𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • E U ✦'
                                    })
                            )
                        ],
                        components: resultTypeButtons(playerId)
                    });
                }

                if (
                    interaction.customId.startsWith(
                        'scrim_result_players:'
                    )
                ) {
                    const id =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const session =
                        scrimResultSessions.get(
                            id
                        );

                    if (
                        !session ||
                        session.hostId !==
                            interaction.user.id
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    session.participants =
                        [...new Set(interaction.values)].slice(0, 5);

                    return interaction.update({
                        content: '',
                        embeds: [
                            scrimResultControlEmbed(
                                session
                            )
                        ],
                        components:
                            scrimResultButtons(
                                session
                            )
                    });
                }

                if (
                    interaction.customId.startsWith(
                        'scrim_result_mvp_select:'
                    )
                ) {
                    const id =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const session =
                        scrimResultSessions.get(
                            id
                        );

                    if (
                        !session ||
                        session.hostId !==
                            interaction.user.id
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const playerId =
                        interaction.values[
                            0
                        ];

                    if (
                        !session.participants.includes(
                            playerId
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ MVP must be one of the selected participants.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    session.mvpSelection =
                        playerId;

                    // Show the modal immediately; do not await any network calls here.
                    return interaction.showModal(
                        mvpModal(
                            id
                        )
                    );
                }
            }

            /* =================================================
               MODALS
            ================================================= */

            if (
                interaction.isModalSubmit()
            ) {
                /* =========================
                   TRYOUT SERVER LINK
                ========================= */

                if (
                    interaction.customId.startsWith(
                        'tryout_server_link:'
                    )
                ) {
                    const id =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const lobby =
                        tryouts.get(
                            id
                        );

                    if (
                        !lobby
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Tryout not found.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const link =
                        interaction.fields.getTextInputValue(
                            'link'
                        ).trim();

                    if (
                        !validServerLink(
                            link
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Use a valid HTTPS Roblox private-server link.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    lobby.serverLink =
                        link;

                    await updateTryout(
                        lobby
                    );

                    return interaction.reply({
                        content:
                            '✅ Tryout server link saved.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   SCRIM SERVER LINK
                ========================= */

                if (
                    interaction.customId.startsWith(
                        'scrim_server_link:'
                    )
                ) {
                    const id =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            id
                        );

                    if (
                        !scrim
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Scrim not found.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        interaction.user.id !==
                        scrim.hostId
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Host only.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const link =
                        interaction.fields.getTextInputValue(
                            'link'
                        ).trim();

                    if (
                        !validServerLink(
                            link
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Use a valid HTTPS Roblox private-server link.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    scrim.serverLink =
                        link;

                    await updateScrim(
                        scrim
                    );

                    if (
                        scrim.selected.length
                    ) {
                        await pingSelectedPlayers(
                            scrim
                        );
                    }

                    return interaction.reply({
                        content:
                            '✅ Scrim server link saved.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   NOT READY
                ========================= */

                if (
                    interaction.customId.startsWith(
                        'notready_modal:'
                    )
                ) {
                    const id =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            id
                        );

                    const player =
                        scrim?.selected.find(
                            item =>
                                item.id ===
                                interaction.user.id
                        );

                    if (
                        !scrim ||
                        !player
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You are not in the selected lineup.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const raw =
                        interaction.fields
                            .getTextInputValue(
                                'minutes'
                            )
                            .trim();

                    const minutes =
                        Number(
                            raw
                        );

                    if (
                        !/^\d+$/.test(
                            raw
                        ) ||
                        minutes < 1 ||
                        minutes > 180
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Enter **1-180 minutes**.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    player.ready =
                        false;

                    player.readyAt =
                        Date.now() +
                        minutes *
                            60 *
                            1000;

                    await updateScrim(
                        scrim
                    );

                    return interaction.reply({
                        content:
                            `⏳ **[ I'LL BE READY IN ${minutes} MINUTES ]**`,

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   ANNOUNCEMENT
                ========================= */

                if (
                    interaction.customId ===
                    'announcement_modal'
                ) {
                    const pending =
                        pendingAnnouncements.get(
                            interaction.user.id
                        );

                    if (
                        !pending
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Announcement session expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    pendingAnnouncements.delete(
                        interaction.user.id
                    );

                    const a = {
                        hostId:
                            interaction.user.id,

                        guildId:
                            pending.guildId,

                        channelId:
                            pending.channelId,

                        messageId:
                            null,

                        ready:
                            [],

                        durationLabel:
                            pending.durationLabel,

                        endTime:
                            Date.now() +
                            pending.duration,

                        extensionEnd:
                            null,

                        warning:
                            false,

                        repingUsed:
                            false,

                        repingStarted:
                            false,

                        phase:
                            'initial',

                        customMessage:
                            interaction.fields
                                .getTextInputValue(
                                    'message'
                                )
                                .trim()
                    };

                    const message =
                        await interaction.channel.send({
                            content:
                                TRYOUT_PING_ROLE_ID
                                    ? mentionRole(
                                        TRYOUT_PING_ROLE_ID
                                    )
                                    : undefined,

                            embeds: [
                                announcementEmbed(
                                    a
                                )
                            ],

                            components:
                                [],

                            allowedMentions:
                                TRYOUT_PING_ROLE_ID
                                    ? {
                                        roles: [
                                            TRYOUT_PING_ROLE_ID
                                        ]
                                    }
                                    : {
                                        parse: []
                                    }
                        });

                    a.messageId =
                        message.id;

                    announcements.set(
                        message.id,
                        a
                    );

                    await updateAnnouncement(
                        a
                    );

                    return interaction.reply({
                        content:
                            '✅ Announcement posted.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   TRYOUT RESULT
                ========================= */

                if (
                    interaction.customId.startsWith(
                        'player_result:'
                    )
                ) {
                    const parts =
                        interaction.customId.split(
                            ':'
                        );

                    const playerId =
                        parts[1];

                    const type =
                        parts[2];

                    const position =
                        parts[3];

                    const read =
                        id => {
                            const raw =
                                interaction.fields
                                    .getTextInputValue(
                                        id
                                    )
                                    .trim();

                            if (
                                !/^\d+$/.test(
                                    raw
                                )
                            ) {
                                return null;
                            }

                            const n =
                                Number(
                                    raw
                                );

                            if (
                                n < 0 ||
                                n > 100
                            ) {
                                return null;
                            }

                            return n;
                        };

                    const stats = {
                        type:
                            type ===
                            'gk'
                                ? 'gk'
                                : 'striker',

                        position,

                        thingsToFix:
                            interaction.fields
                                .getTextInputValue(
                                    'thingsToFix'
                                )
                                .trim()
                    };

                    if (
                        type ===
                        'gk'
                    ) {
                        stats.goalkeeping =
                            read(
                                'goalkeeping'
                            );

                        stats.reactionTime =
                            read(
                                'reactionTime'
                            );

                        stats.passing =
                            read(
                                'passing'
                            );

                        stats.defending =
                            read(
                                'defending'
                            );

                        if (
                            [
                                stats.goalkeeping,
                                stats.reactionTime,
                                stats.passing,
                                stats.defending
                            ].some(
                                value =>
                                    value ===
                                    null
                            )
                        ) {
                            return interaction.reply({
                                content:
                                    '❌ Stats must be **0-100**.',

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        stats.overall =
                            Math.round(
                                (
                                    stats.goalkeeping +
                                    stats.reactionTime +
                                    stats.passing +
                                    stats.defending
                                ) /
                                4
                            );
                    } else {
                        stats.shooting =
                            read(
                                'shooting'
                            );

                        stats.passing =
                            read(
                                'passing'
                            );

                        stats.teamwork =
                            read(
                                'teamwork'
                            );

                        stats.defending =
                            read(
                                'defending'
                            );

                        if (
                            [
                                stats.shooting,
                                stats.passing,
                                stats.teamwork,
                                stats.defending
                            ].some(
                                value =>
                                    value ===
                                    null
                            )
                        ) {
                            return interaction.reply({
                                content:
                                    '❌ Stats must be **0-100**.',

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        stats.overall =
                            Math.round(
                                (
                                    stats.shooting +
                                    stats.passing +
                                    stats.teamwork +
                                    stats.defending
                                ) /
                                4
                            );
                    }

                    stats.rank =
                        getRank(
                            stats.overall
                        );

                    resultDrafts.set(
                        interaction.user.id,
                        {
                            playerId,

                            type,

                            position,

                            stats
                        }
                    );

                    const member =
                        await interaction.guild.members.fetch(
                            playerId
                        ).catch(
                            () => null
                        );

                    if (
                        !member
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Player not found.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        content:
                            '✦ **PRIVATE RESULT REVIEW** ✦',

                        embeds: [
                            resultEmbed(
                                member.user,
                                stats
                            )
                        ],

                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(
                                            `result_edit:${playerId}`
                                        )
                                        .setLabel(
                                            'EDIT'
                                        )
                                        .setStyle(
                                            ButtonStyle.Secondary
                                        ),

                                    new ButtonBuilder()
                                        .setCustomId(
                                            `result_finish:${playerId}`
                                        )
                                        .setLabel(
                                            'FINISH'
                                        )
                                        .setStyle(
                                            ButtonStyle.Success
                                        )
                                    )
                        ],

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   CLUB NAMES
                ========================= */

                if (
                    interaction.customId.startsWith(
                        'scrim_clubs:'
                    )
                ) {
                    const id =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const session =
                        scrimResultSessions.get(
                            id
                        );

                    if (
                        !session
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    session.club1 =
                        interaction.fields
                            .getTextInputValue(
                                'club1'
                            )
                            .trim();

                    session.club2 =
                        interaction.fields
                            .getTextInputValue(
                                'club2'
                            )
                            .trim();

                    if (
                        !session.club1 ||
                        !session.club2 ||
                        session.club1.toLowerCase() ===
                            session.club2.toLowerCase()
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Club names must be different.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        content:
                            '◇ **SCRIM RESULT CONTROL**',

                        embeds: [
                            scrimResultControlEmbed(
                                session
                            )
                        ],

                        components:
                            scrimResultButtons(
                                session
                            ),

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   ROUND
                ========================= */

                if (
                    interaction.customId.startsWith(
                        'scrim_round:'
                    )
                ) {
                    const [
                        ,
                        sessionId,
                        roundRaw
                    ] =
                        interaction.customId.split(
                            ':'
                        );

                    const session =
                        scrimResultSessions.get(
                            sessionId
                        );

                    if (
                        !session
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const round =
                        Number(
                            roundRaw
                        );

                    const winner =
                        Number(
                            interaction.fields
                                .getTextInputValue(
                                    'winner'
                                )
                                .trim()
                        );

                    const parsed =
                        /^(\d+)\s*-\s*(\d+)$/.exec(
                            interaction.fields
                                .getTextInputValue(
                                    'score'
                                )
                                .trim()
                        );

                    if (
                        ![1, 2].includes(
                            winner
                        ) ||
                        !parsed
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Winner must be **1 or 2**, score must look like **5-3**.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const score1 =
                        Number(
                            parsed[1]
                        );

                    const score2 =
                        Number(
                            parsed[2]
                        );

                    if (
                        score1 ===
                        score2
                    ) {
                        return interaction.reply({
                            content:
                                '❌ A round cannot end in a tie.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const actualWinner =
                        score1 >
                        score2
                            ? 1
                            : 2;

                    if (
                        actualWinner !==
                        winner
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Winner does not match the higher score.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const exists =
                        session.rounds.find(
                            item =>
                                item.round ===
                                round
                        );

                    if (
                        !exists
                    ) {
                        const highest =
                            Math.max(
                                0,
                                ...session.rounds.map(
                                    item =>
                                        item.round
                                )
                            );

                        if (
                            round !==
                            highest +
                                1
                        ) {
                            return interaction.reply({
                                content:
                                    `❌ Enter rounds in order. Next round: **${highest + 1}**.`,

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }
                    }

                    session.rounds =
                        session.rounds.filter(
                            item =>
                                item.round !==
                                round
                        );

                    session.rounds.push({
                        round,

                        winner,

                        score1,

                        score2
                    });

                    session.rounds.sort(
                        (
                            a,
                            b
                        ) =>
                            a.round -
                            b.round
                    );

                    return interaction.reply({
                        content:
                            '◇ **UPDATED MATCH RESULT**',

                        embeds: [
                            scrimResultControlEmbed(
                                session
                            )
                        ],

                        components:
                            scrimResultButtons(
                                session
                            ),

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   MVP
                ========================= */

                if (
                    interaction.customId.startsWith(
                        'scrim_mvp:'
                    )
                ) {
                    const id =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const session =
                        scrimResultSessions.get(
                            id
                        );

                    if (
                        !session ||
                        !session.mvpSelection
                    ) {
                        return interaction.reply({
                            content:
                                '❌ MVP selection expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const goalsRaw =
                        interaction.fields
                            .getTextInputValue(
                                'goals'
                            )
                            .trim();

                    const roundsRaw =
                        interaction.fields
                            .getTextInputValue(
                                'roundsPlayed'
                            )
                            .trim();

                    const goals =
                        Number(
                            goalsRaw
                        );

                    const roundsPlayed =
                        Number(
                            roundsRaw
                        );

                    if (
                        !/^\d+$/.test(
                            goalsRaw
                        ) ||
                        !/^\d+$/.test(
                            roundsRaw
                        ) ||
                        roundsPlayed <
                            1 ||
                        roundsPlayed >
                            6
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Enter valid goals and **1-6 rounds played**.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    session.mvp = {
                        userId:
                            session.mvpSelection,

                        goals,

                        roundsPlayed
                    };

                    session.mvpSelection =
                        null;

                    return interaction.reply({
                        content:
                            '◇ **MVP SAVED**',

                        embeds: [
                            scrimResultControlEmbed(
                                session
                            )
                        ],

                        components:
                            scrimResultButtons(
                                session
                            ),

                        flags:
                            MessageFlags.Ephemeral
                    });
                }
            }

            /* =================================================
               BUTTONS
            ================================================= */

            if (
                interaction.isButton()
            ) {
                const id =
                    interaction.customId;

                /* =========================
                   SCRIM TYPE
                ========================= */

                if (
                    id.startsWith(
                        'scrim_type:'
                    )
                ) {
                    const type =
                        id.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            interaction.message.id
                        );

                    if (
                        !scrim
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Scrim not found.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        scrim.hostId !==
                        interaction.user.id
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Host only.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        type ===
                            'elo' &&
                        !MAIN_TEAM_ROLE_ID
                    ) {
                        return interaction.reply({
                            content:
                                '❌ MAIN_TEAM_ROLE_ID is missing.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    scrim.type =
                        type;

                    scrim.phase =
                        'queue';

                    await updateScrim(
                        scrim
                    );

                    await pingScrimRole(
                        scrim
                    );

                    return interaction.reply({
                        content:
                            `✅ ${type.toUpperCase()} scrim opened.`,

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   SCRIM POSITION
                ========================= */

                if (
                    id.startsWith(
                        'scrim_position:'
                    )
                ) {
                    const [
                        ,
                        position,
                        messageId
                    ] =
                        id.split(
                            ':'
                        );

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    if (
                        !scrim ||
                        scrim.phase !==
                            'queue'
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Scrim is not accepting positions.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        scrim.type ===
                            'elo' &&
                        !isMainTeam(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '🔴 ELO requires the Main Team role.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const occupied =
                        scrim.players.find(
                            player =>
                                player.position ===
                                    position &&
                                player.id !==
                                    interaction.user.id
                        );

                    if (
                        occupied
                    ) {
                        return interaction.reply({
                            content:
                                `❌ **${position}** is already occupied.`,

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    let player =
                        scrim.players.find(
                            item =>
                                item.id ===
                                interaction.user.id
                        );

                    if (
                        !player
                    ) {
                        player = {
                            id:
                                interaction.user.id,

                            position
                        };

                        scrim.players.push(
                            player
                        );
                    } else {
                        player.position =
                            position;
                    }

                    if (
                        allPositionsFilled(
                            scrim
                        )
                    ) {
                        scrim.countdownEnd =
                            scrim.countdownEnd ||
                            Date.now() +
                            SCRIM_COUNTDOWN;
                    } else {
                        scrim.countdownEnd =
                            null;
                    }

                    await updateScrim(
                        scrim
                    );

                    return interaction.reply({
                        content:
                            `✅ You selected **${position}**.`,

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   SCRIM LEAVE
                ========================= */

                if (
                    id.startsWith(
                        'scrim_leave:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    if (
                        !scrim ||
                        scrim.phase !==
                            'queue'
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You cannot leave now.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const index =
                        scrim.players.findIndex(
                            player =>
                                player.id ===
                                interaction.user.id
                        );

                    if (
                        index ===
                        -1
                    ) {
                        return interaction.reply({
                            content:
                                '⚠️ You are not in the queue.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    scrim.players.splice(
                        index,
                        1
                    );

                    scrim.countdownEnd =
                        null;

                    await updateScrim(
                        scrim
                    );

                    return interaction.reply({
                        content:
                            '↩️ You left the scrim queue.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   SCRIM LINK
                ========================= */

                if (
                    id.startsWith(
                        'scrim_link:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    if (
                        !scrim
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Scrim not found.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        scrim.hostId !==
                        interaction.user.id
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Host only.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.showModal(
                        serverLinkModal(
                            `scrim_server_link:${messageId}`,
                            '𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 • SCRIM SERVER LINK',
                            scrim.serverLink
                        )
                    );
                }

                /* =========================
                   SCRIM SKIP
                ========================= */

                if (
                    id.startsWith(
                        'scrim_skip:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    if (
                        !scrim
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Scrim not found.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        scrim.hostId !==
                        interaction.user.id
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Host only.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        !allPositionsFilled(
                            scrim
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ All five positions must be filled first.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await randomSelect(
                        scrim
                    );

                    return interaction.reply({
                        content:
                            '⚡ Countdown skipped. Random selection started.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   SCRIM READY
                ========================= */

                if (
                    id.startsWith(
                        'scrim_ready:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    const player =
                        scrim?.selected.find(
                            item =>
                                item.id ===
                                interaction.user.id
                        );

                    if (
                        !scrim ||
                        !player
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You are not selected.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    player.ready =
                        true;

                    player.readyAt =
                        null;

                    await updateScrim(
                        scrim
                    );

                    return interaction.reply({
                        content:
                            '✅ **READY**',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   SCRIM NOT READY
                ========================= */

                if (
                    id.startsWith(
                        'scrim_notready:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    const player =
                        scrim?.selected.find(
                            item =>
                                item.id ===
                                interaction.user.id
                        );

                    if (
                        !scrim ||
                        !player
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You are not selected.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.showModal(
                        notReadyModal(
                            messageId
                        )
                    );
                }

                /* =========================
                   SCRIM CLOSE
                ========================= */

                if (
                    id.startsWith(
                        'scrim_close:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    if (
                        !scrim ||
                        scrim.hostId !==
                            interaction.user.id
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Host only.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    scrims.delete(
                        messageId
                    );

                    try {
                        await interaction.message.delete();
                    } catch {}

                    updatePresence();

                    return;
                }

                /* =========================
                   TRYOUT JOIN
                ========================= */

                if (
                    id.startsWith(
                        'tryout_join:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const lobby =
                        tryouts.get(
                            messageId
                        );

                    if (
                        !lobby
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Tryout not found.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        lobby.players.includes(
                            interaction.user.id
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '⚠️ Already joined.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        lobby.players.length >=
                        MAX_PLAYERS
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Tryout is full.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    lobby.players.push(
                        interaction.user.id
                    );

                    await interaction.deferUpdate();

                    await updateTryout(
                        lobby
                    );

                    updatePresence();

                    return;
                }

                /* =========================
                   TRYOUT LEAVE
                ========================= */

                if (
                    id.startsWith(
                        'tryout_leave:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const lobby =
                        tryouts.get(
                            messageId
                        );

                    if (
                        !lobby
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Tryout not found.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const index =
                        lobby.players.indexOf(
                            interaction.user.id
                        );

                    if (
                        index ===
                        -1
                    ) {
                        return interaction.reply({
                            content:
                                '⚠️ You are not in this tryout.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    lobby.players.splice(
                        index,
                        1
                    );

                    await interaction.deferUpdate();

                    await updateTryout(
                        lobby
                    );

                    updatePresence();

                    return;
                }

                /* =========================
                   TRYOUT LINK
                ========================= */

                if (
                    id.startsWith(
                        'tryout_link:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const lobby =
                        tryouts.get(
                            messageId
                        );

                    if (
                        !lobby
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Tryout not found.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        lobby.hostId !==
                        interaction.user.id
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Host only.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.showModal(
                        serverLinkModal(
                            `tryout_server_link:${messageId}`,
                            '𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕 • TRYOUT SERVER LINK',
                            lobby.serverLink
                        )
                    );
                }

                /* =========================
                   TRYOUT CLOSE
                ========================= */

                if (
                    id.startsWith(
                        'tryout_close:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const lobby =
                        tryouts.get(
                            messageId
                        );

                    if (
                        !lobby
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Tryout not found.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        lobby.hostId !==
                        interaction.user.id
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Host only.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    tryouts.delete(
                        messageId
                    );

                    try {
                        await interaction.message.delete();
                    } catch {}

                    updatePresence();

                    return;
                }

                /* =========================
                   RESULT TYPE
                ========================= */

                if (
                    id.startsWith(
                        'result_type:'
                    )
                ) {
                    const [, type, playerIdFromButton] = id.split(':');
                    const draft = resultDrafts.get(interaction.user.id);

                    if (!draft) {
                        return interaction.reply({
                            content: '❌ Result session expired.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const playerId =
                        playerIdFromButton || draft.playerId;

                    if (draft.playerId !== playerId) {
                        return interaction.reply({
                            content: '❌ This result panel belongs to another player.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    draft.type = type === 'gk' ? 'gk' : 'striker';
                    draft.position = type === 'gk' ? 'GK' : null;
                    draft.stats = null;
                    resultDrafts.set(interaction.user.id, draft);

                    if (type === 'gk') {
                        return interaction.showModal(
                            resultModal(
                                playerId,
                                'gk',
                                'GK',
                                playerData(playerId)
                            )
                        );
                    }

                    return interaction.update({
                        content: '',
                        embeds: [
                            setBanner(
                                new EmbedBuilder()
                                    .setColor(GOLD)
                                    .setAuthor({
                                        name: '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • T R Y O U T  R E S U L T S ✦'
                                    })
                                    .setTitle('◇ STRIKER POSITION')
                                    .setDescription(
                                        `👤 **Player:** ${mentionUser(playerId)}\n\n` +
                                        `⚽ **STRIKER**\n` +
                                        `Choose the position used for the evaluation.\n\n` +
                                        `CF • CM • RW • LW`
                                    )
                                    .setFooter({
                                        text: '✦ 𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕� • E U ✦'
                                    })
                            )
                        ],
                        components: resultPositionButtons(playerId)
                    });
                }

                /* =========================
                   RESULT POSITION
                ========================= */

                if (
                    id.startsWith(
                        'result_position:'
                    )
                ) {
                    const [, type, position, playerId] = id.split(':');
                    const draft = resultDrafts.get(interaction.user.id);

                    if (
                        !draft ||
                        draft.playerId !== playerId
                    ) {
                        return interaction.reply({
                            content: '❌ Result session expired.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    draft.type = type === 'gk' ? 'gk' : 'striker';
                    draft.position = type === 'gk' ? 'GK' : position;
                    resultDrafts.set(interaction.user.id, draft);

                    return interaction.showModal(
                        resultModal(
                            playerId,
                            draft.type,
                            draft.position,
                            playerData(playerId)
                        )
                    );
                }

                /* =========================
                   RESULT EDIT
                ========================= */

                if (
                    id.startsWith(
                        'result_edit:'
                    )
                ) {
                    const playerId =
                        id.split(
                            ':'
                        )[1];

                    const draft =
                        resultDrafts.get(
                            interaction.user.id
                        );

                    const existing =
                        playerData(
                            playerId
                        );

                    return interaction.showModal(
                        resultModal(
                            playerId,
                            draft?.type ||
                                existing?.type ||
                                'striker',
                            draft?.position ||
                                existing?.position ||
                                'CF',
                            draft?.stats ||
                                existing
                        )
                    );
                }

                /* =========================
                   RESULT FINISH
                ========================= */

                if (
                    id.startsWith(
                        'result_finish:'
                    )
                ) {
                    const playerId =
                        id.split(
                            ':'
                        )[1];

                    const draft =
                        resultDrafts.get(
                            interaction.user.id
                        );

                    if (
                        !draft ||
                        !draft.stats
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result draft not found.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // Acknowledge the button immediately. Everything after this
                    // can safely take longer than Discord's 3-second window.
                    const acknowledged =
                        await interaction.deferUpdate()
                            .then(() => true)
                            .catch(() => false);

                    if (!acknowledged) {
                        return;
                    }

                    const old =
                        playerData(
                            playerId
                        );

                    const history =
                        Array.isArray(
                            old?.history
                        )
                            ? [
                                ...old.history
                            ]
                            : [];

                    history.push({
                        ...draft.stats,

                        completedAt:
                            new Date().toISOString()
                    });

                    playerResults[
                        playerId
                    ] = {
                        ...draft.stats,

                        history,

                        updatedAt:
                            new Date().toISOString(),

                        tryoutsCompleted:
                            history.length,

                        bestOVR:
                            Math.max(
                                ...history.map(
                                    item =>
                                        Number(
                                            item.overall
                                        ) ||
                                        0
                                )
                            )
                    };

                    saveJson(
                        PLAYER_FILE,
                        playerResults
                    );

                    const member =
                        await interaction.guild.members.fetch(
                            playerId
                        ).catch(
                            () => null
                        );

                    if (
                        member
                    ) {
                        await interaction.channel.send({
                            content:
                                mentionUser(
                                    playerId
                                ),

                            embeds: [
                                resultEmbed(
                                    member.user,
                                    draft.stats
                                )
                            ],

                            allowedMentions: {
                                users: [
                                    playerId
                                ]
                            }
                        }).catch(
                            () => {}
                        );
                    }

                    resultDrafts.delete(
                        interaction.user.id
                    );

                    return interaction.editReply({
                        content:
                            `✅ **RESULT FINISHED**\n\n` +
                            `Player: ${mentionUser(playerId)}\n` +
                            `OVR: **${draft.stats.overall}**\n` +
                            `Rank: **${draft.stats.rank}**`,

                        embeds: [],

                        components: []
                    });
                }

                /* =========================
                   SCRIM RESULT ROUND BUTTON
                ========================= */

                if (
                    id.startsWith(
                        'scrim_result_round:'
                    )
                ) {
                    const [
                        ,
                        sessionId,
                        roundRaw
                    ] =
                        id.split(
                            ':'
                        );

                    const session =
                        scrimResultSessions.get(
                            sessionId
                        );

                    if (
                        !session ||
                        session.hostId !==
                            interaction.user.id
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.showModal(
                        roundModal(
                            session,
                            Number(
                                roundRaw
                            )
                        )
                    );
                }

                /* =========================
                   SCRIM RESULT PLAYERS
                ========================= */

                if (
                    id.startsWith(
                        'scrim_result_players:'
                    )
                ) {
                    const sessionId =
                        id.split(
                            ':'
                        )[1];

                    const session =
                        scrimResultSessions.get(
                            sessionId
                        );

                    if (
                        !session
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        content:
                            '◇ **SELECT SCRIM PARTICIPANTS**\n\nSelect up to **5** players.',

                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    new UserSelectMenuBuilder()
                                        .setCustomId(
                                            `scrim_result_players:${sessionId}`
                                        )
                                        .setPlaceholder(
                                            'Select up to 5 participants'
                                        )
                                        .setMinValues(
                                            1
                                        )
                                        .setMaxValues(
                                            5
                                        )
                                )
                        ],

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =========================
                   SCRIM RESULT MVP BUTTON
                ========================= */

                if (
                    id.startsWith(
                        'scrim_result_mvp:'
                    )
                ) {
                    const sessionId =
                        id.split(
                            ':'
                        )[1];

                    const session =
                        scrimResultSessions.get(
                            sessionId
                        );

                    if (
                        !session
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        !session.participants.length
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Select the participants first.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.update({
                        content:
                            '◇ **SELECT OVERALL MVP**',

                        embeds: [],

                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    new UserSelectMenuBuilder()
                                        .setCustomId(
                                            `scrim_result_mvp_select:${sessionId}`
                                        )
                                        .setPlaceholder(
                                            'Select overall MVP'
                                        )
                                        .setMinValues(
                                            1
                                        )
                                        .setMaxValues(
                                            1
                                        )
                                )
                        ]
                    });
                }

                /* =========================
                   SCRIM RESULT PUBLISH
                ========================= */

                if (
                    id.startsWith(
                        'scrim_result_publish:'
                    )
                ) {
                    const sessionId =
                        id.split(
                            ':'
                        )[1];

                    const session =
                        scrimResultSessions.get(
                            sessionId
                        );

                    if (
                        !session
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const winningClub =
                        scrimWinner(
                            session
                        );

                    if (
                        !winningClub
                    ) {
                        return interaction.reply({
                            content:
                                '❌ One club must reach **3 round wins**.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        !session.participants.length
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Select participants first.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        !session.mvp
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Select the Overall MVP first.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const result = {
                        id:
                            `𝙎𝙏𝙍𝙄𝙆𝙀𝙍 𝙕-${Date.now()}`,

                        hostId:
                            session.hostId,

                        guildId:
                            interaction.guildId,

                        type:
                            session.type,

                        club1:
                            session.club1,

                        club2:
                            session.club2,

                        winner:
                            winningClub ===
                            1
                                ? session.club1
                                : session.club2,

                        club1Rounds:
                            session.rounds.filter(
                                round =>
                                    round.winner ===
                                    1
                            ).length,

                        club2Rounds:
                            session.rounds.filter(
                                round =>
                                    round.winner ===
                                    2
                            ).length,

                        rounds:
                            [
                                ...session.rounds
                            ],

                        participants:
                            [
                                ...session.participants
                            ],

                        mvp:
                            {
                                ...session.mvp
                            },

                        createdAt:
                            new Date().toISOString()
                    };

                    scrimResults.unshift(
                        result
                    );

                    scrimResults =
                        scrimResults.slice(
                            0,
                            100
                        );

                    saveJson(
                        SCRIM_RESULTS_FILE,
                        scrimResults
                    );

                    const payload = {
                        embeds: [
                            scrimResultPublicEmbed(
                                result
                            )
                        ],

                        allowedMentions: {
                            parse: []
                        }
                    };

                    const membersRole =
                        getMembersRole(
                            interaction.guild
                        );

                    if (
                        membersRole
                    ) {
                        payload.content =
                            mentionRole(
                                membersRole.id
                            );

                        payload.allowedMentions =
                            {
                                roles: [
                                    membersRole.id
                                ]
                            };
                    }

                    await interaction.channel.send(
                        payload
                    );

                    scrimResultSessions.delete(
                        sessionId
                    );

                    return interaction.update({
                        content:
                            '✅ **SCRIM RESULT PUBLISHED**',

                        embeds: [],

                        components: []
                    });
                }

                /* =========================
                   SCRIM RESULT CANCEL
                ========================= */

                if (
                    id.startsWith(
                        'scrim_result_cancel:'
                    )
                ) {
                    const sessionId =
                        id.split(
                            ':'
                        )[1];

                    scrimResultSessions.delete(
                        sessionId
                    );

                    return interaction.update({
                        content:
                            '❌ Scrim result cancelled.',

                        embeds: [],

                        components: []
                    });
                }

                /* =========================
                   ANNOUNCEMENT READY
                ========================= */

                if (
                    id.startsWith(
                        'announcement_ready:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const a =
                        announcements.get(
                            messageId
                        );

                    if (
                        !a
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Announcement expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        !a.ready.includes(
                            interaction.user.id
                        )
                    ) {
                        a.ready.push(
                            interaction.user.id
                        );
                    }

                    await interaction.deferUpdate();

                    await updateAnnouncement(
                        a
                    );

                    return;
                }

                /* =========================
                   ANNOUNCEMENT NOT READY
                ========================= */

                if (
                    id.startsWith(
                        'announcement_notready:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const a =
                        announcements.get(
                            messageId
                        );

                    if (
                        !a
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Announcement expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    a.ready =
                        a.ready.filter(
                            userId =>
                                userId !==
                                interaction.user.id
                        );

                    await interaction.deferUpdate();

                    await updateAnnouncement(
                        a
                    );

                    return;
                }

                /* =========================
                   ANNOUNCEMENT RE-PING
                ========================= */

                if (
                    id.startsWith(
                        'announcement_reping:'
                    )
                ) {
                    const messageId =
                        id.split(
                            ':'
                        )[1];

                    const a =
                        announcements.get(
                            messageId
                        );

                    if (
                        !a
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Announcement expired.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        a.hostId !==
                        interaction.user.id
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Host only.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        a.repingUsed
                    ) {
                        return interaction.reply({
                            content:
                                '⚠️ RE-PING already used.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    a.repingUsed =
                        true;

                    a.phase =
                        'extension';

                    a.extensionEnd =
                        Date.now() +
                        2 *
                            60 *
                            1000;

                    a.repingStarted =
                        true;

                    await updateAnnouncement(
                        a
                    );

                    await pingTryoutRole(
                        a
                    );

                    return interaction.reply({
                        content:
                            '✅ **RE-PING SENT** • 2 minute extension started.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }
            }
        } catch (
            error
        ) {
            console.error(
                '❌ Interaction error:',
                error
            );

            if (
                error?.code ===
                10062
            ) {
                return;
            }

            if (
                interaction.isRepliable() &&
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        '❌ Something went wrong. Check the console.',

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );
            }
        }
    }
);

/* =========================================================
   MESSAGE DELETE
========================================================= */

client.on(
    'messageDelete',
    message => {
        tryouts.delete(
            message.id
        );

        scrims.delete(
            message.id
        );

        announcements.delete(
            message.id
        );

        updatePresence();
    }
);

/* =========================================================
   READY
========================================================= */

client.once(
    'ready',
    () => {
        console.log(
            '=============================================='
        );

        console.log(
            '🚀 Black Dragons BOT V18 ONLINE'
        );

        console.log(
            `🤖 ${client.user.tag}`
        );

        console.log(
            `🖼️ Banner: ${BANNER_URL}`
        );

        console.log(
            `⚡ Hoster Role: ${
                TRYOUT_HOSTER_ROLE_ID
                    ? 'OK'
                    : 'MISSING'
            }`
        );

        console.log(
            `📣 Tryout Ping: ${
                TRYOUT_PING_ROLE_ID
                    ? 'OK'
                    : 'MISSING'
            }`
        );

        console.log(
            `👑 Main Team: ${
                MAIN_TEAM_ROLE_ID
                    ? 'OK'
                    : 'MISSING'
            }`
        );

        console.log(
            `👥 Members Role: ${
                MEMBERS_ROLE_ID
                    ? 'OK'
                    : 'AUTO FIND'
            }`
        );

        console.log(
            '✅ Tryouts loaded'
        );

        console.log(
            '✅ Announcements loaded'
        );

        console.log(
            '✅ Scrims loaded'
        );

        console.log(
            '✅ Scrim results loaded'
        );

        console.log(
            '=============================================='
        );

        updatePresence();
    }
);

process.on(
    'unhandledRejection',
    error => {
        console.error('❌ UNHANDLED REJECTION:', error);
    }
);

process.on(
    'uncaughtException',
    error => {
        console.error('❌ UNCAUGHT EXCEPTION:', error);
    }
);

console.log(
    '🚀 Starting Black Dragons V18...'
);

client.login(
    TOKEN
).catch(
    error => {
        console.error(
            '❌ Login failed:',
            error.message
        );

        process.exit(1);
    }
);
