# 🐺 Loup-Garou Online - Jeu Moderne Multijoueur

Un jeu de loup-garou en ligne avec un design moderne et une interface utilisateur intuitive, développé avec Node.js, Socket.io et des technologies web modernes.

## 🌟 Fonctionnalités

### 🎮 Gameplay
- **Multijoueur en temps réel** : Jusqu'à 12 joueurs simultanés
- **Rôles variés** : Villageois, Loup-Garou, Voyante, Sorcière, Chasseur, Cupidon
- **Phases de jeu dynamiques** : Nuit, Jour, Vote avec timer automatique
- **Chat en temps réel** : Communication entre joueurs
- **Interface moderne** : Design responsif avec animations CSS

### 🎯 Rôles disponibles
- **👨‍🌾 Villageois** : Éliminer tous les loups-garous
- **🐺 Loup-Garou** : Éliminer tous les villageois
- **🔮 Voyante** : Peut voir le rôle d'un joueur chaque nuit
- **🧙‍♀️ Sorcière** : Possède une potion de vie et une potion de mort
- **🏹 Chasseur** : Peut éliminer un joueur en mourant
- **💘 Cupidon** : Peut lier deux joueurs amoureux

### 🎨 Design Moderne
- **Interface glassmorphism** : Effets de verre et transparence
- **Animations fluides** : Transitions CSS modernes
- **Responsive** : Compatible mobile, tablette et desktop
- **Thème sombre** : Optimisé pour les sessions de jeu longues
- **Notifications** : Système de notifications en temps réel

## 🚀 Installation et Lancement

### Prérequis
- Node.js (version 14 ou supérieure)
- npm ou yarn

### Installation
```bash
# Cloner ou télécharger le projet
cd loupgarou

# Installer les dépendances
npm install

# Démarrer le serveur
npm start
```

### Développement
```bash
# Mode développement avec rechargement automatique
npm run dev
```

## 🎯 Comment Jouer

### 1. Créer une Partie
1. Cliquez sur "Créer une partie"
2. Entrez votre nom
3. Partagez le code de partie avec vos amis

### 2. Rejoindre une Partie
1. Cliquez sur "Rejoindre une partie"
2. Entrez votre nom et le code de partie
3. Attendez que l'hôte démarre la partie

### 3. Déroulement du Jeu

#### 🌙 Phase de Nuit
- Les loups-garous choisissent leur victime
- Les rôles spéciaux agissent (Voyante, Sorcière, etc.)
- Durée : 60 secondes

#### ☀️ Phase de Jour
- Discussion libre entre tous les joueurs
- Utilisez le chat pour communiquer
- Durée : 120 secondes

#### 🗳️ Phase de Vote
- Tous les joueurs votent pour éliminer un suspect
- Le joueur avec le plus de votes est éliminé
- Durée : 60 secondes

### 4. Conditions de Victoire
- **Villageois gagnent** : Tous les loups-garous sont éliminés
- **Loups-garous gagnent** : Ils égalent ou dépassent le nombre de villageois

## 🛠️ Technologies Utilisées

### Backend
- **Node.js** : Serveur JavaScript
- **Express.js** : Framework web
- **Socket.io** : Communication WebSocket en temps réel
- **UUID** : Génération d'identifiants uniques

### Frontend
- **HTML5** : Structure sémantique
- **CSS3 Moderne** : Variables CSS, Grid, Flexbox, animations
- **JavaScript ES6+** : Logique client moderne
- **Font Awesome** : Icônes
- **Google Fonts** : Typographie (Inter)

### Fonctionnalités CSS Modernes
- **CSS Grid & Flexbox** : Mise en page responsive
- **CSS Variables** : Système de thème cohérent
- **Backdrop-filter** : Effets glassmorphism
- **CSS Animations** : Transitions fluides
- **Media Queries** : Design responsive

## 📁 Structure du Projet

```
loupgarou/
├── server.js              # Serveur Node.js principal
├── package.json           # Dépendances et scripts
├── README.md             # Documentation
└── public/               # Fichiers client
    ├── index.html        # Interface utilisateur
    ├── styles.css        # Styles modernes
    └── script.js         # Logique client
```

## 🎮 Guide du Développeur

### Architecture du Serveur
- **Gestion des parties** : Map pour stocker les parties actives
- **Gestion des joueurs** : Système de rôles et d'états
- **Timer automatique** : Changement automatique des phases
- **WebSocket** : Communication bidirectionnelle en temps réel

### Classes Principales
- **Game** : Gestion d'une partie (joueurs, phases, votes)
- **Rôles** : Système modulaire pour les différents rôles
- **Phases** : Machine à états pour le déroulement du jeu

### Événements Socket.io
- `joinGame` : Rejoindre/créer une partie
- `startGame` : Démarrer la partie
- `vote` : Voter pendant la phase de vote
- `nightAction` : Action nocturne (loup-garou, voyante, etc.)
- `chatMessage` : Envoyer un message

## 🔧 Configuration

### Variables d'Environnement
```bash
PORT=3000  # Port du serveur (par défaut: 3000)
```

### Personnalisation
- **Timing des phases** : Modifiable dans `server.js`
- **Nombre maximum de joueurs** : Configurable (actuellement 12)
- **Rôles disponibles** : Extensible dans l'objet `ROLES`

## 🎨 Personnalisation du Thème

Les couleurs et styles sont centralisés dans les variables CSS :

```css
:root {
    --primary-color: #6366f1;    /* Couleur principale */
    --dark-bg: #0f172a;          /* Arrière-plan sombre */
    --card-bg: #1e293b;          /* Cartes et composants */
    --text-light: #f8fafc;       /* Texte principal */
    /* ... autres variables */
}
```

## 🐛 Dépannage

### Problèmes Courants
1. **Port déjà utilisé** : Changez le port dans les variables d'environnement
2. **Connexion WebSocket** : Vérifiez que le serveur est démarré
3. **Problèmes d'affichage** : Videz le cache du navigateur

### Logs
Le serveur affiche les logs de connexion et déconnexion des joueurs dans la console.

## 🚀 Améliorations Futures

- [ ] **Système de spectateurs** : Observer les parties en cours
- [ ] **Historique des parties** : Sauvegarde des résultats
- [ ] **Classements** : Système de points et statistiques
- [ ] **Modes de jeu** : Variantes du loup-garou
- [ ] **Audio** : Sons et ambiance sonore
- [ ] **Animations avancées** : Effets visuels lors des éliminations

## 📄 Licence

Ce projet est sous licence MIT. Vous êtes libre de l'utiliser, le modifier et le distribuer.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer de nouvelles fonctionnalités
- Améliorer la documentation
- Optimiser le code

## 📞 Support

Pour toute question ou problème, vous pouvez :
- Ouvrir une issue sur le repository
- Consulter la documentation
- Vérifier les logs du serveur

---

**Amusez-vous bien et que le meilleur détective gagne ! 🕵️‍♂️**