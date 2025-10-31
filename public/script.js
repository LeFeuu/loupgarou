// Connexion WebSocket
const socket = io();

// État de l'application
let gameState = {
    currentScreen: 'home',
    playerId: null,
    gameId: null,
    playerRole: null,
    isHost: false,
    selectedTarget: null,
    players: [],
    phase: 'lobby',
    timeRemaining: 0,
    roleConfig: {
        loupGarou: 1,
        voyante: true,
        sorciere: false,
        chasseur: false,
        cupidon: false,
        petiteFille: false,
        autoBalance: true
    }
};

// Éléments DOM
const screens = {
    home: document.getElementById('homeScreen'),
    lobby: document.getElementById('lobbyScreen'),
    game: document.getElementById('gameScreen'),
    end: document.getElementById('endScreen')
};

const elements = {
    // Home screen
    createGameBtn: document.getElementById('createGameBtn'),
    joinGameBtn: document.getElementById('joinGameBtn'),
    
    // Create game modal
    createModal: document.getElementById('createModal'),
    closeCreateModal: document.getElementById('closeCreateModal'),
    hostPlayerName: document.getElementById('hostPlayerName'),
    gameNameInput: document.getElementById('gameNameInput'),
    publicGame: document.getElementById('publicGame'),
    privateGame: document.getElementById('privateGame'),
    maxPlayersSelect: document.getElementById('maxPlayersSelect'),
    confirmCreateGame: document.getElementById('confirmCreateGame'),
    
    // Join game modal
    joinModal: document.getElementById('joinModal'),
    closeModal: document.getElementById('closeModal'),
    playerName: document.getElementById('playerName'),
    gameId: document.getElementById('gameId'),
    confirmJoin: document.getElementById('confirmJoin'),
    modalTitle: document.getElementById('modalTitle'),
    gameIdGroup: document.getElementById('gameIdGroup'),
    
    // Public games list
    publicGamesList: document.getElementById('publicGamesList'),
    
    // Lobby screen
    currentGameId: document.getElementById('currentGameId'),
    copyCodeBtn: document.getElementById('copyCodeBtn'),
    leaveLobbyBtn: document.getElementById('leaveLobbyBtn'),
    playersList: document.getElementById('playersList'),
    playerCount: document.getElementById('playerCount'),
    hostControls: document.getElementById('hostControls'),
    startGameBtn: document.getElementById('startGameBtn'),
    
    // Game screen
    currentPhase: document.getElementById('currentPhase'),
    roundNumber: document.getElementById('roundNumber'),
    timeRemaining: document.getElementById('timeRemaining'),
    playerRole: document.getElementById('playerRole'),
    gamePlayersList: document.getElementById('gamePlayersList'),
    actionTitle: document.getElementById('actionTitle'),
    actionContent: document.getElementById('actionContent'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    sendChatBtn: document.getElementById('sendChatBtn'),
    
    // End screen
    winnerTitle: document.getElementById('winnerTitle'),
    winnerSubtitle: document.getElementById('winnerSubtitle'),
    finalPlayersList: document.getElementById('finalPlayersList'),
    newGameBtn: document.getElementById('newGameBtn'),
    backToMenuBtn: document.getElementById('backToMenuBtn')
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    showScreen('home');
    loadPublicGames();
});

function loadPublicGames() {
    socket.emit('getPublicGames');
}

// Gestion des événements
function initializeEventListeners() {
    // Home screen events
    elements.createGameBtn.addEventListener('click', openCreateModal);
    elements.joinGameBtn.addEventListener('click', openJoinModal);
    
    // Create game modal events
    elements.closeCreateModal.addEventListener('click', closeCreateModal);
    elements.confirmCreateGame.addEventListener('click', handleCreateGame);
    elements.hostPlayerName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleCreateGame();
    });
    
    // Join game modal events
    elements.closeModal.addEventListener('click', closeJoinModal);
    elements.confirmJoin.addEventListener('click', handleJoinGame);
    elements.playerName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleJoinGame();
    });
    elements.gameId.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleJoinGame();
    });
    
    // Lobby events
    elements.copyCodeBtn.addEventListener('click', copyGameCode);
    elements.leaveLobbyBtn.addEventListener('click', leaveGame);
    elements.startGameBtn.addEventListener('click', startGame);
    
    // Game events
    elements.sendChatBtn.addEventListener('click', sendChatMessage);
    elements.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    
    // End screen events
    elements.newGameBtn.addEventListener('click', () => showScreen('home'));
    elements.backToMenuBtn.addEventListener('click', () => showScreen('home'));
    
    // Modal events
    elements.joinModal.addEventListener('click', (e) => {
        if (e.target === elements.joinModal) closeJoinModal();
    });
    
    elements.createModal.addEventListener('click', (e) => {
        if (e.target === elements.createModal) closeCreateModal();
    });
}

