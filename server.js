const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Configuration CORS pour le déploiement
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    next();
});

// Stockage des parties et joueurs
const games = new Map();
const players = new Map();

// Rôles disponibles
const ROLES = {
    VILLAGEOIS: 'villageois',
    LOUP_GAROU: 'loup-garou',
    VOYANTE: 'voyante',
    SORCIERE: 'sorciere',
    CHASSEUR: 'chasseur',
    CUPIDON: 'cupidon',
    PETITE_FILLE: 'petite-fille'
};

// Phases de jeu
const PHASES = {
    LOBBY: 'lobby',
    NIGHT: 'night',
    DAY: 'day',
    VOTE: 'vote',
    ENDED: 'ended'
};

class Game {
    constructor(id, hostId, options = {}) {
        this.id = id;
        this.hostId = hostId;
        this.players = new Map();
        this.phase = PHASES.LOBBY;
        this.isStarted = false;
        this.round = 0;
        this.votes = new Map();
        this.nightActions = new Map();
        this.timeRemaining = 0;
        this.timer = null;
        this.confirmedActions = new Set();
        this.lovers = []; // Pour Cupidon
        this.werewolfTarget = null; // Cible sélectionnée par les loups-garous
        this.werewolfVotes = new Map(); // Votes des loups-garous : playerId -> targetId
        this.roleConfig = { // Configuration des rôles par l'hôte
            loupGarou: 1,
            voyante: true,
            sorciere: false,
            chasseur: false,
            cupidon: false,
            petiteFille: false,
            autoBalance: true // Équilibrage automatique
        };
        // Nouvelles propriétés pour les parties publiques/privées
        this.isPublic = options.isPublic || false;
        this.maxPlayers = options.maxPlayers || 10;
        this.gameName = options.gameName || 'Partie de Loup-Garou';
        this.createdAt = new Date();
    }

    addPlayer(playerId, playerName) {
        if (this.players.size >= this.maxPlayers) return false;
        
        this.players.set(playerId, {
            id: playerId,
            name: playerName,
            role: null,
            isAlive: true,
            isReady: false,
            votes: 0
        });
        return true;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        if (this.hostId === playerId && this.players.size > 0) {
            this.hostId = this.players.keys().next().value;
        }
    }

    assignRoles() {
        const playerIds = Array.from(this.players.keys());
        const playerCount = playerIds.length;
        
        if (playerCount < 4) return false;

        let roles = [];
        
        if (this.roleConfig.autoBalance) {
            // Mode automatique (ancien système)
            roles.push(ROLES.LOUP_GAROU, ROLES.VOYANTE);
            
            for (let i = 2; i < playerCount; i++) {
                roles.push(ROLES.VILLAGEOIS);
            }
            
            if (playerCount >= 5 && this.roleConfig.sorciere) {
                roles[roles.length - 1] = ROLES.SORCIERE;
                roles.push(ROLES.VILLAGEOIS);
            }
            
            if (playerCount >= 6 && this.roleConfig.chasseur) {
                roles[roles.length - 1] = ROLES.CHASSEUR;
                roles.push(ROLES.VILLAGEOIS);
            }
            
            if (playerCount >= 7 && this.roleConfig.cupidon) {
                roles[roles.length - 1] = ROLES.CUPIDON;
                roles.push(ROLES.VILLAGEOIS);
            }
            
            if (playerCount >= 8 && this.roleConfig.petiteFille) {
                roles[roles.length - 1] = ROLES.PETITE_FILLE;
                roles.push(ROLES.VILLAGEOIS);
            }
            
            if (playerCount >= 9) {
                roles[roles.length - 1] = ROLES.LOUP_GAROU;
                roles.push(ROLES.VILLAGEOIS);
            }
        } else {
            // Mode configuration manuelle
            // Ajouter les loups-garous
            for (let i = 0; i < this.roleConfig.loupGarou; i++) {
                roles.push(ROLES.LOUP_GAROU);
            }
            
            // Ajouter la voyante si activée
            if (this.roleConfig.voyante) {
                roles.push(ROLES.VOYANTE);
            }
            
            // Ajouter les autres rôles si activés
            if (this.roleConfig.sorciere) roles.push(ROLES.SORCIERE);
            if (this.roleConfig.chasseur) roles.push(ROLES.CHASSEUR);
            if (this.roleConfig.cupidon) roles.push(ROLES.CUPIDON);
            if (this.roleConfig.petiteFille) roles.push(ROLES.PETITE_FILLE);
            
            // Compléter avec des villageois
            while (roles.length < playerCount) {
                roles.push(ROLES.VILLAGEOIS);
            }
            
            // Vérifier l'équilibre (au moins 1 loup, pas trop de loups)
            const werewolfCount = roles.filter(r => r === ROLES.LOUP_GAROU).length;
            if (werewolfCount === 0 || werewolfCount >= Math.ceil(playerCount / 2)) {
                return false; // Configuration invalide
            }
        }

        // Mélanger les rôles
        for (let i = roles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [roles[i], roles[j]] = [roles[j], roles[i]];
        }

        // Assigner les rôles
        playerIds.forEach((playerId, index) => {
            this.players.get(playerId).role = roles[index];
        });

        return true;
    }

