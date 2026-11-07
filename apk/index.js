// Enregistrer la tâche headless AVANT le composant racine (boot / app fermée)
import './src/persistentService';

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