// Socket events
socket.on('joinedGame', (data) => {
    gameState.playerId = data.playerId;
    gameState.gameId = data.gameId;
    elements.currentGameId.textContent = data.gameId;
    showScreen('lobby');
    showNotification('Connexion réussie !', 'success');
});

socket.on('gameUpdate', (data) => {
    gameState.players = data.players;
    gameState.isHost = data.hostId === gameState.playerId;
    gameState.roleConfig = data.roleConfig || {};
    updateLobby(data);
});

socket.on('roleConfigUpdated', (data) => {
    gameState.roleConfig = data.roleConfig;
    updateRoleConfigDisplay();
    showNotification('Configuration des rôles mise à jour', 'success');
});

socket.on('gameCreated', (data) => {
    gameState.playerId = data.playerId;
    gameState.gameId = data.gameId;
    gameState.players = data.gameInfo.players;
    gameState.isHost = data.gameInfo.hostId === gameState.playerId;
    gameState.roleConfig = data.gameInfo.roleConfig || {};
    elements.currentGameId.textContent = data.gameId;
    showScreen('lobby');
    showNotification('Partie créée avec succès !', 'success');
});

socket.on('publicGamesList', (games) => {
    displayPublicGames(games);
});

socket.on('publicGamesUpdated', (games) => {
    displayPublicGames(games);
});

socket.on('roleAssigned', (data) => {
    gameState.playerRole = data.role;
    updateRoleDisplay(data.role);
    showNotification(`Votre rôle: ${getRoleDisplayName(data.role)}`, 'success');
});

socket.on('gameStarted', (data) => {
    gameState.phase = data.phase;
    gameState.round = data.round;
    showScreen('game');
    updateGameDisplay(data);
    showNotification('La partie commence !', 'success');
});

socket.on('phaseChanged', (data) => {
    gameState.phase = data.phase;
    gameState.timeRemaining = data.timeRemaining;
    gameState.players = data.players;
    updateGameDisplay(data);
    updateActionPanel();
    showNotification(`Nouvelle phase: ${getPhaseDisplayName(data.phase)}`, 'info');
});

socket.on('timerUpdate', (data) => {
    gameState.timeRemaining = data.timeRemaining;
    updateTimer(data.timeRemaining);
});

socket.on('nightKills', (killedPlayers) => {
    if (killedPlayers.length > 0) {
        killedPlayers.forEach(killed => {
            showNotification(`${killed.playerName} a été éliminé(e) par les loups-garous !`, 'error');
        });
    } else {
        showNotification('Personne n\'a été tué cette nuit', 'info');
    }
    // Mettre à jour la liste des joueurs
    updateGamePlayersList(gameState.players);
});

socket.on('playerEliminated', (data) => {
    showNotification(`${data.playerName} a été éliminé(e) par vote (${data.votes} votes)`, 'warning');
});

socket.on('roleRevealed', (data) => {
    showNotification(`${data.playerName} est ${getRoleDisplayName(data.role)}`, 'info');
});

socket.on('timerAccelerated', (data) => {
    gameState.timeRemaining = data.timeRemaining;
    updateTimer(data.timeRemaining);
    showNotification(data.message, 'success');
});

socket.on('actionConfirmed', (data) => {
    // Optionnel: afficher le nombre d'actions confirmées
    console.log(`Actions confirmées: ${data.confirmedCount}`);
});

socket.on('dayConfirmed', (data) => {
    console.log(`Joueurs prêts pour la phase suivante: ${data.confirmedCount}`);
});

socket.on('werewolfSelection', (data) => {
    if (gameState.playerRole === 'loup-garou') {
        showNotification(`${data.selectedByName} a sélectionné ${data.targetName}`, 'info');
        // Mettre à jour la sélection visuelle
        updateWerewolfSelection(data.targetId);
    }
});

socket.on('werewolfChat', (data) => {
    addWerewolfChatMessage(data);
});

socket.on('spyChat', (data) => {
    if (gameState.playerRole === 'petite-fille') {
        addSpyChatMessage(data);
    }
});

socket.on('becameLover', (data) => {
    showNotification(`💕 Vous êtes amoureux de ${data.partnerName} !`, 'warning');
});

socket.on('voteUpdate', (data) => {
    showNotification(`Vote enregistré`, 'success');
});

socket.on('chatMessage', (data) => {
    addChatMessage(data);
});

socket.on('gameEnded', (data) => {
    showScreen('end');
    updateEndScreen(data);
});

socket.on('error', (message) => {
    showNotification(message, 'error');
});

// Fonctions utilitaires
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    gameState.currentScreen = screenName;
}

