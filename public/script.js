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
    timeRemaining: 0
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
    joinModal: document.getElementById('joinModal'),
    closeModal: document.getElementById('closeModal'),
    playerName: document.getElementById('playerName'),
    gameId: document.getElementById('gameId'),
    confirmJoin: document.getElementById('confirmJoin'),
    modalTitle: document.getElementById('modalTitle'),
    gameIdGroup: document.getElementById('gameIdGroup'),
    
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
});

// Gestion des événements
function initializeEventListeners() {
    // Home screen events
    elements.createGameBtn.addEventListener('click', () => openJoinModal(true));
    elements.joinGameBtn.addEventListener('click', () => openJoinModal(false));
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
    updateLobby(data);
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

function openJoinModal(isCreating) {
    elements.modalTitle.textContent = isCreating ? 'Créer une partie' : 'Rejoindre une partie';
    elements.gameIdGroup.style.display = isCreating ? 'none' : 'block';
    elements.joinModal.classList.add('active');
    elements.playerName.focus();
}

function closeJoinModal() {
    elements.joinModal.classList.remove('active');
    elements.playerName.value = '';
    elements.gameId.value = '';
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
    
    // Si on rejoint une partie existante, vérifier le code
    if (elements.gameIdGroup.style.display !== 'none' && !gameId) {
        showNotification('Veuillez entrer le code de la partie', 'error');
        return;
    }
    
    socket.emit('joinGame', {
        playerName: playerName,
        gameId: gameId || null
    });
    
    closeJoinModal();
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
        'cupidon': 'Cupidon'
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
                    <p>Choisissez votre victime pour cette nuit.</p>
                    ${gameState.selectedTarget ? 
                        `<button onclick="performNightAction()" class="btn btn-danger full-width">
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
                        `<button onclick="performNightAction()" class="btn btn-primary full-width">
                            <i class="fas fa-eye"></i> Voir le rôle de ${getPlayerName(gameState.selectedTarget)}
                        </button>` : 
                        '<p style="color: var(--text-muted);">Sélectionnez un joueur</p>'
                    }
                `;
            } else {
                title = 'Phase de Nuit';
                content = '<p>La nuit est tombée sur le village. Les loups-garous se réveillent...</p>';
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

function performNightAction() {
    if (!gameState.selectedTarget) return;
    
    const actionType = gameState.playerRole === 'loup-garou' ? 'kill' : 'see';
    const targetName = getPlayerName(gameState.selectedTarget);
    
    socket.emit('nightAction', {
        action: actionType,
        targetId: gameState.selectedTarget
    });
    
    if (actionType === 'kill') {
        showNotification(`Vous avez choisi d'éliminer ${targetName}`, 'success');
    } else {
        showNotification(`Vous regardez le rôle de ${targetName}...`, 'success');
    }
    
    gameState.selectedTarget = null;
    
    // Désélectionner visuellement
    document.querySelectorAll('.game-player-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    updateActionPanel();
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