    startGame() {
        if (this.players.size < 4) return false;
        
        this.assignRoles();
        this.isStarted = true;
        this.phase = PHASES.NIGHT;
        this.round = 1;
        this.startTimer(60); // 60 secondes pour la nuit
        
        return true;
    }

    startTimer(seconds) {
        this.timeRemaining = seconds;
        this.timer = setInterval(() => {
            this.timeRemaining--;
            // Envoyer la mise à jour du timer à tous les joueurs
            io.to(this.id).emit('timerUpdate', {
                timeRemaining: this.timeRemaining,
                phase: this.phase
            });
            
            if (this.timeRemaining <= 0) {
                this.nextPhase();
            }
        }, 1000);
    }

    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    nextPhase() {
        this.clearTimer();
        
        switch (this.phase) {
            case PHASES.NIGHT:
                // Traiter les actions nocturnes
                this.processNightActions();
                this.phase = PHASES.DAY;
                this.startTimer(120); // 2 minutes pour le jour
                break;
            case PHASES.DAY:
                this.phase = PHASES.VOTE;
                this.startTimer(60); // 1 minute pour voter
                break;
            case PHASES.VOTE:
                this.processVotes();
                if (this.checkWinCondition()) {
                    this.phase = PHASES.ENDED;
                    io.to(this.id).emit('gameEnded', {
                        winner: this.getWinner(),
                        players: Array.from(this.players.values())
                    });
                    return;
                } else {
                    this.phase = PHASES.NIGHT;
                    this.round++;
                    this.startTimer(60);
                }
                break;
        }
        
        this.votes.clear();
        this.nightActions.clear();
        this.confirmedActions.clear(); // Reset des actions confirmées
        this.werewolfVotes.clear(); // Reset des votes des loups-garous
        
        // Envoyer la mise à jour de phase à tous les joueurs
        io.to(this.id).emit('phaseChanged', this.getPublicInfo());
    }

    processVotes() {
        // Compter les votes
        const voteCounts = new Map();
        this.votes.forEach((target, voter) => {
            if (this.players.get(voter)?.isAlive && this.players.get(target)?.isAlive) {
                voteCounts.set(target, (voteCounts.get(target) || 0) + 1);
            }
        });

        // Trouver le joueur avec le plus de votes
        let maxVotes = 0;
        let eliminated = null;
        voteCounts.forEach((votes, playerId) => {
            if (votes > maxVotes) {
                maxVotes = votes;
                eliminated = playerId;
            }
        });

        // Éliminer le joueur
        if (eliminated && maxVotes > 0) {
            this.players.get(eliminated).isAlive = false;
            io.to(this.id).emit('playerEliminated', {
                playerId: eliminated,
                playerName: this.players.get(eliminated).name,
                reason: 'vote',
                votes: maxVotes
            });
        }

        return eliminated;
    }

