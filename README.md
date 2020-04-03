# metroLister

Dans c'est temps de Coronavirus, nous faisons, pour quelques-uns, nos achats d'épicerie en ligne.  Par contre, les services d'épiceries ne sont pas tous à jour.  Le métro proche de chez moi fonctionne par email.  Nous devons écrire un email avec une liste d'épicerie.  Mon idée était alors de faire mon `cart` en utilisant l'outil de sélection des aliments sur leur site internet, de l'exporter sous format CSV et de leur envoyer cela.  Par contre, leur site ne permet pas l'exportation.  Donc, j'ai créé ce script de `webscrapping`.

Faite un compte sur metro.ca, remplisser votre `cart`, et lancer ce script.

### Installation
```
npm install
```

### Config
Renommer le fichier `.env.sample` par `.env` et remplisser les champs:
```
EMAIL
PASSWORD
```
Par votre compte metro.ca

### Utilisation
```
node app.js
```