function openCreateModal() {
    elements.createModal.classList.add('active');
    elements.hostPlayerName.focus();
}

function closeCreateModal() {
    elements.createModal.classList.remove('active');
    elements.hostPlayerName.value = '';
    elements.gameNameInput.value = '';
    elements.privateGame.checked = true;
}

function openJoinModal() {
    elements.joinModal.classList.add('active');
    elements.playerName.focus();
}

function closeJoinModal() {
    elements.joinModal.classList.remove('active');
    elements.playerName.value = '';
    elements.gameId.value = '';
}

function handleCreateGame() {
    const playerName = elements.hostPlayerName.value.trim();
    const gameName = elements.gameNameInput.value.trim();
    const isPublic = elements.publicGame.checked;
    const maxPlayers = parseInt(elements.maxPlayersSelect.value);
    
    if (!playerName) {
        showNotification('Veuillez entrer votre nom', 'error');
        return;
    }
    
    if (playerName.length > 20) {
        showNotification('Le nom doit faire moins de 20 caractères', 'error');
        return;
    }
    
    socket.emit('createGame', {
        playerName: playerName,
        gameName: gameName || `Partie de ${playerName}`,
        isPublic: isPublic,
        maxPlayers: maxPlayers
    });
    
    closeCreateModal();
}

function handleJoinGame() {
    const playerName = elements.playerName.value.trim();
    const gameId = elements.gameId.value.trim().toUpperCase();
    
    if (!playerName) {
        showNotification('Veuillez entrer votre nom', 'error');
        return;
    }
    
    if (playerName.length > 20) {
        showNotification('Le nom doit faire moins de 20 caractères', 'error');
        return;
    }
    
    if (!gameId) {
        showNotification('Veuillez entrer le code de la partie', 'error');
        return;
    }
    
    socket.emit('joinGame', {
        playerName: playerName,
        gameId: gameId
    });
    
    closeJoinModal();
}

function displayPublicGames(games) {
    const gamesList = elements.publicGamesList;
    
    if (!games || games.length === 0) {
        gamesList.innerHTML = `
            <div class="no-games-message">
                <i class="fas fa-search"></i>
                <p>Aucune partie publique disponible</p>
                <small>Créez la première ou revenez plus tard</small>
            </div>
        `;
        return;
    }
    
    gamesList.innerHTML = games.map(game => `
        <div class="game-card" onclick="joinPublicGame('${game.id}')">
            <div class="game-header">
                <h3 class="game-name">${game.gameName}</h3>
                <span class="players-count">${game.currentPlayers}/${game.maxPlayers}</span>
            </div>
            <div class="game-info">
                <div class="game-host">
                    <i class="fas fa-crown"></i>
                    <span>Hôte: ${game.hostName}</span>
                </div>
                <div class="game-time">
                    <i class="fas fa-clock"></i>
                    <span>Créée ${getTimeAgo(game.createdAt)}</span>
                </div>
            </div>
            <button class="join-game-btn">
                <i class="fas fa-arrow-right"></i>
                Rejoindre la partie
            </button>
        </div>
    `).join('');
}

function joinPublicGame(gameId) {
    const playerName = prompt('Entrez votre nom:');
    if (playerName && playerName.trim()) {
        socket.emit('joinGame', {
            playerName: playerName.trim(),
            gameId: gameId
        });
    }
}