    processNightActions() {
        const killedPlayers = [];
        const seenRoles = [];
        let hunterRevenge = null;

        // Calculer le vote majoritaire des loups-garous
        let werewolfKill = null;
        if (this.werewolfVotes.size > 0) {
            const voteCount = new Map();
            
            // Compter les votes
            this.werewolfVotes.forEach((targetId, voterId) => {
                if (!voteCount.has(targetId)) {
                    voteCount.set(targetId, 0);
                }
                voteCount.set(targetId, voteCount.get(targetId) + 1);
            });
            
            // Trouver la majorité
            let maxVotes = 0;
            let winners = [];
            
            voteCount.forEach((votes, targetId) => {
                if (votes > maxVotes) {
                    maxVotes = votes;
                    winners = [targetId];
                } else if (votes === maxVotes) {
                    winners.push(targetId);
                }
            });
            
            // Si égalité, personne ne meurt par les loups-garous
            if (winners.length === 1) {
                werewolfKill = winners[0];
            }
            
            // Informer les loups-garous du résultat
            const aliveWerewolves = Array.from(this.players.values()).filter(p => 
                p.role === ROLES.LOUP_GAROU && p.isAlive
            );
            
            aliveWerewolves.forEach(werewolf => {
                let message;
                if (werewolfKill) {
                    const targetName = this.players.get(werewolfKill)?.name;
                    message = `Vote majoritaire : ${targetName} sera éliminé(e) (${maxVotes} votes)`;
                } else {
                    message = `Égalité dans les votes : personne ne sera tué cette nuit`;
                }
                
                io.to(werewolf.id).emit('werewolfVoteResult', {
                    targetId: werewolfKill,
                    message: message,
                    voteCount: Array.from(voteCount.entries())
                });
            });
        }
        
        this.nightActions.forEach((action, playerId) => {
            const player = this.players.get(playerId);
            if (!player || !player.isAlive) return;

            if (player.role === ROLES.VOYANTE && action.action === 'see') {
                const target = this.players.get(action.targetId);
                if (target && target.isAlive) {
                    // Envoyer le rôle seulement au voyant
                    io.to(playerId).emit('roleRevealed', {
                        playerId: action.targetId,
                        playerName: target.name,
                        role: target.role
                    });
                }
            }

            if (player.role === ROLES.CUPIDON && action.action === 'link' && this.round === 1) {
                // Cupidon ne peut agir qu'au premier tour
                if (action.targets && action.targets.length === 2) {
                    this.lovers = action.targets;
                    // Informer les amoureux
                    action.targets.forEach(loverId => {
                        const otherLover = action.targets.find(id => id !== loverId);
                        const otherLoverName = this.players.get(otherLover)?.name;
                        io.to(loverId).emit('becameLover', {
                            partnerName: otherLoverName
                        });
                    });
                }
            }

            if (player.role === ROLES.SORCIERE && action.action === 'heal' && werewolfKill) {
                // Annuler la mort du loup-garou
                werewolfKill = null;
            }

            if (player.role === ROLES.SORCIERE && action.action === 'poison') {
                const target = this.players.get(action.targetId);
                if (target && target.isAlive) {
                    target.isAlive = false;
                    killedPlayers.push({
                        playerId: action.targetId,
                        playerName: target.name,
                        killedBy: 'sorciere'
                    });
                }
            }
        });

        // Appliquer la mort par loup-garou si pas soignée
        if (werewolfKill) {
            const target = this.players.get(werewolfKill);
            if (target && target.isAlive) {
                target.isAlive = false;
                killedPlayers.push({
                    playerId: werewolfKill,
                    playerName: target.name,
                    killedBy: 'loup-garou'
                });

                // Vérifier si c'est le chasseur
                if (target.role === ROLES.CHASSEUR) {
                    hunterRevenge = werewolfKill;
                }

                // Vérifier si c'est un amoureux
                if (this.lovers.includes(werewolfKill)) {
                    const otherLover = this.lovers.find(id => id !== werewolfKill);
                    const otherLoverPlayer = this.players.get(otherLover);
                    if (otherLoverPlayer && otherLoverPlayer.isAlive) {
                        otherLoverPlayer.isAlive = false;
                        killedPlayers.push({
                            playerId: otherLover,
                            playerName: otherLoverPlayer.name,
                            killedBy: 'amour'
                        });
                    }
                }
            }
        }

        // Annoncer les morts de la nuit
        io.to(this.id).emit('nightKills', {
            killedPlayers,
            hunterRevenge
        });

        // Reset de la sélection et des votes des loups-garous
        this.werewolfTarget = null;
        this.werewolfVotes.clear();
    }

    getWinner() {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        const aliveWerewolves = alivePlayers.filter(p => p.role === ROLES.LOUP_GAROU);
        
        if (aliveWerewolves.length === 0) {
            return 'villagers';
        } else if (aliveWerewolves.length >= alivePlayers.filter(p => p.role !== ROLES.LOUP_GAROU).length) {
            return 'werewolves';
        }
        return null;
    }

