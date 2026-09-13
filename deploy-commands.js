require('dotenv').config();

const {
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

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

const CLIENT_ID = String(
    process.env.CLIENT_ID ||
    process.env.DISCORD_CLIENT_ID ||
    ''
)
    .trim()
    .replace(/^["']|["']$/g, '');

const GUILD_ID = String(
    process.env.GUILD_ID ||
    process.env.DISCORD_GUILD_ID ||
    ''
)
    .trim()
    .replace(/^["']|["']$/g, '');

if (!TOKEN) {
    console.error(
        '❌ TOKEN / DISCORD_TOKEN is missing.'
    );
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error(
        '❌ CLIENT_ID / DISCORD_CLIENT_ID is missing.'
    );
    process.exit(1);
}

if (!GUILD_ID) {
    console.error(
        '❌ GUILD_ID / DISCORD_GUILD_ID is missing.'
    );
    process.exit(1);
}

/* =========================================================
   /TRYOUT
========================================================= */

const tryoutCommand =
    new SlashCommandBuilder()
        .setName('tryout')
        .setDescription(
            'Black Dragons Tryout Hub'
        )

        /* =====================================================
           /tryout create
        ===================================================== */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('create')
                    .setDescription(
                        'Create an Black Dragons tryout lobby'
                    )
        )

        /* =====================================================
           /tryout close
        ===================================================== */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('close')
                    .setDescription(
                        'Close your active tryout lobby'
                    )
        )

        /* =====================================================
           /tryout results
        ===================================================== */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('results')
                    .setDescription(
                        'Create a player tryout result'
                    )
        )

        /* =====================================================
           /tryout leaderboard
        ===================================================== */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('leaderboard')
                    .setDescription(
                        'Show the Black Dragons player leaderboard'
                    )
        )

        /* =====================================================
           /tryout profile
        ===================================================== */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('profile')
                    .setDescription(
                        'Show a player profile'
                    )
                    .addUserOption(
                        option =>
                            option
                                .setName('player')
                                .setDescription(
                                    'Player to view'
                                )
                                .setRequired(
                                    false
                                )
                    )
        )

        /* =====================================================
           /tryout announce
        ===================================================== */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('announce')
                    .setDescription(
                        'Create a tryout announcement'
                    )
                    .addStringOption(
                        option =>
                            option
                                .setName('unit')
                                .setDescription(
                                    'Minutes or hours'
                                )
                                .setRequired(
                                    true
                                )
                                .addChoices(
                                    {
                                        name:
                                            'Minutes',
                                        value:
                                            'minutes'
                                    },
                                    {
                                        name:
                                            'Hours',
                                        value:
                                            'hours'
                                    }
                                )
                    )
                    .addIntegerOption(
                        option =>
                            option
                                .setName('amount')
                                .setDescription(
                                    'How long the announcement should stay active'
                                )
                                .setRequired(
                                    true
                                )
                                .setMinValue(
                                    1
                                )
                                .setMaxValue(
                                    240
                                )
                    )
        )

        /* =====================================================
           /tryout scrim
        ===================================================== */

        .addSubcommandGroup(
            group =>
                group
                    .setName('scrim')
                    .setDescription(
                        'Black Dragons scrim controls'
                    )

                    /* =========================================
                       /tryout scrim create
                    ========================================= */

                    .addSubcommand(
                        subcommand =>
                            subcommand
                                .setName('create')
                                .setDescription(
                                    'Create an Black Dragons scrim'
                                )
                    )

                    /* =========================================
                       /tryout scrim close
                    ========================================= */

                    .addSubcommand(
                        subcommand =>
                            subcommand
                                .setName('close')
                                .setDescription(
                                    'Close your active scrim'
                                )
                    )
        );

/* =========================================================
   /SCRIM
========================================================= */

const scrimCommand =
    new SlashCommandBuilder()
        .setName('scrim')
        .setDescription(
            'Black Dragons scrim result tools'
        )

        /* =====================================================
           /scrim results
        ===================================================== */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('results')
                    .setDescription(
                        'Create an official scrim result'
                    )
        );

/* =========================================================
   COMMAND DATA
========================================================= */

const commands = [
    tryoutCommand.toJSON(),
    scrimCommand.toJSON()
];

/* =========================================================
   REST
========================================================= */

const rest =
    new REST({
        version: '10'
    }).setToken(
        TOKEN
    );

/* =========================================================
   REGISTER
========================================================= */

(async () => {
    try {
        console.log(
            '=============================================='
        );

        console.log(
            '⏳ Registering Black Dragons commands...'
        );

        console.log(
            `🤖 Client ID: ${CLIENT_ID}`
        );

        console.log(
            `🏠 Guild ID: ${GUILD_ID}`
        );

        console.log('');

        console.log(
            '⚡ Commands being registered:'
        );

        console.log(
            '   /tryout create'
        );

        console.log(
            '   /tryout close'
        );

        console.log(
            '   /tryout results'
        );

        console.log(
            '   /tryout leaderboard'
        );

        console.log(
            '   /tryout profile'
        );

        console.log(
            '   /tryout announce'
        );

        console.log(
            '   /tryout scrim create'
        );

        console.log(
            '   /tryout scrim close'
        );

        console.log(
            '   /scrim results'
        );

        console.log('');

        await rest.put(
            Routes.applicationGuildCommands(
                CLIENT_ID,
                GUILD_ID
            ),
            {
                body:
                    commands
            }
        );

        console.log(
            '=============================================='
        );

        console.log(
            '✅ Black Dragons COMMANDS REGISTERED'
        );

        console.log(
            '=============================================='
        );

        console.log('');

        console.log(
            '⚡ Registered commands:'
        );

        console.log(
            '   /tryout create'
        );

        console.log(
            '   /tryout close'
        );

        console.log(
            '   /tryout results'
        );

        console.log(
            '   /tryout leaderboard'
        );

        console.log(
            '   /tryout profile'
        );

        console.log(
            '   /tryout announce'
        );

        console.log(
            '   /tryout scrim create'
        );

        console.log(
            '   /tryout scrim close'
        );

        console.log(
            '   /scrim results'
        );

        console.log('');

        console.log(
            '✅ SCRIM + TRYOUT COMMANDS ARE REGISTERED.'
        );

    } catch (error) {
        console.error(
            ''
        );

        console.error(
            '=============================================='
        );

        console.error(
            '❌ FAILED TO REGISTER Black Dragons COMMANDS'
        );

        console.error(
            '=============================================='
        );

        console.error(
            error
        );

        process.exit(1);
    }
})();