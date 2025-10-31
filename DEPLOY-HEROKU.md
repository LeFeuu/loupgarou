# Guide de déploiement Heroku

## Prérequis
1. Compte Heroku créé
2. Heroku CLI installé
3. Git installé

## Commandes à exécuter dans le terminal :

# 1. Se connecter à Heroku
heroku login

# 2. Initialiser git (si pas déjà fait)
git init
git add .
git commit -m "Initial commit - Loup-Garou Online"

# 3. Créer une app Heroku
heroku create votre-nom-app-loupgarou

# 4. Déployer
git push heroku main

# 5. Ouvrir votre app
heroku open

## URL de votre jeu :
Votre jeu sera accessible sur : https://votre-nom-app-loupgarou.herokuapp.com