    checkAllActionsConfirmed() {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        let expectedActions = 0;
        
        switch (this.phase) {
            case PHASES.NIGHT:
                // Compter les rôles actifs la nuit
                const aliveWerewolves = alivePlayers.filter(p => p.role === ROLES.LOUP_GAROU);
                expectedActions += aliveWerewolves.length; // Chaque loup-garou doit voter
                
                alivePlayers.forEach(player => {
                    if (player.role === ROLES.VOYANTE ||
                        player.role === ROLES.SORCIERE ||
                        (player.role === ROLES.CUPIDON && this.round === 1)) {
                        expectedActions++;
                    }
                });
                break;
                
            case PHASES.VOTE:
                // Tous les joueurs vivants doivent voter
                expectedActions = alivePlayers.length;
                break;
                
            case PHASES.DAY:
                // Pas d'actions obligatoires le jour, mais on peut accélérer si assez de monde confirme
                expectedActions = Math.ceil(alivePlayers.length * 0.7); // 70% des joueurs
                break;
        }
        
        return this.confirmedActions.size >= expectedActions;
    }

    accelerateTimer() {
        if (this.timeRemaining > 10) {
            this.timeRemaining = 10;
            io.to(this.id).emit('timerAccelerated', {
                timeRemaining: this.timeRemaining,
                message: 'Timer accéléré - Toutes les actions confirmées !'
            });
        }
    }

    checkWinCondition() {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        const aliveWerewolves = alivePlayers.filter(p => p.role === ROLES.LOUP_GAROU);
        const aliveVillagers = alivePlayers.filter(p => p.role !== ROLES.LOUP_GAROU);

        // Les villageois gagnent si tous les loups-garous sont morts
        if (aliveWerewolves.length === 0) {
            return true;
        }
        
        // Les loups-garous gagnent s'ils égalent ou dépassent le nombre de villageois
        if (aliveWerewolves.length >= aliveVillagers.length) {
            return true;
        }
        
        return false;
    }

    getPublicInfo() {
        return {
            id: this.id,
            hostId: this.hostId,
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                isAlive: p.isAlive,
                isReady: p.isReady
            })),
            phase: this.phase,
            isStarted: this.isStarted,
            round: this.round,
            timeRemaining: this.timeRemaining,
            roleConfig: this.roleConfig,
            isPublic: this.isPublic,
            maxPlayers: this.maxPlayers,
            gameName: this.gameName,
            createdAt: this.createdAt
        };
    }
}