function getTimeAgo(dateString) {
    const now = new Date();
    const created = new Date(dateString);
    const diffInMinutes = Math.floor((now - created) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'à l\'instant';
    if (diffInMinutes < 60) return `il y a ${diffInMinutes} min`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `il y a ${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `il y a ${diffInDays}j`;
}

function copyGameCode() {
    navigator.clipboard.writeText(gameState.gameId).then(() => {
        showNotification('Code copié dans le presse-papiers !', 'success');
    }).catch(() => {
        showNotification('Impossible de copier le code', 'error');
    });
}

function leaveGame() {
    socket.disconnect();
    socket.connect();
    gameState = {
        currentScreen: 'home',
        playerId: null,
        gameId: null,
        playerRole: null,
        isHost: false,
        selectedTarget: null,
        players: [],
        phase: 'lobby',
        timeRemaining: 0
    };
    showScreen('home');
}

function startGame() {
    socket.emit('startGame');
}

function updateLobby(data) {
    // Mettre à jour le nombre de joueurs
    elements.playerCount.textContent = `(${data.players.length}/12)`;
    
    // Afficher les contrôles d'hôte
    if (gameState.isHost) {
        elements.hostControls.style.display = 'block';
        elements.startGameBtn.disabled = data.players.length < 4;
        if (data.players.length >= 4) {
            elements.startGameBtn.innerHTML = '<i class="fas fa-play"></i> Démarrer la partie';
        } else {
            elements.startGameBtn.innerHTML = `<i class="fas fa-play"></i> Démarrer la partie (${4 - data.players.length} joueurs manquants)`;
        }
        
        // Afficher la configuration des rôles
        updateRoleConfigDisplay();
    }
    
    // Afficher la liste des joueurs
    elements.playersList.innerHTML = '';
    data.players.forEach(player => {
        const playerCard = createPlayerCard(player, data.hostId);
        elements.playersList.appendChild(playerCard);
    });
}

function createPlayerCard(player, hostId) {
    const card = document.createElement('div');
    card.className = 'player-card';
    
    const avatar = document.createElement('div');
    avatar.className = 'player-avatar';
    avatar.textContent = player.name.charAt(0).toUpperCase();
    
    const name = document.createElement('div');
    name.className = 'player-name';
    name.textContent = player.name;
    
    const status = document.createElement('div');
    status.className = 'player-status';
    status.textContent = player.isReady ? 'Prêt' : 'En attente...';
    
    card.appendChild(avatar);
    card.appendChild(name);
    card.appendChild(status);
    
    if (player.id === hostId) {
        const hostBadge = document.createElement('div');
        hostBadge.className = 'host-badge';
        hostBadge.textContent = 'Hôte';
        card.appendChild(hostBadge);
    }
    
    return card;
}

function updateRoleDisplay(role) {
    elements.playerRole.className = `role-card role-${role}`;
    elements.playerRole.querySelector('.role-name').textContent = getRoleDisplayName(role);
}

function getRoleDisplayName(role) {
    const roleNames = {
        'villageois': 'Villageois',
        'loup-garou': 'Loup-Garou',
        'voyante': 'Voyante',
        'sorciere': 'Sorcière',
        'chasseur': 'Chasseur',
        'cupidon': 'Cupidon',
        'petite-fille': 'Petite Fille'
    };
    return roleNames[role] || role;
}

function updateGameDisplay(data) {
    // Mettre à jour la phase
    elements.currentPhase.textContent = getPhaseDisplayName(data.phase);
    elements.roundNumber.textContent = `Tour ${data.round}`;
    
    // Mettre à jour le timer
    updateTimer(data.timeRemaining);
    
    // Mettre à jour la liste des joueurs
    updateGamePlayersList(data.players);
    
    // Mettre à jour le panneau d'action
    updateActionPanel();
}

function getPhaseDisplayName(phase) {
    const phaseNames = {
        'night': 'Nuit',
        'day': 'Jour',
        'vote': 'Vote',
        'lobby': 'Lobby'
    };
    return phaseNames[phase] || phase;
}

function updateTimer(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    elements.timeRemaining.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    
    // Changer la couleur selon le temps restant
    if (seconds <= 10) {
        elements.timeRemaining.style.color = 'var(--danger-color)';
    } else if (seconds <= 30) {
        elements.timeRemaining.style.color = 'var(--warning-color)';
    } else {
        elements.timeRemaining.style.color = 'var(--text-light)';
    }
}

function updateGamePlayersList(players) {
    elements.gamePlayersList.innerHTML = '';
    
    players.forEach(player => {
        const playerCard = createGamePlayerCard(player);
        elements.gamePlayersList.appendChild(playerCard);
    });
}

function createGamePlayerCard(player) {
    const card = document.createElement('div');
    card.className = `game-player-card ${!player.isAlive ? 'dead' : ''}`;
    card.dataset.playerId = player.id;
    
    const avatar = document.createElement('div');
    avatar.className = 'player-avatar';
    avatar.style.width = '40px';
    avatar.style.height = '40px';
    avatar.style.fontSize = '1rem';
    avatar.textContent = player.name.charAt(0).toUpperCase();
    
    const name = document.createElement('div');
    name.className = 'player-name';
    name.style.fontSize = '0.9rem';
    name.textContent = player.name;
    
    const status = document.createElement('div');
    status.className = 'player-status';
    status.style.fontSize = '0.8rem';
    status.textContent = player.isAlive ? 'Vivant' : 'Mort';
    
    card.appendChild(avatar);
    card.appendChild(name);
    card.appendChild(status);
    
    // Ajouter l'événement de clic pour la sélection
    card.addEventListener('click', () => selectPlayer(player.id, card));
    
    return card;
}

function selectPlayer(playerId, cardElement) {
    // Vérifier si on peut sélectionner ce joueur
    if (!canSelectPlayer(playerId)) return;
    
    // Désélectionner tous les autres joueurs
    document.querySelectorAll('.game-player-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Sélectionner ce joueur
    cardElement.classList.add('selected');
    gameState.selectedTarget = playerId;
    
    // Mettre à jour le panneau d'action
    updateActionPanel();
}

function canSelectPlayer(playerId) {
    // Ne peut pas se sélectionner soi-même
    if (playerId === gameState.playerId) return false;
    
    // Ne peut sélectionner que des joueurs vivants
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || !player.isAlive) return false;
    
    // Vérifier selon la phase et le rôle
    if (gameState.phase === 'vote') return true;
    if (gameState.phase === 'night' && gameState.playerRole === 'loup-garou') return true;
    if (gameState.phase === 'night' && gameState.playerRole === 'voyante') return true;
    
    return false;
}

function updateActionPanel() {
    let title = '';
    let content = '';
    
    switch (gameState.phase) {
        case 'night':
            if (gameState.playerRole === 'loup-garou') {
                title = 'Phase de Nuit - Loup-Garou';
                content = `
                    <p>🐺 <strong>Chat des Loups-Garous</strong> - Communiquez entre vous</p>
                    <p>Choisissez votre victime pour cette nuit.</p>
                    ${gameState.selectedTarget ? 
                        `<button onclick="performNightAction('kill')" class="btn btn-danger full-width">
                            <i class="fas fa-skull"></i> Éliminer ${getPlayerName(gameState.selectedTarget)}
                        </button>` : 
                        '<p style="color: var(--text-muted);">Sélectionnez un joueur</p>'
                    }
                `;
            } else if (gameState.playerRole === 'voyante') {
                title = 'Phase de Nuit - Voyante';
                content = `
                    <p>Vous pouvez voir le rôle d'un joueur.</p>
                    ${gameState.selectedTarget ? 
                        `<button onclick="performNightAction('see')" class="btn btn-primary full-width">
                            <i class="fas fa-eye"></i> Voir le rôle de ${getPlayerName(gameState.selectedTarget)}
                        </button>` : 
                        '<p style="color: var(--text-muted);">Sélectionnez un joueur</p>'
                    }
                `;
            } else if (gameState.playerRole === 'sorciere') {
                title = 'Phase de Nuit - Sorcière';
                content = `
                    <p>Vous avez une potion de vie et une potion de mort.</p>
                    <button onclick="performNightAction('heal')" class="btn btn-success full-width" style="margin-bottom: 0.5rem;">
                        <i class="fas fa-heart"></i> Sauver la victime des loups
                    </button>
                    ${gameState.selectedTarget ? 
                        `<button onclick="performNightAction('poison')" class="btn btn-danger full-width">
                            <i class="fas fa-skull-crossbones"></i> Empoisonner ${getPlayerName(gameState.selectedTarget)}
                        </button>` : 
                        '<p style="color: var(--text-muted);">Sélectionnez un joueur à empoisonner</p>'
                    }
                `;
            } else if (gameState.playerRole === 'cupidon' && gameState.round === 1) {
                title = 'Phase de Nuit - Cupidon';
                content = `
                    <p>Choisissez deux joueurs qui tomberont amoureux.</p>
                    <p style="color: var(--text-muted);">Cliquez sur deux joueurs pour les lier d'amour</p>
                    <div id="selectedLovers"></div>
                `;
            } else if (gameState.playerRole === 'petite-fille') {
                title = 'Phase de Nuit - Petite Fille';
                content = `
                    <p>👁️ Vous pouvez espionner les loups-garous !</p>
                    <p>Vous pouvez voir leurs messages secrets...</p>
                    <div style="background: var(--card-bg); padding: 1rem; border-radius: 12px; margin-top: 1rem;">
                        <h4 style="color: var(--warning-color);">🔍 Chat Espionné</h4>
                        <div id="spyMessages" style="max-height: 150px; overflow-y: auto;"></div>
                    </div>
                `;
            } else {
                title = 'Phase de Nuit';
                content = '<p>La nuit est tombée sur le village. Dormez bien...</p>';
            }
            break;
            
        case 'day':
            title = 'Phase de Jour';
            content = `
                <p>Le jour se lève sur le village. Discutez entre vous pour identifier les loups-garous !</p>
                <div style="background: var(--card-bg); padding: 1rem; border-radius: 12px; margin-top: 1rem;">
                    <h4 style="margin-bottom: 0.5rem; color: var(--primary-color);">
                        <i class="fas fa-lightbulb"></i> Conseils
                    </h4>
                    <ul style="list-style: none; padding: 0;">
                        <li style="margin-bottom: 0.5rem;">
                            <i class="fas fa-comments" style="color: var(--success-color); margin-right: 0.5rem;"></i>
                            Utilisez le chat pour communiquer
                        </li>
                        <li style="margin-bottom: 0.5rem;">
                            <i class="fas fa-search" style="color: var(--warning-color); margin-right: 0.5rem;"></i>
                            Analysez les comportements suspects
                        </li>
                        <li>
                            <i class="fas fa-users" style="color: var(--primary-color); margin-right: 0.5rem;"></i>
                            Coordonnez-vous avec les autres villageois
                        </li>
                    </ul>
                </div>
                <button onclick="confirmDayReady()" class="btn btn-success full-width" style="margin-top: 1rem;">
                    <i class="fas fa-check"></i> Je suis prêt(e) pour la phase suivante
                </button>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem; text-align: center;">
                    Le timer sera accéléré quand 70% des joueurs seront prêts
                </p>
            `;
            break;
            
        case 'vote':
            title = 'Phase de Vote';
            content = `
                <p>Il est temps de voter pour éliminer un joueur suspect !</p>
                ${gameState.selectedTarget ? 
                    `<button onclick="vote()" class="btn btn-warning full-width">
                        <i class="fas fa-vote-yea"></i> Voter contre ${getPlayerName(gameState.selectedTarget)}
                    </button>` : 
                    '<p style="color: var(--text-muted);">Sélectionnez un joueur</p>'
                }
            `;
            break;
            
        default:
            title = 'En attente...';
            content = '<p>En attente de la prochaine phase...</p>';
    }
    
    if (elements.actionTitle) {
        elements.actionTitle.textContent = title;
    }
    if (elements.actionContent) {
        elements.actionContent.innerHTML = content;
    }
}

function getPlayerName(playerId) {
    const player = gameState.players.find(p => p.id === playerId);
    return player ? player.name : 'Joueur inconnu';
}

function performNightAction(actionType) {
    if (!gameState.selectedTarget && actionType !== 'heal') return;
    
    const targetName = gameState.selectedTarget ? getPlayerName(gameState.selectedTarget) : 'la victime';
    
    // Pour les loups-garous, d'abord signaler la sélection
    if (gameState.playerRole === 'loup-garou' && actionType === 'kill') {
        socket.emit('nightAction', {
            action: 'select',
            targetId: gameState.selectedTarget
        });
        
        // Puis confirmer l'action
        setTimeout(() => {
            socket.emit('nightAction', {
                action: 'kill',
                targetId: gameState.selectedTarget
            });
        }, 100);
    } else {
        socket.emit('nightAction', {
            action: actionType,
            targetId: gameState.selectedTarget
        });
    }
    
    // Messages de confirmation
    switch (actionType) {
        case 'kill':
            showNotification(`Vous avez choisi d'éliminer ${targetName}`, 'success');
            break;
        case 'see':
            showNotification(`Vous regardez le rôle de ${targetName}...`, 'success');
            break;
        case 'heal':
            showNotification('Vous utilisez votre potion de vie', 'success');
            break;
        case 'poison':
            showNotification(`Vous empoisonnez ${targetName}`, 'success');
            break;
    }
    
    gameState.selectedTarget = null;
    
    // Désélectionner visuellement
    document.querySelectorAll('.game-player-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    updateActionPanel();
}

function updateWerewolfSelection(targetId) {
    // Mettre à jour la sélection visuelle pour tous les loups-garous
    document.querySelectorAll('.game-player-card').forEach(card => {
        card.classList.remove('werewolf-selected');
    });
    
    const targetCard = document.querySelector(`[data-player-id="${targetId}"]`);
    if (targetCard) {
        targetCard.classList.add('werewolf-selected');
    }
}

function addWerewolfChatMessage(data) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message werewolf-message';
    
    const timestamp = new Date(data.timestamp).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageElement.innerHTML = `
        <div class="chat-message-header">
            <span class="chat-player-name" style="color: #ef4444;">🐺 ${data.playerName}</span>
            <span class="chat-timestamp">${timestamp}</span>
        </div>
        <div class="chat-message-content">${escapeHtml(data.message)}</div>
    `;
    
    elements.chatMessages.appendChild(messageElement);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function addSpyChatMessage(data) {
    const spyDiv = document.getElementById('spyMessages');
    if (!spyDiv) return;
    
    const messageElement = document.createElement('div');
    messageElement.style.cssText = 'margin-bottom: 0.5rem; padding: 0.5rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px; font-size: 0.8rem;';
    messageElement.textContent = data.message;
    
    spyDiv.appendChild(messageElement);
    spyDiv.scrollTop = spyDiv.scrollHeight;
}

function updateRoleConfigDisplay() {
    if (!gameState.isHost) return;
    
    // Chercher s'il y a déjà une section de configuration
    let configSection = document.getElementById('roleConfigSection');
    
    if (!configSection) {
        // Créer la section de configuration des rôles
        configSection = document.createElement('div');
        configSection.id = 'roleConfigSection';
        configSection.className = 'role-config-section';
        configSection.style.cssText = `
            background: var(--glass);
            backdrop-filter: blur(10px);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.5rem;
            margin-bottom: 1rem;
        `;
        
        // Insérer avant les contrôles d'hôte
        const hostControls = elements.hostControls;
        hostControls.parentNode.insertBefore(configSection, hostControls);
    }
    
    configSection.innerHTML = `
        <h3 style="margin-bottom: 1rem; color: var(--primary-color);">
            <i class="fas fa-cogs"></i> Configuration des Rôles
        </h3>
        
        <div class="config-mode" style="margin-bottom: 1.5rem;">
            <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                <input type="checkbox" id="autoBalance" ${gameState.roleConfig.autoBalance ? 'checked' : ''} 
                       onchange="updateRoleConfig('autoBalance', this.checked)">
                <span>Équilibrage automatique</span>
            </label>
        </div>
        
        <div id="manualConfig" style="display: ${gameState.roleConfig.autoBalance ? 'none' : 'block'};">
            <div class="role-config-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                
                <div class="role-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--card-bg); border-radius: 8px;">
                    <span>🐺 Loups-Garous</span>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <button onclick="changeWerewolfCount(-1)" class="btn-small">-</button>
                        <span id="werewolfCount" style="min-width: 20px; text-align: center;">${gameState.roleConfig.loupGarou}</span>
                        <button onclick="changeWerewolfCount(1)" class="btn-small">+</button>
                    </div>
                </div>
                
                <div class="role-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--card-bg); border-radius: 8px;">
                    <span>🔮 Voyante</span>
                    <label class="toggle-switch">
                        <input type="checkbox" ${gameState.roleConfig.voyante ? 'checked' : ''} 
                               onchange="updateRoleConfig('voyante', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                
                <div class="role-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--card-bg); border-radius: 8px;">
                    <span>🧙‍♀️ Sorcière</span>
                    <label class="toggle-switch">
                        <input type="checkbox" ${gameState.roleConfig.sorciere ? 'checked' : ''} 
                               onchange="updateRoleConfig('sorciere', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                
                <div class="role-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--card-bg); border-radius: 8px;">
                    <span>🏹 Chasseur</span>
                    <label class="toggle-switch">
                        <input type="checkbox" ${gameState.roleConfig.chasseur ? 'checked' : ''} 
                               onchange="updateRoleConfig('chasseur', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                
                <div class="role-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--card-bg); border-radius: 8px;">
                    <span>💘 Cupidon</span>
                    <label class="toggle-switch">
                        <input type="checkbox" ${gameState.roleConfig.cupidon ? 'checked' : ''} 
                               onchange="updateRoleConfig('cupidon', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                
                <div class="role-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--card-bg); border-radius: 8px;">
                    <span>👧 Petite Fille</span>
                    <label class="toggle-switch">
                        <input type="checkbox" ${gameState.roleConfig.petiteFille ? 'checked' : ''} 
                               onchange="updateRoleConfig('petiteFille', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                
            </div>
            
            <div class="role-summary" style="margin-top: 1rem; padding: 1rem; background: var(--card-light); border-radius: 8px;">
                <h4 style="margin-bottom: 0.5rem;">Résumé :</h4>
                <div id="roleSummary" style="font-size: 0.9rem; color: var(--text-muted);"></div>
            </div>
        </div>
    `;
    
    updateRoleSummary();
}

function updateRoleConfig(key, value) {
    gameState.roleConfig[key] = value;
    
    // Gérer l'affichage du mode manuel
    if (key === 'autoBalance') {
        const manualConfig = document.getElementById('manualConfig');
        if (manualConfig) {
            manualConfig.style.display = value ? 'none' : 'block';
        }
    }
    
    updateRoleSummary();
    
    // Envoyer au serveur
    socket.emit('updateRoleConfig', {
        roleConfig: gameState.roleConfig
    });
}

function changeWerewolfCount(delta) {
    const newCount = Math.max(1, Math.min(4, gameState.roleConfig.loupGarou + delta));
    gameState.roleConfig.loupGarou = newCount;
    
    document.getElementById('werewolfCount').textContent = newCount;
    updateRoleSummary();
    
    socket.emit('updateRoleConfig', {
        roleConfig: gameState.roleConfig
    });
}

function updateRoleSummary() {
    const summaryDiv = document.getElementById('roleSummary');
    if (!summaryDiv) return;
    
    if (gameState.roleConfig.autoBalance) {
        summaryDiv.innerHTML = 'Mode automatique : Les rôles sont distribués automatiquement selon le nombre de joueurs.';
        return;
    }
    
    const playerCount = gameState.players.length;
    let totalSpecialRoles = gameState.roleConfig.loupGarou;
    let rolesList = [`${gameState.roleConfig.loupGarou} Loup${gameState.roleConfig.loupGarou > 1 ? 's' : ''}-Garou`];
    
    if (gameState.roleConfig.voyante) {
        totalSpecialRoles++;
        rolesList.push('1 Voyante');
    }
    if (gameState.roleConfig.sorciere) {
        totalSpecialRoles++;
        rolesList.push('1 Sorcière');
    }
    if (gameState.roleConfig.chasseur) {
        totalSpecialRoles++;
        rolesList.push('1 Chasseur');
    }
    if (gameState.roleConfig.cupidon) {
        totalSpecialRoles++;
        rolesList.push('1 Cupidon');
    }
    if (gameState.roleConfig.petiteFille) {
        totalSpecialRoles++;
        rolesList.push('1 Petite Fille');
    }
    
    const villagerCount = Math.max(0, playerCount - totalSpecialRoles);
    if (villagerCount > 0) {
        rolesList.push(`${villagerCount} Villageois`);
    }
    
    summaryDiv.innerHTML = rolesList.join(', ');
    
    // Vérifications d'équilibre
    if (totalSpecialRoles > playerCount) {
        summaryDiv.innerHTML += '<br><span style="color: var(--danger-color);">⚠️ Trop de rôles spéciaux</span>';
    } else if (gameState.roleConfig.loupGarou >= Math.ceil(playerCount / 2)) {
        summaryDiv.innerHTML += '<br><span style="color: var(--danger-color);">⚠️ Trop de loups-garous</span>';
    }
}

function vote() {
    if (!gameState.selectedTarget) return;
    
    socket.emit('vote', {
        targetId: gameState.selectedTarget
    });
    
    showNotification('Vote confirmé !', 'success');
    gameState.selectedTarget = null;
    
    // Désélectionner visuellement
    document.querySelectorAll('.game-player-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    updateActionPanel();
}

function confirmDayReady() {
    socket.emit('confirmDay');
    showNotification('Vous êtes prêt(e) pour la phase suivante !', 'success');
    
    // Désactiver le bouton pour éviter les spams
    const button = document.querySelector('button[onclick="confirmDayReady()"]');
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-check"></i> Prêt(e) !';
        button.style.opacity = '0.7';
    }
}

function sendChatMessage() {
    const message = elements.chatInput.value.trim();
    if (!message) return;
    
    if (message.length > 200) {
        showNotification('Le message est trop long (max 200 caractères)', 'error');
        return;
    }
    
    socket.emit('chatMessage', { message });
    elements.chatInput.value = '';
}

function addChatMessage(data) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    
    const timestamp = new Date(data.timestamp).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageElement.innerHTML = `
        <div class="chat-message-header">
            <span class="chat-player-name">${data.playerName}</span>
            <span class="chat-timestamp">${timestamp}</span>
        </div>
        <div class="chat-message-content">${escapeHtml(data.message)}</div>
    `;
    
    elements.chatMessages.appendChild(messageElement);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function updateEndScreen(data) {
    if (data.winner === 'villagers') {
        elements.winnerTitle.textContent = '🎉 Victoire des Villageois !';
        elements.winnerSubtitle.textContent = 'Les loups-garous ont été éliminés !';
    } else {
        elements.winnerTitle.textContent = '🐺 Victoire des Loups-Garous !';
        elements.winnerSubtitle.textContent = 'Les loups-garous ont pris le contrôle du village !';
    }
    
    // Afficher tous les joueurs avec leurs rôles
    elements.finalPlayersList.innerHTML = '';
    data.players.forEach(player => {
        const card = document.createElement('div');
        card.className = `final-player-card ${data.winner === 'villagers' && player.role !== 'loup-garou' ? 'winner' : ''}
                         ${data.winner === 'werewolves' && player.role === 'loup-garou' ? 'winner' : ''}`;
        
        card.innerHTML = `
            <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
            <div class="player-name">${player.name}</div>
            <div class="final-player-role">${getRoleDisplayName(player.role)}</div>
            <div class="player-status">${player.isAlive ? 'Survivant' : 'Éliminé'}</div>
        `;
        
        elements.finalPlayersList.appendChild(card);
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    const container = document.getElementById('notifications');
    container.appendChild(notification);
    
    // Supprimer la notification après 5 secondes
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.5s ease-out reverse';
        setTimeout(() => {
            if (container.contains(notification)) {
                container.removeChild(notification);
            }
        }, 500);
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Timer en temps réel
setInterval(() => {
    if (gameState.timeRemaining > 0 && gameState.currentScreen === 'game') {
        gameState.timeRemaining--;
        updateTimer(gameState.timeRemaining);
    }
}, 1000);