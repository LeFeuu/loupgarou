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
    CUPIDON: 'cupidon'
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
    constructor(id, hostId) {
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
    }

    addPlayer(playerId, playerName) {
        if (this.players.size >= 12) return false;
        
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

        // Distribution des rôles selon le nombre de joueurs
        let roles = [];
        
        if (playerCount >= 4) {
            roles.push(ROLES.LOUP_GAROU, ROLES.VOYANTE);
            for (let i = 2; i < playerCount; i++) {
                roles.push(ROLES.VILLAGEOIS);
            }
        }
        
        if (playerCount >= 6) {
            roles[roles.length - 1] = ROLES.SORCIERE;
            roles.push(ROLES.VILLAGEOIS);
        }
        
        if (playerCount >= 8) {
            roles[roles.length - 1] = ROLES.CHASSEUR;
            roles.push(ROLES.VILLAGEOIS);
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

        // Traiter les actions des loups-garous
        this.nightActions.forEach((action, playerId) => {
            const player = this.players.get(playerId);
            if (!player || !player.isAlive) return;

            if (player.role === ROLES.LOUP_GAROU && action.action === 'kill') {
                const target = this.players.get(action.targetId);
                if (target && target.isAlive) {
                    target.isAlive = false;
                    killedPlayers.push({
                        playerId: action.targetId,
                        playerName: target.name,
                        killedBy: 'loup-garou'
                    });
                }
            }

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
        });

        // Annoncer les morts de la nuit
        if (killedPlayers.length > 0) {
            io.to(this.id).emit('nightKills', killedPlayers);
        } else {
            io.to(this.id).emit('nightKills', []);
        }
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
            timeRemaining: this.timeRemaining
        };
    }
}

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
    console.log('Nouveau joueur connecté:', socket.id);

    // Rejoindre une partie
    socket.on('joinGame', (data) => {
        const { gameId, playerName } = data;
        let game;

        if (gameId && games.has(gameId)) {
            game = games.get(gameId);
        } else {
            // Créer une nouvelle partie
            const newGameId = uuidv4().substring(0, 6).toUpperCase();
            game = new Game(newGameId, socket.id);
            games.set(newGameId, game);
        }

        if (game.addPlayer(socket.id, playerName)) {
            players.set(socket.id, { gameId: game.id, name: playerName });
            socket.join(game.id);
            
            io.to(game.id).emit('gameUpdate', game.getPublicInfo());
            socket.emit('joinedGame', { gameId: game.id, playerId: socket.id });
        } else {
            socket.emit('error', 'Impossible de rejoindre la partie');
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
                socket.emit('error', 'Minimum 4 joueurs requis');
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
            io.to(game.id).emit('voteUpdate', {
                voter: socket.id,
                target: targetId,
                voteCount: game.votes.size
            });
        }
    });

    // Action de nuit
    socket.on('nightAction', (data) => {
        const { action, targetId } = data;
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameId);
        if (game && game.phase === PHASES.NIGHT) {
            game.nightActions.set(socket.id, { action, targetId });
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
                io.to(game.id).emit('chatMessage', {
                    playerId: socket.id,
                    playerName: player.name,
                    message: message,
                    timestamp: Date.now()
                });
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