// Fonction pour obtenir les parties publiques disponibles
function getPublicGames() {
    const publicGames = [];
    for (const game of games.values()) {
        if (game.isPublic && !game.isStarted && game.players.size < game.maxPlayers) {
            publicGames.push({
                id: game.id,
                gameName: game.gameName,
                hostName: Array.from(game.players.values()).find(p => p.id === game.hostId)?.name || 'Hôte',
                currentPlayers: game.players.size,
                maxPlayers: game.maxPlayers,
                createdAt: game.createdAt
            });
        }
    }
    // Trier par date de création (plus récent en premier)
    return publicGames.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
    console.log('Nouveau joueur connecté:', socket.id);

    // Obtenir la liste des parties publiques
    socket.on('getPublicGames', () => {
        socket.emit('publicGamesList', getPublicGames());
    });

    // Créer une nouvelle partie
    socket.on('createGame', (data) => {
        const { playerName, isPublic = false, maxPlayers = 10, gameName } = data;
        
        const newGameId = uuidv4().substring(0, 6).toUpperCase();
        const gameOptions = {
            isPublic,
            maxPlayers: Math.max(4, Math.min(maxPlayers, 12)), // Entre 4 et 12 joueurs
            gameName: gameName || `Partie de ${playerName}`
        };
        
        const game = new Game(newGameId, socket.id, gameOptions);
        games.set(newGameId, game);
        
        if (game.addPlayer(socket.id, playerName)) {
            players.set(socket.id, { gameId: game.id, name: playerName });
            socket.join(game.id);
            
            socket.emit('gameCreated', { 
                gameId: game.id, 
                playerId: socket.id,
                gameInfo: game.getPublicInfo()
            });
            
            // Notifier tous les clients des parties publiques mises à jour
            if (isPublic) {
                io.emit('publicGamesUpdated', getPublicGames());
            }
        } else {
            socket.emit('error', 'Impossible de créer la partie');
        }
    });

    // Rejoindre une partie existante
    socket.on('joinGame', (data) => {
        const { gameId, playerName } = data;
        
        if (!gameId || !games.has(gameId)) {
            socket.emit('error', 'Partie introuvable');
            return;
        }
        
        const game = games.get(gameId);
        
        if (game.addPlayer(socket.id, playerName)) {
            players.set(socket.id, { gameId: game.id, name: playerName });
            socket.join(game.id);
            
            io.to(game.id).emit('gameUpdate', game.getPublicInfo());
            socket.emit('joinedGame', { gameId: game.id, playerId: socket.id });
            
            // Mettre à jour la liste des parties publiques si nécessaire
            if (game.isPublic) {
                io.emit('publicGamesUpdated', getPublicGames());
            }
        } else {
            socket.emit('error', 'Impossible de rejoindre la partie (complète ou déjà commencée)');
        }
    });

    // Démarrer la partie
    socket.on('startGame', () => {
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameId);
        if (game && game.hostId === socket.id) {
            if (game.startGame()) {
                // Envoyer les rôles aux joueurs
                game.players.forEach((player, playerId) => {
                    io.to(playerId).emit('roleAssigned', {
                        role: player.role,
                        gameInfo: game.getPublicInfo()
                    });
                });
                
                io.to(game.id).emit('gameStarted', game.getPublicInfo());
            } else {
                socket.emit('error', 'Impossible de démarrer : minimum 4 joueurs requis ou configuration de rôles invalide');
            }
        }
    });

    // Configuration des rôles (seulement pour l'hôte)
    socket.on('updateRoleConfig', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameId);
        if (game && game.hostId === socket.id && !game.isStarted) {
            // Mettre à jour la configuration
            if (data.roleConfig) {
                game.roleConfig = { ...game.roleConfig, ...data.roleConfig };
                
                // Valider la configuration
                const playerCount = game.players.size;
                if (!game.roleConfig.autoBalance) {
                    // Vérifier que la config manuelle est valide
                    const totalSpecialRoles = 
                        game.roleConfig.loupGarou +
                        (game.roleConfig.voyante ? 1 : 0) +
                        (game.roleConfig.sorciere ? 1 : 0) +
                        (game.roleConfig.chasseur ? 1 : 0) +
                        (game.roleConfig.cupidon ? 1 : 0) +
                        (game.roleConfig.petiteFille ? 1 : 0);
                    
                    if (totalSpecialRoles > playerCount) {
                        socket.emit('error', 'Trop de rôles spéciaux pour le nombre de joueurs');
                        return;
                    }
                    
                    if (game.roleConfig.loupGarou === 0) {
                        socket.emit('error', 'Il faut au moins 1 loup-garou');
                        return;
                    }
                    
                    if (game.roleConfig.loupGarou >= Math.ceil(playerCount / 2)) {
                        socket.emit('error', 'Trop de loups-garous par rapport aux villageois');
                        return;
                    }
                }
                
                // Envoyer la mise à jour à tous les joueurs
                io.to(game.id).emit('roleConfigUpdated', {
                    roleConfig: game.roleConfig,
                    gameInfo: game.getPublicInfo()
                });
            }
        }
    });

    // Vote
    socket.on('vote', (data) => {
        const { targetId } = data;
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameId);
        if (game && game.phase === PHASES.VOTE) {
            game.votes.set(socket.id, targetId);
            game.confirmedActions.add(socket.id); // Marquer comme confirmé
            
            io.to(game.id).emit('voteUpdate', {
                voter: socket.id,
                target: targetId,
                voteCount: game.votes.size,
                confirmedCount: game.confirmedActions.size
            });
            
            // Vérifier si toutes les actions sont confirmées
            if (game.checkAllActionsConfirmed()) {
                game.accelerateTimer();
            }
        }
    });

    // Action de nuit
    socket.on('nightAction', (data) => {
        const { action, targetId, targets } = data;
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameId);
        if (game && game.phase === PHASES.NIGHT) {
            const player = game.players.get(socket.id);
            
            // Gestion spéciale pour les loups-garous (vote et synchronisation)
            if (player.role === ROLES.LOUP_GAROU && action === 'select') {
                game.werewolfTarget = targetId;
                // Informer tous les loups-garous de la sélection temporaire
                game.players.forEach((p, pId) => {
                    if (p.role === ROLES.LOUP_GAROU && p.isAlive) {
                        io.to(pId).emit('werewolfSelection', {
                            selectedBy: socket.id,
                            selectedByName: player.name,
                            targetId: targetId,
                            targetName: game.players.get(targetId)?.name
                        });
                    }
                });
            }
            
            // Vote final des loups-garous
            if (player.role === ROLES.LOUP_GAROU && action === 'kill') {
                game.werewolfVotes.set(socket.id, targetId);
                game.confirmedActions.add(socket.id);
                
                // Informer tous les loups-garous du vote
                const aliveWerewolves = Array.from(game.players.values()).filter(p => 
                    p.role === ROLES.LOUP_GAROU && p.isAlive
                );
                
                game.players.forEach((p, pId) => {
                    if (p.role === ROLES.LOUP_GAROU && p.isAlive) {
                        io.to(pId).emit('werewolfVoteUpdate', {
                            voterName: player.name,
                            targetId: targetId,
                            targetName: game.players.get(targetId)?.name,
                            votesCount: game.werewolfVotes.size,
                            totalWerewolves: aliveWerewolves.length
                        });
                    }
                });
            }
            
            // Confirmer d'autres actions
            else if (player.role === ROLES.CUPIDON && action === 'link') {
                game.nightActions.set(socket.id, { action, targets });
                game.confirmedActions.add(socket.id);
            } else if (player.role !== ROLES.LOUP_GAROU) {
                // Tous les autres rôles sauf loups-garous
                game.nightActions.set(socket.id, { action, targetId });
                game.confirmedActions.add(socket.id);
            }
            
            io.to(game.id).emit('actionConfirmed', {
                playerId: socket.id,
                confirmedCount: game.confirmedActions.size
            });
            
            // Vérifier si toutes les actions sont confirmées
            if (game.checkAllActionsConfirmed()) {
                game.accelerateTimer();
            }
        }
    });

    // Nouvelle action : Confirmer pendant le jour (optionnel)
    socket.on('confirmDay', () => {
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameId);
        if (game && game.phase === PHASES.DAY) {
            game.confirmedActions.add(socket.id);
            
            io.to(game.id).emit('dayConfirmed', {
                playerId: socket.id,
                confirmedCount: game.confirmedActions.size
            });
            
            // Vérifier si assez de joueurs ont confirmé
            if (game.checkAllActionsConfirmed()) {
                game.accelerateTimer();
            }
        }
    });

    // Chat
    socket.on('chatMessage', (data) => {
        const { message } = data;
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameId);
        if (game) {
            const player = game.players.get(socket.id);
            if (player && player.isAlive) {
                // Chat nocturne spécial pour les loups-garous
                if (game.phase === PHASES.NIGHT && player.role === ROLES.LOUP_GAROU) {
                    // Envoyer seulement aux autres loups-garous vivants
                    game.players.forEach((p, pId) => {
                        if (p.role === ROLES.LOUP_GAROU && p.isAlive) {
                            io.to(pId).emit('werewolfChat', {
                                playerId: socket.id,
                                playerName: player.name,
                                message: message,
                                timestamp: Date.now()
                            });
                        }
                    });
                    
                    // La petite fille peut aussi voir si elle "espionne"
                    game.players.forEach((p, pId) => {
                        if (p.role === ROLES.PETITE_FILLE && p.isAlive) {
                            io.to(pId).emit('spyChat', {
                                message: `🐺 ${player.name}: ${message}`,
                                timestamp: Date.now()
                            });
                        }
                    });
                } else if (game.phase !== PHASES.NIGHT) {
                    // Chat normal pendant le jour
                    io.to(game.id).emit('chatMessage', {
                        playerId: socket.id,
                        playerName: player.name,
                        message: message,
                        timestamp: Date.now()
                    });
                }
            }
        }
    });

    // Déconnexion
    socket.on('disconnect', () => {
        console.log('Joueur déconnecté:', socket.id);
        
        const playerData = players.get(socket.id);
        if (playerData) {
            const game = games.get(playerData.gameId);
            if (game) {
                game.removePlayer(socket.id);
                
                if (game.players.size === 0) {
                    game.clearTimer();
                    games.delete(game.id);
                } else {
                    io.to(game.id).emit('gameUpdate', game.getPublicInfo());
                }
            }
            players.delete(socket.id);
        }
    });
});

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrer le serveur
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Accédez au jeu sur http://localhost:${PORT}`);
});