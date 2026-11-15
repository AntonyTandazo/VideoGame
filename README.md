# Juego de Naves 2D

Juego de naves espaciales en HTML, CSS y JavaScript puro (módulos ES, sin frameworks).

## Estructura

```
juego-naves/
├── index.html
├── css/
│   ├── base.css        # reset, body y canvas
│   ├── ui.css          # puntuación, vida y tiempo
│   ├── overlay.css     # pantallas (inicio, historia, game over)
│   └── historia.css    # texto de la odisea
├── js/
│   ├── main.js         # bucle, input y pantallas
│   ├── game.js         # orquesta todo el juego
│   ├── player.js       # nave del jugador, vida y poderes
│   ├── bullet.js       # disparos del jugador
│   ├── enemyBullet.js  # disparos enemigos
│   ├── enemy.js        # naves enemigas (vida 100, disparan, sueltan power-ups)
│   ├── meteorito.js    # meteoritos
│   ├── powerup.js      # power-ups (escudo, disparo continuo, vida)
│   └── sound.js        # efectos y música de fondo
├── assets/
│   ├── images/
│   │   ├── Nave-espacial.svg      # nave del jugador
│   │   ├── navecita_enemiga.svg   # nave enemiga
│   │   ├── roca-espacial.svg      # meteorito
│   │   └── fondo-espacial.svg     # fondo galáctico
│   └── sounds/
│       ├── shoot_player.wav
│       ├── shoot_enemy.wav
│       ├── explosion_enemy.wav
│       ├── explosion_asteroid.wav
│       ├── hit.wav
│       ├── game_over.wav
│       ├── powerup.wav
│       ├── bgm_menu.mp3
│       └── bgm_level.mp3
└── README.md
```

## Cómo correrlo

Abrí `juego-naves/index.html` en tu navegador (o con Live Server de VS Code por los módulos ES).

## Controles

- Flecha izquierda / `A`: moverse a la izquierda.
- Flecha derecha / `D`: moverse a la derecha.
- Espacio: disparar (se puede mantener presionado para disparo rápido si tenés el poder).

## Jugabilidad

- **Vida del jugador:** 120 HP. Si llega a 0, perdés una vida (3 iniciales) y se recupera al máximo.
- **Naves enemigas:** tienen 100 HP y disparan hacia abajo.
- **Meteoritos:** dañan al jugador al chocar.
- **Power-ups** que caen del cielo:
  - 🛡️ **Escudo:** absorbe 4 impactos y dura 30 segundos.
  - ⚡ **Disparo continuo:** dispará muy rápido durante 20 segundos.
  - ❤️ **Vida extra:** recuperás 1 vida.

## Sonidos

El navegador bloquea el audio hasta la primera interacción. Hacé clic en cualquier lado para desbloquearlo. Usá el botón 🔊 arriba a la derecha para activar/desactivar.
